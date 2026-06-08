import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingController } from './processing.controller';
import { ProcessingProcessor } from './processing.processor';
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
  providers: [ProcessingProcessor],
})
export class ProcessingModule {}
