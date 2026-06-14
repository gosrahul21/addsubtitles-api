import { Injectable, Logger } from "@nestjs/common";
import { Subscription, SubscriptionPlan } from "@prisma/client";

export type SubscriptionWithPlan = Subscription & { plan: SubscriptionPlan };
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";


@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
    ) { }

    async getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
        try {
            const cacheKey = `user_subscription:${userId}`;
            const cachedPlan = await this.redisService.get(cacheKey);
            if (cachedPlan) {
                return JSON.parse(cachedPlan);
            }
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId: userId },
                include: {
                    plan: true,
                },
            });
            await this.redisService.set(cacheKey, JSON.stringify(subscription));
            return subscription;
        } catch (err) {
            this.logger.error(`Error getting user plan: ${err.message}`);
            return null;
        }
    }
}