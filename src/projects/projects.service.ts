import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async createProject(dto: CreateProjectDto, userId: string | null) {
    return this.prisma.project.create({
      data: {
        userId,
        sessionId: dto.sessionId || null,
        status: 'PENDING',
      },
    });
  }

  async saveUploadedVideo(projectId: string, videoUrl: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Mock S3 pre-signed link resolving
    // In production, we'd verify metadata or generate S3 signature properties.
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        videoUrl,
      },
    });
  }

  async updateSettings(projectId: string, dto: UpdateSettingsDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        settingsJson: {
          fontSize: dto.fontSize,
          fontColor: dto.fontColor,
          fontFamily: dto.fontFamily,
          zoomLevel: dto.zoomLevel,
        },
      },
    });
  }

  async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { subtitles: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
