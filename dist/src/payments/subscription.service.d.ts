import { Subscription, SubscriptionPlan } from "@prisma/client";
export type SubscriptionWithPlan = Subscription & {
    plan: SubscriptionPlan;
};
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
export declare class SubscriptionService {
    private readonly prisma;
    private readonly redisService;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService);
    getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null>;
}
