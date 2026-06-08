import { Controller, Post, Put, Get, Body, Param, Req, UseGuards, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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
  @UseInterceptors(
    FileInterceptor('audioFile', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(os.tmpdir(), 'addsubtitles-uploads');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname || '.wav')}`);
        },
      }),
    }),
  )
  async uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file?: any,
    @Body('videoUrl') videoUrl?: string,
  ) {
    if (file) {
      // If a file was uploaded, we save its absolute path as the 'videoUrl'
      const absolutePath = path.resolve(file.path);
      return this.projectsService.saveUploadedVideo(id, absolutePath);
    }
    
    if (videoUrl) {
      return this.projectsService.saveUploadedVideo(id, videoUrl);
    }

    throw new BadRequestException('Either an audioFile or videoUrl is required');
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
