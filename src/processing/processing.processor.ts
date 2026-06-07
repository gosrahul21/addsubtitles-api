import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { OpenAI } from 'openai';
import { execSync } from 'child_process';

interface SilenceInterval {
  start: number;
  end: number;
}

interface SpeechSegment {
  start: number;
  end: number;
}

interface WordEntry {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  private openai: OpenAI;

  constructor(private prisma: PrismaService) {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'placeholder_openai_key',
    });
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

      // Step 1: Extract main audio channel from source video as raw WAV
      const rawAudioPath = path.join(workDir, 'extracted_full.wav');
      await this.extractAudioChannel(videoUrl, rawAudioPath);
      
      // Get full duration of extracted audio file
      const totalDuration = await this.getAudioDuration(rawAudioPath);
      console.log(`[Job ${job.id}] Audio extracted: ${totalDuration}s long.`);

      // Step 2: Detect silence points in the track
      const silences = await this.detectSilences(rawAudioPath);
      console.log(`[Job ${job.id}] Detected silences:`, silences);

      // Calculate speech segments between silences
      const speechSegments = this.calculateSpeechSegments(silences, totalDuration);
      console.log(`[Job ${job.id}] Slicing plan calculated:`, speechSegments);

      // Step 3: Chop, Transcribe, and Cluster speakers
      const stitchedWords = await this.processSpeechSegmentsTranscription(rawAudioPath, speechSegments, workDir);

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

  // 1. FFmpeg extract audio utility (mono 16kHz WAV format)
  private extractAudioChannel(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
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

  // 4. Calculate speech segments (non-silent parts of the audio)
  private calculateSpeechSegments(silences: SilenceInterval[], totalDuration: number): SpeechSegment[] {
    const segments: SpeechSegment[] = [];
    let currentStart = 0;

    for (const silence of silences) {
      if (silence.start - currentStart > 0.2) {
        segments.push({ start: currentStart, end: silence.start });
      }
      currentStart = silence.end;
    }

    if (totalDuration - currentStart > 0.2) {
      segments.push({ start: currentStart, end: totalDuration });
    }

    if (segments.length === 0) {
      segments.push({ start: 0, end: totalDuration });
    }

    return segments;
  }

  // 5. Slice speech segments, fetch OpenAI Whisper transcriptions, and cluster voices
  private async processSpeechSegmentsTranscription(
    audioPath: string,
    segments: SpeechSegment[],
    workDir: string
  ): Promise<WordEntry[]> {
    const flatWords: WordEntry[] = [];
    const chunkPaths: string[] = [];

    // Slice all chunks first
    for (let i = 0; i < segments.length; i++) {
      const { start, end } = segments[i];
      const duration = end - start;
      const chunkPath = path.join(workDir, `chunk_${i}.wav`);
      chunkPaths.push(chunkPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(audioPath)
          .seekInput(start)
          .duration(duration)
          .audioCodec('pcm_s16le')
          .audioChannels(1)
          .audioFrequency(16000)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(chunkPath);
      });
    }

    // Run Python voice analyzer script to cluster speakers
    let speakerMapping: Record<string, string> = {};
    try {
      const scriptPath = path.join(process.cwd(), 'src/processing/voice_analyzer.py');
      const stdout = execSync(`python3 "${scriptPath}" "${workDir}"`, { encoding: 'utf-8' });
      speakerMapping = JSON.parse(stdout);
    } catch (err) {
      console.error('Failed to run voice analyzer script, defaulting all speakers to A:', err);
    }

    // Transcribe each chunk and assign speaker labels
    for (let i = 0; i < segments.length; i++) {
      const { start } = segments[i];
      const chunkPath = chunkPaths[i];
      
      const words = await this.callOpenAITranscription(chunkPath, start);
      
      const filename = path.basename(chunkPath);
      const speakerLabel = speakerMapping[filename] || 'A';

      for (const w of words) {
        w.speaker = speakerLabel;
      }

      flatWords.push(...words);
    }

    return flatWords;
  }

  // 6. Call OpenAI Audio Transcription API (Whisper-1 with word-level timestamps)
  private async callOpenAITranscription(filePath: string, timeOffset: number): Promise<WordEntry[]> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      });

      const words = (transcription as any).words || [];
      return words.map((w: any) => ({
        word: w.word,
        start: w.start + timeOffset,
        end: w.end + timeOffset,
      }));
    } catch (err) {
      console.error(`[OpenAI Transcription] Failed for file ${filePath}:`, err);
      return [];
    }
  }

  // 7. Save Flat Word List into Subtitles blocks in PostgreSQL
  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    if (words.length === 0) return;

    // Group flat words into 7-word subtitle blocks
    const MAX_WORDS = 7;
    const blocks: { start: number; end: number; text: string; words: WordEntry[]; speaker?: string }[] = [];
    
    for (let i = 0; i < words.length; i += MAX_WORDS) {
      const chunk = words.slice(i, i + MAX_WORDS);
      const text = chunk.map(w => w.word).join(' ');
      blocks.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        text,
        words: chunk,
        speaker: chunk[0].speaker,
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
            speaker: b.speaker || 'A',
          },
        })
      )
    );
  }
}

