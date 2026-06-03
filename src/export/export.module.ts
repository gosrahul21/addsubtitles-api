import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ExportProcessor } from './export.processor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    // Register the rendering queue
    BullModule.registerQueue({
      name: 'rendering',
    }),
  ],
  controllers: [ExportController],
  providers: [ExportService, ExportProcessor],
})
export class ExportModule {}
