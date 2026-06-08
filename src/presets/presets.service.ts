import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';

@Injectable()
export class PresetsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createPreset(userId: string, name: string, styleJson: any) {
    const preset = await this.prisma.preset.create({
      data: {
        userId,
        name,
        styleJson,
      },
    });

    // Invalidate user presets cache
    await this.redisService.del(CACHE_KEYS.USER_PRESETS(userId));
    return preset;
  }

  async getPresetsForUser(userId: string) {
    const cacheKey = CACHE_KEYS.USER_PRESETS(userId);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const presets = await this.prisma.preset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(presets), 3600);
    return presets;
  }

  async deletePreset(userId: string, id: string) {
    const preset = await this.prisma.preset.findFirst({
      where: { id, userId },
    });

    if (!preset) {
      throw new NotFoundException('Preset not found or unauthorized');
    }

    await this.prisma.preset.delete({
      where: { id },
    });

    // Invalidate user presets cache
    await this.redisService.del(CACHE_KEYS.USER_PRESETS(userId));
    return { success: true };
  }
}
