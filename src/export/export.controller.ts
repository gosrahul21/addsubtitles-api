import { Controller, Post, Get, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post(':id/export')
  @UseGuards(JwtAuthGuard) // Authenticated only to control render workloads
  async exportProject(@Param('id') id: string) {
    return this.exportService.triggerExport(id);
  }

  @Get(':id/export/status')
  async getExportStatus(@Param('id') id: string) {
    return this.exportService.getExportStatus(id);
  }
}
