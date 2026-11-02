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
   * Safely check if pageView delegate is present on the Prisma client
   */
  private hasPageViewDelegate(): boolean {
    return !!(this.prisma && (this.prisma as any).pageView);
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
        // Cold start in Redis: check DB first to preserve existing count if delegate exists
        let initialCount = 0;
        if (this.hasPageViewDelegate()) {
          try {
            const dbRecord = await (this.prisma as any).pageView.findUnique({
              where: { slug: normSlug },
            });
            if (dbRecord) initialCount = dbRecord.views;
          } catch (dbErr: any) {
            this.logger.warn(`Cold-start DB check failed for ${normSlug}: ${dbErr.message}`);
          }
        }

        currentCount = initialCount + 1;
        await this.redisService.set(redisKey, currentCount.toString());
      } else {
        // Atomic increment in Redis
        currentCount = await this.redisService.incr(redisKey);
      }

      // Asynchronously upsert to PostgreSQL so database writes never block responses
      if (this.hasPageViewDelegate()) {
        (this.prisma as any).pageView
          .upsert({
            where: { slug: normSlug },
            update: { views: currentCount },
            create: {
              entityType: normType,
              slug: normSlug,
              views: currentCount,
            },
          })
          .catch((dbErr: any) => {
            this.logger.error(`Failed to sync view count to DB for ${normSlug}: ${dbErr.message}`);
          });
      } else {
        this.logger.warn(
          `Prisma pageView model not generated yet in current client. View counted in Redis: ${currentCount}`
        );
      }

      return currentCount;
    } catch (err: any) {
      this.logger.error(`Error in incrementView for ${normSlug}: ${err.message}`);

      // Fallback directly to DB if delegate exists
      if (this.hasPageViewDelegate()) {
        try {
          const record = await (this.prisma as any).pageView.upsert({
            where: { slug: normSlug },
            update: { views: { increment: 1 } },
            create: { entityType: normType, slug: normSlug, views: 1 },
          });
          return record.views;
        } catch (dbErr: any) {
          this.logger.error(`DB fallback upsert also failed: ${dbErr.message}`);
        }
      }

      return 1;
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

    // 2. Fallback to PostgreSQL if delegate exists
    if (this.hasPageViewDelegate()) {
      try {
        const record = await (this.prisma as any).pageView.findUnique({
          where: { slug: normSlug },
        });

        const count = record ? record.views : 0;
        await this.redisService.set(redisKey, count.toString());
        return count;
      } catch (dbErr: any) {
        this.logger.warn(`Failed to read view count from DB: ${dbErr.message}`);
      }
    }

    return 0;
  }

  /**
   * Get batch view counts for an entity type (e.g. all tools or all blogs)
   */
  async getAllViews(entityType?: string): Promise<Record<string, number>> {
    if (!this.hasPageViewDelegate()) {
      return {};
    }

    try {
      const whereClause = entityType ? { entityType: entityType.toLowerCase().trim() } : {};
      const records = await (this.prisma as any).pageView.findMany({
        where: whereClause,
        select: { slug: true, views: true },
      });

      const result: Record<string, number> = {};
      for (const r of records) {
        result[r.slug] = r.views;
      }

      return result;
    } catch (err: any) {
      this.logger.error(`Failed to getAllViews: ${err.message}`);
      return {};
    }
  }
}
