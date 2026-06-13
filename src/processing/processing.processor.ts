import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';
import { DeepgramService, WordEntry } from '../deepgram/deepgram.service';
import { resolveLanguageCode } from 'src/common/constants/language.config';

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private deepgramService: DeepgramService,
  ) {
    super();
  }

  // Orchestrator method triggered by BullMQ
  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, videoUrl } = job.data;
    
    try {
      console.log(`[Job ${job.id}] Starting audio transcription pipeline for project: ${projectId}`);
      console.log(`[Job ${job.id}] videoUrl: ${videoUrl}`);
      
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });
      await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));

      // Check for tempUrl in Redis
      const tempUrlCacheKey = `project:${projectId}:tempUrl`;
      const tempAudioUrl = await this.redisService.get(tempUrlCacheKey);
      const transcriptionUrl = tempAudioUrl || videoUrl;

      // Step 1: Transcribe directly from URL using Deepgram
      console.log(`[Job ${job.id}] Sending URL directly to Deepgram: ${transcriptionUrl}`);
      const words = await this.deepgramService.transcribeUrl(transcriptionUrl, resolveLanguageCode(project.language || 'en'));

      // Step 2: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, words);

      // Clean up tempUrl
      if (tempAudioUrl) {
        await this.redisService.del(tempUrlCacheKey);
      }

      // Step 3: Update database project status
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
    }
  }


  // 3. Save word-level timings (wordsJson) into Subtitle blocks in PostgreSQL.
  //    We preserve exact Deepgram timestamps on every word — no redistribution.
  //    The frontend uses wordsJson directly for karaoke highlighting and converts
  //    to SRT/VTT/ASS on download.
  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    if (words.length === 0) return;

    // Group into natural subtitle blocks (respects pauses, word count, duration caps)
    const groupedBlocks = this.deepgramService.groupIntoBlocks(words);

    const { randomUUID } = require('crypto');
    const dbBlocks = groupedBlocks.map((b) => ({
      id: randomUUID(),
      language: 'en',
      timestampStart: b.start,
      timestampEnd: b.end,
      text: b.words.map((w) => w.word).join(' '),
      wordsJson: b.words,
      speaker: b.words[0]?.speaker || 'A',
    }));

    // Insert single Subtitle document
    await this.prisma.subtitle.create({
      data: {
        projectId,
        subtitlesJson: dbBlocks as any,
      },
    });
  }
}
