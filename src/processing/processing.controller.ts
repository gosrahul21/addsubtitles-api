import { Controller, Post, Param, BadRequestException, Req } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG } from '../auth/auth.config';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Controller('projects')
export class ProcessingController {
  constructor(
    @InjectQueue('audio-processing') private audioQueue: Queue,
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  private getAuthenticatedUserOrNull(req: Request) {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      return this.jwtService.verify(token, {
        secret: AUTH_CONFIG.jwtAccessSecret,
      });
    } catch {
      return null;
    }
  }

  @Post(':id/process')
  async triggerProcessing(
    @Param('id') id: string,
    @Req() req: Request
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    if (!project.videoUrl) {
      throw new BadRequestException('No video has been uploaded for this project yet');
    }

    // Determine current user context
    const tokenUser = this.getAuthenticatedUserOrNull(req);
    const subscriptionTier = project.user?.subscriptionTier || (tokenUser ? tokenUser.subscriptionTier : 'FREE');

    // Apply 10-processing limit to Free or Guest/Anonymous users
    if (!project.userId || subscriptionTier === 'FREE') {
      let processCount = 0;

      if (project.userId) {
        // Logged-in free tier: Count user's projects that have been processed/completed
        processCount = await this.prisma.project.count({
          where: {
            userId: project.userId,
            status: { in: ['PROCESSING', 'COMPLETED'] },
          },
        });
      } else if (project.sessionId) {
        // Guest user: Count projects sharing the guest session ID
        processCount = await this.prisma.project.count({
          where: {
            sessionId: project.sessionId,
            status: { in: ['PROCESSING', 'COMPLETED'] },
          },
        });
      }

      if (processCount >= AUTH_CONFIG.freeTierMaxProcessingLimit) {
        throw new BadRequestException(
          `Free tier processing limit exceeded (${AUTH_CONFIG.freeTierMaxProcessingLimit} videos maximum). Please upgrade your subscription tier to process subtitles faster!`
        );
      }
    }

    // Set status to processing
    await this.prisma.project.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Enqueue the background transcription job
    const job = await this.audioQueue.add('transcribe-job', {
      projectId: id,
      videoUrl: project.videoUrl,
    });

    return {
      message: 'Processing has been triggered asynchronously',
      jobId: job.id,
      status: 'PROCESSING',
    };
  }
}
