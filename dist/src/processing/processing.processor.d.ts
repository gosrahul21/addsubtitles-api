import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DeepgramService } from '../deepgram/deepgram.service';
export declare class ProcessingProcessor extends WorkerHost {
    private prisma;
    private redisService;
    private deepgramService;
    constructor(prisma: PrismaService, redisService: RedisService, deepgramService: DeepgramService);
    process(job: Job<any, any, string>): Promise<any>;
    private saveSubtitlesToDb;
}
