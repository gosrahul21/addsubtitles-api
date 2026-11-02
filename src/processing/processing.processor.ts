import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ProcessingService } from './processing.service';

@Injectable()
@Processor('audio-processing')
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);

  constructor(private processingService: ProcessingService) {
    super();
  }

  // Orchestrator method triggered by BullMQ
  async process(job: Job<any, any, string>): Promise<any> {
    const { projectId, audioUrl } = job.data;
    this.logger.log(`[Job ${job.id}] Executing audio processing queue job for project: ${projectId}`);
    return this.processingService.process(projectId, audioUrl);
  }
}
