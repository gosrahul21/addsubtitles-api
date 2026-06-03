import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@Processor('rendering')
export class ExportProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { exportId, projectId, videoUrl, settings } = job.data;

    try {
      console.log(`[Job ${job.id}] Rendering subtitles onto video for export: ${exportId}`);

      // Simulate a robust render burn-in process (e.g. ASS Karaoke rendering using FFmpeg)
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 seconds processing

      const secureDownloadUrl = `https://subtitle-s3-bucket.s3.amazonaws.com/exports/rendered-${projectId}.mp4`;

      await this.prisma.export.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          downloadUrl: secureDownloadUrl,
        },
      });

      console.log(`[Job ${job.id}] Export rendered completely. Download link generated.`);
      return { downloadUrl: secureDownloadUrl };
    } catch (err) {
      console.error(`[Job ${job.id}] Rendering failed:`, err);
      await this.prisma.export.update({
        where: { id: exportId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }
}
