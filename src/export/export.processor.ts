import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DeepgramService, SubtitleBlock, WordEntry } from '../deepgram/deepgram.service';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

@Injectable()
@Processor('rendering')
export class ExportProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private deepgramService: DeepgramService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { exportId, projectId, videoUrl, settings } = job.data;
    const workDir = path.join(os.tmpdir(), `addsubtitles-export-${exportId}`);

    try {
      console.log(`[Job ${job.id}] Rendering subtitles onto video for export: ${exportId}`);

      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }

      // 1. Fetch subtitles from DB
      const dbSubtitles = await this.prisma.subtitle.findMany({
        where: { projectId },
        orderBy: { timestampStart: 'asc' },
      });

      if (dbSubtitles.length === 0) {
        throw new Error('No subtitles found for project');
      }

      // Map to blocks format required by DeepgramService
      const blocks: SubtitleBlock[] = dbSubtitles.map(sub => ({
        start: sub.timestampStart,
        end: sub.timestampEnd,
        words: (sub.wordsJson as any) as WordEntry[]
      }));

      // 2. Generate ASS file
      const fontName = settings?.fontFamily || 'Noto Sans Devanagari';
      const assContent = this.deepgramService.buildAssKaraoke(blocks, fontName);
      const assPath = path.join(workDir, 'subtitles.ass');
      fs.writeFileSync(assPath, assContent, 'utf-8');

      // 3. Burn subtitles into video
      // Note: videoUrl should be reachable by FFmpeg
      const outputVideoPath = path.join(workDir, `rendered-${projectId}.mp4`);
      await this.deepgramService.burnSubtitles(videoUrl, assPath, outputVideoPath);

      // In a real app, upload outputVideoPath to S3 here.
      // Mocked output URL for now
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
    } finally {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }
  }
}
