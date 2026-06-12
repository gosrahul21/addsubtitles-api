import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class ProcessingService {
    private audioQueue;
    private prisma;
    constructor(audioQueue: Queue, prisma: PrismaService);
    triggerProcessing(id: string, tokenUser?: any): Promise<{
        message: string;
        jobId: string;
        status: string;
    }>;
}
