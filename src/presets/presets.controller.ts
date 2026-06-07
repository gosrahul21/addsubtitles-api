import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresetsService } from './presets.service';
import { Request } from 'express';

@Controller('presets')
@UseGuards(JwtAuthGuard)
export class PresetsController {
  constructor(private presetsService: PresetsService) {}

  @Post()
  async createPreset(
    @Req() req: any,
    @Body('name') name: string,
    @Body('styleJson') styleJson: any,
  ) {
    if (!name || typeof name !== 'string') {
      throw new BadRequestException('Preset name is required');
    }
    if (!styleJson || typeof styleJson !== 'object') {
      throw new BadRequestException('Style configuration (styleJson) is required');
    }

    const userId = req.user.id;
    return this.presetsService.createPreset(userId, name, styleJson);
  }

  @Get()
  async getPresets(@Req() req: any) {
    const userId = req.user.id;
    return this.presetsService.getPresetsForUser(userId);
  }

  @Delete(':id')
  async deletePreset(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.presetsService.deletePreset(userId, id);
  }
}
