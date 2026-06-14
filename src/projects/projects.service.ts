import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';
import { ProjectStatus } from 'src/common/types/project-status.enum';
import { ProcessingService } from 'src/processing/processing.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private readonly processingService: ProcessingService,
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

    // In production, we'd verify metadata or generate S3 signature properties.
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        videoUrl,
      },
    });

    await this.delProjectCache(projectId)
    return updated;
  }

  async delProjectCache(projectId: string){
    await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));
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

    await this.delProjectCache(projectId);
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

  async getTempAudioUrl(projectId: string){
    const cacheKey = CACHE_KEYS.TEMP_AUDIO_URL(projectId);
    // Store temporarily in Redis for 1 hour (3600 seconds)
    const audioUrl = await this.redisService.get(cacheKey);
    if(!audioUrl){
      throw new NotFoundException("No audio found");
    }
    return audioUrl;
  }

  async saveTempAudioUrl(projectId: string, audioUrl: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const cacheKey = CACHE_KEYS.TEMP_AUDIO_URL(projectId);
    // Store temporarily in Redis for 1 hour (3600 seconds)
    await this.redisService.set(cacheKey, audioUrl, 3600);
    await this.processingService.triggerProcessing(projectId);
    return { message: 'Temporary audio URL saved successfully' };
  }

  async getUserProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return projects;
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status },
    });
    await this.redisService.del(CACHE_KEYS.PROJECT_DETAILS(projectId));
    return project;
  }

}
