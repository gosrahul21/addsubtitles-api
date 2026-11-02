import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class ViewsService {
    private readonly prisma;
    private readonly redisService;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService);
    private getRedisKey;
    private hasPageViewDelegate;
    incrementView(entityType: string, slug: string): Promise<number>;
    getViewCount(entityType: string, slug: string): Promise<number>;
    getAllViews(entityType?: string): Promise<Record<string, number>>;
}
