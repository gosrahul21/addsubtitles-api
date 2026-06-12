import { Controller, Post, Put, Get, Body, Param, Req, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ProcessingService } from '../processing/processing.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private jwtService: JwtService,
    private processingService: ProcessingService
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

  private getAuthenticatedUserOrNull(req: Request) {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
      });
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

  @Get('cloudinary-signature')
  getCloudinarySignature() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloudinary credentials are not properly configured.');
    }

    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
    };
  }

  @Post(':id/upload')
  async uploadVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Body('videoUrl') videoUrl?: string,
  ) {
    if (!videoUrl) {
      throw new BadRequestException('videoUrl is required');
    }

    const result = await this.projectsService.saveUploadedVideo(id, videoUrl);

    if (result) {
      const tokenUser = this.getAuthenticatedUserOrNull(req);
      await this.processingService.triggerProcessing(id, tokenUser);
      return result;
    }
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
