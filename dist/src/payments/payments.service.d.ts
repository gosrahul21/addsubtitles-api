import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import DodoPayments from 'dodopayments';
import { RedisService } from '../redis/redis.service';
export declare class PaymentsService {
    private configService;
    private prisma;
    private redisService;
    private readonly logger;
    readonly dodoClient: DodoPayments;
    private readonly webhookLogger;
    constructor(configService: ConfigService, prisma: PrismaService, redisService: RedisService);
    createCheckoutSession(userId: string, tier: string): Promise<string>;
    handleWebhookEvent(event: any): Promise<void>;
    private handlePaymentSucceeded;
    private handleSubscriptionRenewed;
    private handleSubscriptionUpdated;
    private handleSubscriptionFailed;
    getPlans(): Promise<any>;
    updatePlan(planId: string, data: any): Promise<any>;
}
