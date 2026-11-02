import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ViewsService {
  private readonly logger = new Logger(ViewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getRedisKey(entityType: string, slug: string): string {
    return `page_views:${entityType.toLowerCase()}:${slug.toLowerCase()}`;
  }

  /**
   * Increment view count for a blog or tool atomically in Redis and persist to DB
   */
  async incrementView(entityType: string, slug: string): Promise<number> {
    const normType = entityType.toLowerCase().trim();
    const normSlug = slug.toLowerCase().trim();
    const redisKey = this.getRedisKey(normType, normSlug);

    try {
      // Check if Redis key already exists
      const existingRedisVal = await this.redisService.get(redisKey);

      let currentCount: number;

      if (existingRedisVal === null) {
        // Cold start in Redis: check DB first to preserve existing count
        const dbRecord = await this.prisma.pageView.findUnique({
          where: { slug: normSlug },
        });

        const initialCount = dbRecord ? dbRecord.views : 0;
        currentCount = initialCount + 1;
        await this.redisService.set(redisKey, currentCount.toString());
      } else {
        // Atomic increment in Redis
        currentCount = await this.redisService.incr(redisKey);
      }

      // Asynchronously upsert to PostgreSQL so database writes never block responses
      this.prisma.pageView
        .upsert({
          where: { slug: normSlug },
          update: { views: currentCount },
          create: {
            entityType: normType,
            slug: normSlug,
            views: currentCount,
          },
        })
        .catch((dbErr) => {
          this.logger.error(`Failed to sync view count to DB for ${normSlug}: ${dbErr.message}`);
        });

      return currentCount;
    } catch (err: any) {
      this.logger.error(`Error in incrementView for ${normSlug}: ${err.message}`);
      // Fallback directly to DB
      const record = await this.prisma.pageView.upsert({
        where: { slug: normSlug },
        update: { views: { increment: 1 } },
        create: { entityType: normType, slug: normSlug, views: 1 },
      });
      return record.views;
    }
  }

  /**
   * Get current view count for a specific tool or blog
   */
  async getViewCount(entityType: string, slug: string): Promise<number> {
    const normType = entityType.toLowerCase().trim();
    const normSlug = slug.toLowerCase().trim();
    const redisKey = this.getRedisKey(normType, normSlug);

    // 1. Check Redis first
    const cached = await this.redisService.get(redisKey);
    if (cached !== null) {
      return parseInt(cached, 10) || 0;
    }

    // 2. Fallback to PostgreSQL
    const record = await this.prisma.pageView.findUnique({
      where: { slug: normSlug },
    });

    const count = record ? record.views : 0;
    // Populate Redis cache
    await this.redisService.set(redisKey, count.toString());
    return count;
  }

  /**
   * Get batch view counts for an entity type (e.g. all tools or all blogs)
   */
  async getAllViews(entityType?: string): Promise<Record<string, number>> {
    const whereClause = entityType ? { entityType: entityType.toLowerCase().trim() } : {};

    const records = await this.prisma.pageView.findMany({
      where: whereClause,
      select: { slug: true, views: true },
    });

    const result: Record<string, number> = {};
    for (const r of records) {
      result[r.slug] = r.views;
    }

    return result;
  }
}
