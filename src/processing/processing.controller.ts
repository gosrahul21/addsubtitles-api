import { Controller, Post, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AUTH_CONFIG } from '../auth/auth.config';
import { ProcessingService } from './processing.service';

@Controller('projects')
export class ProcessingController {
  constructor(
    private processingService: ProcessingService,
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
    const tokenUser = this.getAuthenticatedUserOrNull(req);
    return this.processingService.triggerProcessing(id, tokenUser);
  }
}
