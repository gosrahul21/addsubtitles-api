import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

interface SilenceInterval {
  start: number;
  end: number;
}

interface WordEntry {
  word: string;
  start: number;
  end: number;
}

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  // Orchestrator method triggered by BullMQ
  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, videoUrl } = job.data;
    const workDir = path.resolve(__dirname, `../../temp-work-${projectId}`);
    
    try {
      console.log(`[Job ${job.id}] Starting audio transcription pipeline for project: ${projectId}`);
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }

      // Step 1: Extract main audio channel from source video
      const rawAudioPath = path.join(workDir, 'extracted_full.mp3');
      await this.extractAudioChannel(videoUrl, rawAudioPath);
      
      // Get full duration of extracted audio file
      const totalDuration = await this.getAudioDuration(rawAudioPath);
      console.log(`[Job ${job.id}] Audio extracted: ${totalDuration}s long.`);

      // Target chunk size in seconds (e.g. 10 minutes for large videos)
      const targetChunkSize = 600; 
      let stitchedWords: WordEntry[] = [];

      if (totalDuration > targetChunkSize + 30) {
        console.log(`[Job ${job.id}] Audio exceeds threshold. Slicing with silence detection…`);
        
        // Step 2: Detect silence points in the track
        const silences = await this.detectSilences(rawAudioPath);
        
        // Find best splitting intervals near our 10-minute thresholds
        const splitPoints = this.calculateOptimalSplitPoints(silences, totalDuration, targetChunkSize);
        console.log(`[Job ${job.id}] Slicing plan calculated. Split points:`, splitPoints);

        // Step 3: Chop, Transcribe, and Offset timings concurrently
        stitchedWords = await this.processChunkedTranscription(rawAudioPath, splitPoints, totalDuration, workDir);
      } else {
        // Direct transcription for standard size uploads
        console.log(`[Job ${job.id}] Small audio track. Sending directly to single-pass transcription.`);
        stitchedWords = await this.mockDeepgramSTTCall(rawAudioPath, 0);
      }

      // Step 4: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, stitchedWords);

      // Step 5: Update database project status
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });

      console.log(`[Job ${job.id}] Pipeline finished successfully for Project: ${projectId}`);
    } catch (err) {
      console.error(`[Job ${job.id}] Pipeline failed:`, err);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });
      throw err;
    } finally {
      // Cleanup temporary files
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }
  }

  // 1. FFmpeg extract audio utility
  private extractAudioChannel(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  // 2. FFmpeg duration reader
  private getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  // 3. Intelligent Silence detection using silencedetect filter
  private detectSilences(audioPath: string): Promise<SilenceInterval[]> {
    return new Promise((resolve, reject) => {
      const silences: SilenceInterval[] = [];
      let currentSilenceStart: number | null = null;

      // Filter looks for silences of at least 0.5s duration below -30dB
      ffmpeg(audioPath)
        .audioFilters('silencedetect=noise=-30dB:d=0.5')
        .format('null')
        .save('-')
        .on('stderr', (line: string) => {
          const startMatch = line.match(/silence_start:\s*([\d.]+)/);
          const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration/);

          if (startMatch) {
            currentSilenceStart = parseFloat(startMatch[1]);
          }
          if (endMatch && currentSilenceStart !== null) {
            silences.push({
              start: currentSilenceStart,
              end: parseFloat(endMatch[1]),
            });
            currentSilenceStart = null;
          }
        })
        .on('end', () => resolve(silences))
        .on('error', (err) => reject(err));
    });
  }

  // 4. Calculate splitting timestamps based on detected silences
  private calculateOptimalSplitPoints(silences: SilenceInterval[], totalDuration: number, targetChunk: number): number[] {
    const splits: number[] = [0];
    let lastSplit = 0;

    while (lastSplit + targetChunk < totalDuration) {
      const idealSplit = lastSplit + targetChunk;
      
      // Find the silence closest to the ideal split time
      let bestSilence = silences.reduce((prev, curr) => {
        const prevDiff = Math.abs((prev.start + prev.end) / 2 - idealSplit);
        const currDiff = Math.abs((curr.start + curr.end) / 2 - idealSplit);
        return currDiff < prevDiff ? curr : prev;
      }, { start: idealSplit, end: idealSplit } as SilenceInterval);

      // Verify selected silence isn't overlapping previous splits
      const midpoint = (bestSilence.start + bestSilence.end) / 2;
      if (midpoint > lastSplit + 10 && midpoint < totalDuration - 10) {
        splits.push(midpoint);
        lastSplit = midpoint;
      } else {
        // Fallback to hard split if no silent points exist
        splits.push(idealSplit);
        lastSplit = idealSplit;
      }
    }

    splits.push(totalDuration);
    return splits;
  }

  // 5. Slice chunks, fetch STT, and map relative offsets to absolute timeline
  private async processChunkedTranscription(
    audioPath: string,
    splitPoints: number[],
    totalDuration: number,
    workDir: string
  ): Promise<WordEntry[]> {
    const flatWords: WordEntry[] = [];

    for (let i = 0; i < splitPoints.length - 1; i++) {
      const start = splitPoints[i];
      const end = splitPoints[i + 1];
      const duration = end - start;
      const chunkPath = path.join(workDir, `chunk_${i}.mp3`);

      console.log(`Slicing chunk ${i}: from ${start.toFixed(1)}s to ${end.toFixed(1)}s (${duration.toFixed(1)}s duration)`);
      
      // Slice audio using fluent-ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(audioPath)
          .seekInput(start)
          .duration(duration)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(chunkPath);
      });

      // Call transcription and apply the absolute timeline shift offset
      const words = await this.mockDeepgramSTTCall(chunkPath, start);
      flatWords.push(...words);
    }

    return flatWords;
  }

  // 6. Deepgram Cloud STT simulated request
  private async mockDeepgramSTTCall(filePath: string, timeOffset: string | number): Promise<WordEntry[]> {
    // In production, instantiate `new DeepgramClient(process.env.DEEPGRAM_API_KEY)`
    // and fetch transcription using client.listen.v1.media.transcribeFile()
    // For MVP, we simulate a mock responsive transcription
    await new Promise((res) => setTimeout(res, 500)); 

    const offset = Number(timeOffset);
    return [
      { word: 'Hello', start: offset + 0.5, end: offset + 1.2 },
      { word: 'and', start: offset + 1.3, end: offset + 1.6 },
      { word: 'welcome', start: offset + 1.7, end: offset + 2.4 },
      { word: 'to', start: offset + 2.5, end: offset + 2.8 },
      { word: 'automated', start: offset + 2.9, end: offset + 3.8 },
      { word: 'video', start: offset + 3.9, end: offset + 4.3 },
      { word: 'captioning.', start: offset + 4.4, end: offset + 5.2 },
    ];
  }

  // 7. Save Flat Word List into Subtitles blocks in PostgreSQL
  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    // Group flat words into 7-word subtitle blocks
    const MAX_WORDS = 7;
    const blocks: { start: number; end: number; text: string; words: WordEntry[] }[] = [];
    
    for (let i = 0; i < words.length; i += MAX_WORDS) {
      const chunk = words.slice(i, i + MAX_WORDS);
      const text = chunk.map(w => w.word).join(' ');
      blocks.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        text,
        words: chunk,
      });
    }

    // Insert as Prisma transaction
    await this.prisma.$transaction(
      blocks.map((b) =>
        this.prisma.subtitle.create({
          data: {
            projectId,
            language: 'en',
            timestampStart: b.start,
            timestampEnd: b.end,
            text: b.text,
            wordsJson: b.words as any,
          },
        })
      )
    );
  }
}
