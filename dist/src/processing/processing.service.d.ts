import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { RedisService } from 'src/redis/redis.service';
import { DeepgramService, WordEntry } from 'src/deepgram/deepgram.service';
import { GroqService } from 'src/groq/groq.service';
import { SubscriptionService } from 'src/payments/subscription.service';
export declare class ProcessingService {
    private audioQueue;
    private prisma;
    private projectsService;
    private redisService;
    private deepgramService;
    private groqService;
    private subscriptionService;
    private readonly logger;
    constructor(audioQueue: Queue, prisma: PrismaService, projectsService: ProjectsService, redisService: RedisService, deepgramService: DeepgramService, groqService: GroqService, subscriptionService: SubscriptionService);
    triggerProcessing(id: string): Promise<{
        message: string;
        status: string;
    }>;
    isPaidUser(userId?: string | null): Promise<boolean>;
    transcribeWithFallback(projectId: string, audioUrl: string, language?: string): Promise<WordEntry[]>;
    process(projectId: string, audioUrl: string): Promise<any>;
    private saveSubtitlesToDb;
}
