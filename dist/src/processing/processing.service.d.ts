import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { RedisService } from 'src/redis/redis.service';
import { DeepgramService } from 'src/deepgram/deepgram.service';
export declare class ProcessingService {
    private audioQueue;
    private prisma;
    private projectsService;
    private redisService;
    private deepgramService;
    constructor(audioQueue: Queue, prisma: PrismaService, projectsService: ProjectsService, redisService: RedisService, deepgramService: DeepgramService);
    triggerProcessing(id: string): Promise<{
        message: string;
        status: string;
    }>;
    process(projectId: any, audioUrl: any): Promise<any>;
    private saveSubtitlesToDb;
}
