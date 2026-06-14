import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG } from '../auth/auth.config';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatus } from '../common/types/project-status.enum';
import { RedisService } from 'src/redis/redis.service';
import { CACHE_KEYS } from 'src/common/constants/cache.constants';
import { DeepgramService, WordEntry } from 'src/deepgram/deepgram.service';
import { resolveLanguageCode } from 'src/common/constants/language.config';

@Injectable()
export class ProcessingService {
  constructor(
    @InjectQueue('audio-processing') private audioQueue: Queue,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private projectsService: ProjectsService,
    private redisService: RedisService,
        private deepgramService: DeepgramService,
  ) { }

  async triggerProcessing(id: string) {
    const audioUrl = await this.projectsService.getTempAudioUrl(id);
    if (!audioUrl) {
      throw new BadRequestException("No audio has been uploaded for this project yet");
    }

    // Determine current user context
    // const subscriptionTier = project.user?.subscription?.plan?.name || (tokenUser ? tokenUser.subscriptionTier : 'FREE');

    // // Apply 10-processing limit to Free or Guest/Anonymous users
    // if (!project.userId || subscriptionTier === 'FREE') {
    //   let processCount = 0;

    //   if (project.userId) {
    //     // Logged-in free tier: Count user's projects that have been processed/completed
    //     processCount = await this.prisma.project.count({
    //       where: {
    //         userId: project.userId,
    //         status: { in: ['PROCESSING', 'COMPLETED'] },
    //       },
    //     });
    //   } else if (project.sessionId) {
    //     // Guest user: Count projects sharing the guest session ID
    //     processCount = await this.prisma.project.count({
    //       where: {
    //         sessionId: project.sessionId,
    //         status: { in: ['PROCESSING', 'COMPLETED'] },
    //       },
    //     });
    //   }

    //   if (processCount >= AUTH_CONFIG.freeTierMaxProcessingLimit) {
    //     // throw new BadRequestException(
    //     //   `Free tier processing limit exceeded (${AUTH_CONFIG.freeTierMaxProcessingLimit} videos maximum). Please upgrade your subscription tier to process subtitles faster!`
    //     // );
    //   }
    // }

    // Set status to processing
    const project = await this.projectsService.updateProjectStatus(id, ProjectStatus.PROCESSING);

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Enqueue the background transcription job
      // const job = await this.audioQueue.add('transcribe-job', {
      //   projectId: id,
      //   audioUrl: audioUrl,
      // });
      this.process(id, audioUrl);

    return {
      message: 'Processing has been triggered asynchronously',
      // jobId: job.id,
      status: 'PROCESSING',
    };
  }

  // Orchestrator method triggered by BullMQ
  async process(projectId, audioUrl): Promise<any> {
    try {
      console.log(`[Starting audio transcription pipeline for project: ${projectId}`);
      console.log(`[audioUrl: ${audioUrl}`);

      const project = await this.projectsService.updateProjectStatus(projectId,
        ProjectStatus.PROCESSING
      )

      console.log(project)

      // Check for tempUrl in Redis
      // const tempUrlCacheKey = `project:${projectId}:tempUrl`;
      // const tempAudioUrl = await this.redisService.get(tempUrlCacheKey);
      // const transcriptionUrl = tempAudioUrl || videoUrl;

      // Step 1: Transcribe directly from URL using Deepgram
      console.log(`[Job ${projectId}] Sending URL directly to Deepgram: ${audioUrl}`);
      const words = await this.deepgramService.transcribeUrl(audioUrl, project.language || 'en');

      // Step 2: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, words);
      console.log('words', words)

      // Clean up tempUrl
      // if (audioUrl) {
      //   await this.redisService.del(audioUrl);
      // }

      // Step 3: Update database project status
      await this.projectsService.updateProjectStatus(projectId, ProjectStatus.COMPLETED);

      console.log(`[Job ${projectId}] Pipeline finished successfully for Project: ${projectId}`);
    } catch (err) {
      console.error(`[Job ${projectId}] Pipeline failed:`, err);
      await this.projectsService.updateProjectStatus(projectId, ProjectStatus.FAILED);
      throw err;
    }
  }


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
