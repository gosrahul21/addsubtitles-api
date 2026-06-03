import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ExportService {
  constructor(
    @InjectQueue('rendering') private renderingQueue: Queue,
    private prisma: PrismaService
  ) {}

  async triggerExport(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { subtitles: true },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }
    if (project.subtitles.length === 0) {
      throw new BadRequestException('Project has no generated subtitles. Process the project first.');
    }

    // Initialize or get the export record
    const exportRecord = await this.prisma.export.create({
      data: {
        projectId,
        status: 'PROCESSING',
      },
    });

    // Add to rendering queue
    const job = await this.renderingQueue.add('render-job', {
      exportId: exportRecord.id,
      projectId,
      videoUrl: project.videoUrl,
      settings: project.settingsJson,
    });

    return {
      message: 'Export rendering has been triggered asynchronously',
      exportId: exportRecord.id,
      jobId: job.id,
      status: 'PROCESSING',
    };
  }

  async getExportStatus(projectId: string) {
    const latestExport = await this.prisma.export.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestExport) {
      return { status: 'PENDING', downloadUrl: null };
    }

    return {
      exportId: latestExport.id,
      status: latestExport.status,
      downloadUrl: latestExport.downloadUrl,
    };
  }
}
