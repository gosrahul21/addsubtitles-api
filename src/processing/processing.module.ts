import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingController } from './processing.controller';
import { ProcessingProcessor } from './processing.processor';
import { ProcessingService } from './processing.service';
import { AuthModule } from '../auth/auth.module';

import { DeepgramModule } from '../deepgram/deepgram.module';

@Module({
  imports: [
    AuthModule,
    DeepgramModule,
    // Register the audio queue
    BullModule.registerQueue({
      name: 'audio-processing',
    }),
  ],
  controllers: [ProcessingController],
  providers: [ProcessingProcessor, ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
