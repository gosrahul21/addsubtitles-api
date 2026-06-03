import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingController } from './processing.controller';
import { ProcessingProcessor } from './processing.processor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    // Register the audio queue
    BullModule.registerQueue({
      name: 'audio-processing',
    }),
  ],
  controllers: [ProcessingController],
  providers: [ProcessingProcessor],
})
export class ProcessingModule {}
