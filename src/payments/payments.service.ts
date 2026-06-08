import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import DodoPayments from 'dodopayments';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import { SubscriptionStatus } from '../common/types/subscription-status.enum';
import { OrderStatus } from '../common/types/order-status.enum';
import { PaymentGateway } from '../common/types/payment-gateway.enum';
import { RedisService } from '../redis/redis.service';
import { CACHE_KEYS } from '../common/constants/cache.constants';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  public readonly dodoClient: DodoPayments;
  private readonly webhookLogger: winston.Logger;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.webhookLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.File({ filename: path.join(logsDir, 'webhook-events.log') }),
      ],
    });
    this.dodoClient = new DodoPayments({
      bearerToken: this.configService.get<string>('DODO_PAYMENTS_API_KEY') || this.configService.get<string>('DODO_PAYMENT_API_KEY') || 'placeholder_api_key',
      environment: (this.configService.get<string>('DODO_ENVIRONMENT') || 'test_mode') as any,
      // Webhook key is required to automatically verify webhook signatures via unwrap()
      // @ts-ignore - Some versions of the SDK might expect it, some might not; safe to pass.
      webhookKey: this.configService.get<string>('DODO_PAYMENTS_WEBHOOK_KEY') || 'placeholder_webhook_key',
    });
  }

  async createCheckoutSession(userId: string, tier: string) {
    try{
    // Placeholder product IDs based on tier. 
    // In production, these should be real product IDs from your Dodo Payments dashboard.
    let productId = 'pdt_0Ngcp9nqD81hXQUuLoOq7';
    if (tier === 'PRO') {
      productId = 'pdt_0Ngcp9nqD81hXQUuLoOq7';
    } else if (tier === 'PRO PLUS' || tier === 'PRO_PLUS') {
      productId = 'pdt_0NgcpIepz0KxbzFvGIkYL';
    }

    const returnUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    
    const session = await this.dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${returnUrl}/payment/success`,
      // Use metadata to track which user and tier this checkout is for
      metadata: {
        userId,
        tier,
      },
    });

    return session.checkout_url;
    }catch(err){
      console.log(err);
      throw err
    }

  }

  async handleWebhookEvent(event: any) {
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
        // subscription.updated can mean a plan change or renewal
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

  private async handlePaymentSucceeded(data: any) {
    const userId = data.metadata?.userId;
    const tier = data.metadata?.tier as string;

    if (!userId || !tier) {
      this.logger.warn('Payment succeeded but missing metadata for user or tier. Cannot upgrade.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx: any) => {
        // 1. Find the SubscriptionPlan
        const plan = await tx.subscriptionPlan.findFirst({
          where: { name: tier },
        });

        if (!plan) {
          // Log the event to a file using Winston
          const logsDir = path.join(process.cwd(), 'logs');
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }
          const logFilePath = path.join(logsDir, `failed-plan-${userId}-${tier}-${Date.now()}.log`);

          const winstonLogger = winston.createLogger({
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
            transports: [
              new winston.transports.File({ filename: logFilePath }),
            ],
          });

          winstonLogger.error(`Failed to upgrade user ${userId} to tier ${tier} because the subscription plan was not found.`, {
            userId,
            tier,
            eventData: data,
          });

          // Flush winston stream and close
          winstonLogger.close();

          throw new Error(`SubscriptionPlan not found for name: ${tier}`);
        }

        // 2. Upsert Subscription (1-to-1 with User using userId as primary key)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.daysCovered);

        await tx.subscription.upsert({
          where: { userId },
          update: {
            subscriptionPlanId: plan.id,
            startDate,
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
          create: {
            userId,
            subscriptionPlanId: plan.id,
            startDate,
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        // 3. Create Order
        const amount = data.amount || data.total_amount || plan.price;
        const gatewayOrderId = data.payment_id || data.transaction_id || data.id || null;
        const currency = data.currency || 'USD';

        await tx.order.create({
          data: {
            userId,
            subscriptionPlanId: plan.id,
            amount,
            currency,
            status: OrderStatus.COMPLETED,
            paymentGateway: PaymentGateway.DODO_PAYMENTS,
            gatewayOrderId,
          },
        });

      });

      // Invalidate the user profile cache so the upgrade reflects immediately
      await this.redisService.del(CACHE_KEYS.USER_PROFILE(userId));

      this.logger.log(`User ${userId} successfully upgraded to tier ${tier} with active subscription & completed order.`);
    } catch (error) {
      this.logger.error(`Failed to process payment.succeeded for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSubscriptionRenewed(data: any) {
    const userId = data.metadata?.userId || data.customer?.metadata?.userId;

    if (!userId) {
      this.logger.warn('Subscription renewed event received but missing metadata for user.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx: any) => {
        const subscription = await tx.subscription.findUnique({
          where: { userId },
          include: { plan: true },
        });

        if (!subscription) {
           this.logger.warn(`No active subscription found for user ${userId} to renew.`);
           return;
        }

        // Use next_billing_date from Dodo if available, otherwise just extend by plan days
        let endDate = new Date();
        if (data.next_billing_date) {
          endDate = new Date(data.next_billing_date);
        } else {
          endDate.setDate(endDate.getDate() + subscription.plan.daysCovered);
        }

        await tx.subscription.update({
          where: { userId },
          data: {
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
        });
      });

      // Invalidate the user profile cache so the new end date reflects immediately
      await this.redisService.del(CACHE_KEYS.USER_PROFILE(userId));

      this.logger.log(`User ${userId} subscription renewed successfully.`);
    } catch (error) {
      this.logger.error(`Failed to process subscription.renewed for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSubscriptionUpdated(data: any) {
    const userId = data.metadata?.userId || data.customer?.metadata?.userId;

    if (!userId) {
      this.logger.warn('Subscription updated event received but missing metadata for user.');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx: any) => {
        // Determine tier from product_id if the user upgraded/downgraded via billing portal
        let newTierName = null;
        if (data.product_id === 'pdt_0Ngcp9nqD81hXQUuLoOq7') {
          newTierName = 'PRO';
        } else if (data.product_id === 'pdt_0Ngcon19xZHgjG4VyFK7Z') {
          newTierName = 'PRO PLUS';
        }

        let planId = undefined;
        if (newTierName) {
           const plan = await tx.subscriptionPlan.findFirst({ where: { name: newTierName } });
           if (plan) planId = plan.id;
        }

        const updateData: any = {
           status: data.status === 'active' || data.status === 'trialing' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELLED
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

      // Invalidate cache so the new plan reflects in the frontend
      await this.redisService.del(CACHE_KEYS.USER_PROFILE(userId));
      this.logger.log(`User ${userId} subscription updated successfully (Possible plan change).`);
    } catch (error) {
      this.logger.error(`Failed to process subscription.updated for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSubscriptionFailed(eventType: string, data: any) {
    const userId = data.metadata?.userId;

    if (!userId) {
      this.logger.warn('Subscription event received but missing metadata for user. Cannot downgrade.');
      return;
    }

    const status = eventType === 'subscription.cancelled'
      ? SubscriptionStatus.CANCELLED
      : SubscriptionStatus.EXPIRED;

    try {
      await this.prisma.$transaction(async (tx: any) => {
        // 1. Update subscription status if exists
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

      // Invalidate user cache on downgrade/cancel
      await this.redisService.del(CACHE_KEYS.USER_PROFILE(userId));

      this.logger.log(`User ${userId} subscription status updated to ${status}.`);
    } catch (error) {
      this.logger.error(`Failed to process subscription failure (${eventType}) for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlans() {
    const cacheKey = CACHE_KEYS.SUBSCRIPTION_PLANS;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const plans = await (this.prisma as any).subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    // Cache for 1 hour (3600 seconds)
    await this.redisService.set(cacheKey, JSON.stringify(plans), 3600);

    return plans;
  }

  async updatePlan(planId: string, data: any) {
    const updated = await (this.prisma as any).subscriptionPlan.update({
      where: { id: planId },
      data,
    });

    // Invalidate the cache so the frontend sees the new pricing matrix immediately
    await this.redisService.del(CACHE_KEYS.SUBSCRIPTION_PLANS);

    return updated;
  }
}
