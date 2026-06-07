import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PresetsService {
  constructor(private prisma: PrismaService) {}

  async createPreset(userId: string, name: string, styleJson: any) {
    return this.prisma.preset.create({
      data: {
        userId,
        name,
        styleJson,
      },
    });
  }

  async getPresetsForUser(userId: string) {
    return this.prisma.preset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePreset(userId: string, id: string) {
    const preset = await this.prisma.preset.findFirst({
      where: { id, userId },
    });

    if (!preset) {
      throw new NotFoundException('Preset not found or unauthorized');
    }

    return this.prisma.preset.delete({
      where: { id },
    });
  }
}
