"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const dodopayments_1 = require("dodopayments");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const subscription_status_enum_1 = require("../common/types/subscription-status.enum");
const order_status_enum_1 = require("../common/types/order-status.enum");
const payment_gateway_enum_1 = require("../common/types/payment-gateway.enum");
const redis_service_1 = require("../redis/redis.service");
const cache_constants_1 = require("../common/constants/cache.constants");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(configService, prisma, redisService) {
        this.configService = configService;
        this.prisma = prisma;
        this.redisService = redisService;
        this.logger = new common_1.Logger(PaymentsService_1.name);
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        this.webhookLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.File({ filename: path.join(logsDir, 'webhook-events.log') }),
            ],
        });
        const dodoApiKey = this.configService.get('DODO_PAYMENTS_API_KEY') || this.configService.get('DODO_PAYMENT_API_KEY') || 'placeholder_api_key';
        const dodoEnv = (this.configService.get('DODO_ENVIRONMENT') || 'test_mode');
        this.dodoClient = new dodopayments_1.default({
            bearerToken: dodoApiKey,
            environment: dodoEnv,
            webhookKey: this.configService.get('DODO_PAYMENTS_WEBHOOK_KEY') || 'placeholder_webhook_key',
        });
        this.logger.log(`DodoPayments initialized — environment: "${dodoEnv}", key starts with: "${dodoApiKey.slice(0, 8)}..."`);
    }
    async createCheckoutSession(userId, tier) {
        try {
            const PRODUCT_IDS = {
                PRO: this.configService.get('DODO_PRODUCT_ID_PRO') || 'pdt_0Ngcp9nqD81hXQUuLoOq7',
                PRO_PLUS: this.configService.get('DODO_PRODUCT_ID_PRO_PLUS') || 'pdt_0NgcpIepz0KxbzFvGIkYL',
            };
            let productId = PRODUCT_IDS.PRO;
            if (tier === 'PRO') {
                productId = PRODUCT_IDS.PRO;
            }
            else if (tier === 'PRO PLUS' || tier === 'PRO_PLUS') {
                productId = PRODUCT_IDS.PRO_PLUS;
            }
            const returnUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
            const session = await this.dodoClient.checkoutSessions.create({
                product_cart: [{ product_id: productId, quantity: 1 }],
                return_url: `${returnUrl}/payment/success`,
                metadata: {
                    userId,
                    tier,
                },
            });
            return session.checkout_url;
        }
        catch (err) {
            console.log(err);
            throw err;
        }
    }
    async handleWebhookEvent(event) {
        this.logger.log(`Received webhook event: ${event.type}`);
        this.webhookLogger.info(`Received webhook event: ${event.type}`, { event });
        switch (event.type) {
            case 'payment.succeeded':
                await this.handlePaymentSucceeded(event.data);
                break;
            case 'subscription.renewed':
                await this.handleSubscriptionRenewed(event.data);
                break;
            case 'subscription.updated':
            case 'subscription.plan_changed':
                await this.handleSubscriptionUpdated(event.data);
                break;
            case 'subscription.cancelled':
            case 'subscription.expired':
            case 'subscription.past_due':
                await this.handleSubscriptionFailed(event.type, event.data);
                break;
            default:
                this.logger.log(`Unhandled webhook event type: ${event.type}`);
        }
    }
    async handlePaymentSucceeded(data) {
        const userId = data.metadata?.userId;
        const tier = data.metadata?.tier;
        if (!userId || !tier) {
            this.logger.warn('Payment succeeded but missing metadata for user or tier. Cannot upgrade.');
            return;
        }
        try {
            await this.prisma.$transaction(async (tx) => {
                const plan = await tx.subscriptionPlan.findFirst({
                    where: { name: tier },
                });
                if (!plan) {
                    const logsDir = path.join(process.cwd(), 'logs');
                    if (!fs.existsSync(logsDir)) {
                        fs.mkdirSync(logsDir, { recursive: true });
                    }
                    const logFilePath = path.join(logsDir, `failed-plan-${userId}-${tier}-${Date.now()}.log`);
                    const winstonLogger = winston.createLogger({
                        level: 'error',
                        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                        transports: [
                            new winston.transports.File({ filename: logFilePath }),
                        ],
                    });
                    winstonLogger.error(`Failed to upgrade user ${userId} to tier ${tier} because the subscription plan was not found.`, {
                        userId,
                        tier,
                        eventData: data,
                    });
                    winstonLogger.close();
                    throw new Error(`SubscriptionPlan not found for name: ${tier}`);
                }
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + plan.daysCovered);
                await tx.subscription.upsert({
                    where: { userId },
                    update: {
                        subscriptionPlanId: plan.id,
                        startDate,
                        endDate,
                        status: subscription_status_enum_1.SubscriptionStatus.ACTIVE,
                    },
                    create: {
                        userId,
                        subscriptionPlanId: plan.id,
                        startDate,
                        endDate,
                        status: subscription_status_enum_1.SubscriptionStatus.ACTIVE,
                    },
                });
                const amount = data.amount || data.total_amount || plan.price;
                const gatewayOrderId = data.payment_id || data.transaction_id || data.id || null;
                const currency = data.currency || 'USD';
                await tx.order.create({
                    data: {
                        userId,
                        subscriptionPlanId: plan.id,
                        amount,
                        currency,
                        status: order_status_enum_1.OrderStatus.COMPLETED,
                        paymentGateway: payment_gateway_enum_1.PaymentGateway.DODO_PAYMENTS,
                        gatewayOrderId,
                    },
                });
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PROFILE(userId));
            this.logger.log(`User ${userId} successfully upgraded to tier ${tier} with active subscription & completed order.`);
        }
        catch (error) {
            this.logger.error(`Failed to process payment.succeeded for user ${userId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async handleSubscriptionRenewed(data) {
        const userId = data.metadata?.userId || data.customer?.metadata?.userId;
        if (!userId) {
            this.logger.warn('Subscription renewed event received but missing metadata for user.');
            return;
        }
        try {
            await this.prisma.$transaction(async (tx) => {
                const subscription = await tx.subscription.findUnique({
                    where: { userId },
                    include: { plan: true },
                });
                if (!subscription) {
                    this.logger.warn(`No active subscription found for user ${userId} to renew.`);
                    return;
                }
                let endDate = new Date();
                if (data.next_billing_date) {
                    endDate = new Date(data.next_billing_date);
                }
                else {
                    endDate.setDate(endDate.getDate() + subscription.plan.daysCovered);
                }
                await tx.subscription.update({
                    where: { userId },
                    data: {
                        endDate,
                        status: subscription_status_enum_1.SubscriptionStatus.ACTIVE,
                    },
                });
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PROFILE(userId));
            this.logger.log(`User ${userId} subscription renewed successfully.`);
        }
        catch (error) {
            this.logger.error(`Failed to process subscription.renewed for user ${userId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async handleSubscriptionUpdated(data) {
        const userId = data.metadata?.userId || data.customer?.metadata?.userId;
        if (!userId) {
            this.logger.warn('Subscription updated event received but missing metadata for user.');
            return;
        }
        try {
            await this.prisma.$transaction(async (tx) => {
                let newTierName = null;
                if (data.product_id === 'pdt_0Ngcp9nqD81hXQUuLoOq7') {
                    newTierName = 'PRO';
                }
                else if (data.product_id === 'pdt_0Ngcon19xZHgjG4VyFK7Z') {
                    newTierName = 'PRO PLUS';
                }
                let planId = undefined;
                if (newTierName) {
                    const plan = await tx.subscriptionPlan.findFirst({ where: { name: newTierName } });
                    if (plan)
                        planId = plan.id;
                }
                const updateData = {
                    status: data.status === 'active' || data.status === 'trialing' ? subscription_status_enum_1.SubscriptionStatus.ACTIVE : subscription_status_enum_1.SubscriptionStatus.CANCELLED
                };
                if (planId) {
                    updateData.subscriptionPlanId = planId;
                }
                if (data.next_billing_date) {
                    updateData.endDate = new Date(data.next_billing_date);
                }
                await tx.subscription.updateMany({
                    where: { userId },
                    data: updateData,
                });
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PROFILE(userId));
            this.logger.log(`User ${userId} subscription updated successfully (Possible plan change).`);
        }
        catch (error) {
            this.logger.error(`Failed to process subscription.updated for user ${userId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async handleSubscriptionFailed(eventType, data) {
        const userId = data.metadata?.userId;
        if (!userId) {
            this.logger.warn('Subscription event received but missing metadata for user. Cannot downgrade.');
            return;
        }
        const status = eventType === 'subscription.cancelled'
            ? subscription_status_enum_1.SubscriptionStatus.CANCELLED
            : subscription_status_enum_1.SubscriptionStatus.EXPIRED;
        try {
            await this.prisma.$transaction(async (tx) => {
                const subscription = await tx.subscription.findUnique({
                    where: { userId },
                });
                if (subscription) {
                    await tx.subscription.update({
                        where: { userId },
                        data: { status },
                    });
                }
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PROFILE(userId));
            this.logger.log(`User ${userId} subscription status updated to ${status}.`);
        }
        catch (error) {
            this.logger.error(`Failed to process subscription failure (${eventType}) for user ${userId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getPlans() {
        const cacheKey = cache_constants_1.CACHE_KEYS.SUBSCRIPTION_PLANS;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const plans = await this.prisma.subscriptionPlan.findMany({
            orderBy: { price: 'asc' },
        });
        await this.redisService.set(cacheKey, JSON.stringify(plans), 3600);
        return plans;
    }
    async updatePlan(planId, data) {
        const updated = await this.prisma.subscriptionPlan.update({
            where: { id: planId },
            data,
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.SUBSCRIPTION_PLANS);
        return updated;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map