import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class PresetsService {
    private prisma;
    private redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
    createPreset(userId: string, name: string, styleJson: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        userId: string;
        styleJson: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
    }>;
    getPresetsForUser(userId: string): Promise<any>;
    deletePreset(userId: string, id: string): Promise<{
        success: boolean;
    }>;
}
