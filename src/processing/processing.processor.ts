import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { DeepgramService, WordEntry } from '../deepgram/deepgram.service';

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private redisService: RedisService,
    private deepgramService: DeepgramService,
  ) {
    super();
  }

  // Orchestrator method triggered by BullMQ
  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, videoUrl } = job.data;
    const workDir = path.join(os.tmpdir(), `addsubtitles-work-${projectId}`);
    
    try {
      console.log(`[Job ${job.id}] Starting audio transcription pipeline for project: ${projectId}`);
      
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });
      await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));

      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }

      // Step 1: Extract main audio channel from source video as raw WAV
      const rawAudioPath = path.join(workDir, 'extracted_full.wav');
      await this.extractAudioChannel(videoUrl, rawAudioPath);
      
      const totalDuration = await this.getAudioDuration(rawAudioPath);
      console.log(`[Job ${job.id}] Audio extracted: ${totalDuration}s long.`);

      // Step 2: Transcribe using Deepgram (handles utterances automatically)
      const audioBuffer = fs.readFileSync(rawAudioPath);
      const words = await this.deepgramService.transcribeAudio(audioBuffer, 'en');

      // Step 3: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, words);

      // Step 4: Update database project status
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });
      await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));

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

  // 3. Save Flat Word List into Subtitles blocks in PostgreSQL
  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    if (words.length === 0) return;

    // Use DeepgramService to logically group words based on natural pauses
    const groupedBlocks = this.deepgramService.groupIntoBlocks(words);
    
    const dbBlocks = groupedBlocks.map(b => ({
      start: b.start,
      end: b.end,
      text: b.words.map(w => w.word).join(' '),
      words: b.words,
      speaker: b.words[0]?.speaker || 'A',
    }));

    // Insert as Prisma transaction
    await this.prisma.$transaction(
      dbBlocks.map((b) =>
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
