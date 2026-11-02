import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProcessingService } from './processing.service';
export declare class ProcessingProcessor extends WorkerHost {
    private processingService;
    private readonly logger;
    constructor(processingService: ProcessingService);
    process(job: Job<any, any, string>): Promise<any>;
}
