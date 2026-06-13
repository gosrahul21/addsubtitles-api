import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
export declare class ProcessingService {
    private audioQueue;
    private prisma;
    private projectsService;
    constructor(audioQueue: Queue, prisma: PrismaService, projectsService: ProjectsService);
    triggerProcessing(id: string, tokenUser?: any): Promise<{
        message: string;
        jobId: string;
        status: string;
    }>;
}
