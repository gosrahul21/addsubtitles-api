import { Controller, Post, Put, Get, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Controller('projects')
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private jwtService: JwtService
  ) {}

  // Parse JWT optionally from cookie if present, allowing guest sessions
  private getUserIdOrNull(req: Request): string | null {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
      });
      return payload.sub;
    } catch {
      return null;
    }
  }

  @Post()
  async createProject(
    @Body() dto: CreateProjectDto,
    @Req() req: Request
  ) {
    const userId = this.getUserIdOrNull(req);
    if (!userId && !dto.sessionId) {
      throw new BadRequestException('Either authentication or guest sessionId is required');
    }
    return this.projectsService.createProject(dto, userId);
  }

  @Post(':id/upload')
  async uploadVideo(
    @Param('id') id: string,
    @Body('videoUrl') videoUrl: string
  ) {
    if (!videoUrl) {
      throw new BadRequestException('videoUrl is required');
    }
    return this.projectsService.saveUploadedVideo(id, videoUrl);
  }

  @Put(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.projectsService.updateSettings(id, dto);
  }

  @Get(':id')
  async getProjectDetails(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }
}
