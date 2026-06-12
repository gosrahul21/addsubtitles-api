import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';
import { ProjectStatus } from 'src/common/types/project-status.enum';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createProject(dto: CreateProjectDto, userId: string | null) {

    const project = await this.prisma.project.create({
      data: {
        userId,
        language: dto.language,
        sessionId: dto.sessionId || null,
        status: ProjectStatus.PENDING,
      },
    });
    // make sure cache key is stored cleared
    await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(project.id));
    return project;
  }

  async saveUploadedVideo(projectId: string, videoUrl: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Mock S3 pre-signed link resolving
    // In production, we'd verify metadata or generate S3 signature properties.
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        videoUrl,
      },
    });

    await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));
    return updated;
  }

  async updateSettings(projectId: string, dto: UpdateSettingsDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        settingsJson: {
          ...(project.settingsJson as object),
          ...dto,
        },
      },
    });

    await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));
    return updated;
  }

  async getProject(projectId: string) {
    const cacheKey = CACHE_KEYS.PROJECT_DETAILS(projectId);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { subtitle: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.redisService.set(cacheKey, JSON.stringify(project), 3600);
    return project;
  }
}
