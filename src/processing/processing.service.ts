import { Injectable, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG } from '../auth/auth.config';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatus } from '../common/types/project-status.enum';
import { RedisService } from 'src/redis/redis.service';
import { CACHE_KEYS } from 'src/common/constants/cache.constants';
import { DeepgramService, WordEntry } from 'src/deepgram/deepgram.service';
import { GroqService } from 'src/groq/groq.service';
import { SubscriptionService } from 'src/payments/subscription.service';
import { resolveLanguageCode } from 'src/common/constants/language.config';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectQueue('audio-processing') private audioQueue: Queue,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private projectsService: ProjectsService,
    private redisService: RedisService,
    private deepgramService: DeepgramService,
    private groqService: GroqService,
    private subscriptionService: SubscriptionService,
  ) {}

  async triggerProcessing(id: string) {
    const audioUrl = await this.projectsService.getTempAudioUrl(id);
    if (!audioUrl) {
      throw new BadRequestException('No audio has been uploaded for this project yet');
    }

    // Set status to processing
    const project = await this.projectsService.updateProjectStatus(id, ProjectStatus.PROCESSING);

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Trigger processing pipeline
    this.process(id, audioUrl);

    return {
      message: 'Processing has been triggered asynchronously',
      status: 'PROCESSING',
    };
  }

  /**
   * Checks if project belongs to a paid subscriber
   */
  async isPaidUser(userId?: string | null): Promise<boolean> {
    if (!userId) return false;
    try {
      const subscription = await this.subscriptionService.getUserSubscription(userId);
      if (!subscription) return false;

      const isStatusActive = subscription.status === 'active';
      const isNotExpired = subscription.endDate ? new Date(subscription.endDate) > new Date() : true;
      const isPaidPlan = subscription.plan?.name && subscription.plan.name !== 'FREE';

      return !!(isStatusActive && isNotExpired && isPaidPlan);
    } catch (err: any) {
      this.logger.error(`Error checking user subscription: ${err.message}`);
      return false;
    }
  }

  /**
   * Smart STT Transcriber:
   * 1. Paid users -> Deepgram Nova (direct)
   * 2. Free users -> Groq Whisper (free, blazing fast)
   * 3. Fallback -> Deepgram if Groq fails or rate limits
   */
  async transcribeWithFallback(projectId: string, audioUrl: string, language: string = 'en'): Promise<WordEntry[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    const isPaid = await this.isPaidUser(project?.userId);

    if (isPaid) {
      this.logger.log(`[Job ${projectId}] Paid subscriber detected. Transcribing directly with Deepgram: ${audioUrl}`);
      return this.deepgramService.transcribeUrl(audioUrl, language);
    }

    // Free / Guest user flow
    this.logger.log(`[Job ${projectId}] Free user/guest detected. Attempting Groq Whisper Large v3...`);
    try {
      if (!this.groqService.isAvailable()) {
        throw new Error('Groq API key not configured or client unavailable');
      }

      const words = await this.groqService.transcribeUrl(audioUrl, language);
      if (!words || words.length === 0) {
        throw new Error('Groq Whisper returned empty word list');
      }

      this.logger.log(`[Job ${projectId}] Groq Whisper transcription succeeded (${words.length} words).`);
      return words;
    } catch (groqErr: any) {
      this.logger.warn(
        `[Job ${projectId}] Groq Whisper failed (${groqErr.message}). Seamlessly falling back to Deepgram...`
      );
      return this.deepgramService.transcribeUrl(audioUrl, language);
    }
  }

  // Orchestrator method
  async process(projectId: string, audioUrl: string): Promise<any> {
    try {
      this.logger.log(`Starting audio transcription pipeline for project: ${projectId}`);
      this.logger.log(`audioUrl: ${audioUrl}`);

      const project = await this.projectsService.updateProjectStatus(projectId, ProjectStatus.PROCESSING);

      // Step 1: Transcribe with Groq (free) + fallback to Deepgram (or Deepgram directly for paid users)
      const words = await this.transcribeWithFallback(projectId, audioUrl, project.language || 'en');

      // Step 2: Save subtitles to Database
      await this.saveSubtitlesToDb(projectId, words);

      // Step 3: Update database project status
      await this.projectsService.updateProjectStatus(projectId, ProjectStatus.COMPLETED);

      this.logger.log(`[Job ${projectId}] Pipeline finished successfully for Project: ${projectId}`);
    } catch (err: any) {
      this.logger.error(`[Job ${projectId}] Pipeline failed: ${err.message}`, err.stack);
      await this.projectsService.updateProjectStatus(projectId, ProjectStatus.FAILED);
      throw err;
    }
  }

  private async saveSubtitlesToDb(projectId: string, words: WordEntry[]) {
    if (!words || words.length === 0) return;

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

    // Insert or update Subtitle document
    await this.prisma.subtitle.upsert({
      where: { projectId },
      update: {
        subtitlesJson: dbBlocks as any,
      },
      create: {
        projectId,
        subtitlesJson: dbBlocks as any,
      },
    });
  }
}
