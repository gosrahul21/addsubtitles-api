import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import DodoPayments from 'dodopayments';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  public readonly dodoClient: DodoPayments;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.dodoClient = new DodoPayments({
      bearerToken: this.configService.get<string>('DODO_PAYMENTS_API_KEY') || 'placeholder_api_key',
      // Webhook key is required to automatically verify webhook signatures via unwrap()
      // @ts-ignore - Some versions of the SDK might expect it, some might not; safe to pass.
      webhookKey: this.configService.get<string>('DODO_PAYMENTS_WEBHOOK_KEY') || 'placeholder_webhook_key',
    });
  }

  async createCheckoutSession(userId: string, tier: string) {
    // Placeholder product IDs based on tier. 
    // In production, these should be real product IDs from your Dodo Payments dashboard.
    let productId = 'prod_placeholder';
    if (tier === 'PRO') {
      productId = 'prod_pro_placeholder';
    } else if (tier === 'ENTERPRISE') {
      productId = 'prod_enterprise_placeholder';
    }

    const session = await this.dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      // Use metadata to track which user and tier this checkout is for
      metadata: {
        userId,
        tier,
      },
    });

    return session.checkout_url;
  }

  async handleWebhookEvent(event: any) {
    this.logger.log(`Received webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(event.data);
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

    // Default plan seeding attributes based on the tier
    let price = 19.00;
    let daysCovered = 30;
    if (tier === 'ENTERPRISE') {
      price = 99.00;
    } else if (tier === 'FREE') {
      price = 0.00;
      daysCovered = 99999;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Find or dynamically seed the SubscriptionPlan
        let plan = await tx.subscriptionPlan.findFirst({
          where: { name: tier },
        });

        if (!plan) {
          plan = await tx.subscriptionPlan.create({
            data: {
              name: tier,
              price,
              daysCovered,
            },
          });
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
            status: 'active',
          },
          create: {
            userId,
            subscriptionPlanId: plan.id,
            startDate,
            endDate,
            status: 'active',
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
            status: 'completed',
            paymentGateway: 'DODO_PAYMENTS',
            gatewayOrderId,
          },
        });

        // 4. Update the user's tier status field
        await tx.user.update({
          where: { id: userId },
          data: { subscriptionTier: tier },
        });
      });

      this.logger.log(`User ${userId} successfully upgraded to tier ${tier} with active subscription & completed order.`);
    } catch (error) {
      this.logger.error(`Failed to process payment.succeeded for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSubscriptionFailed(eventType: string, data: any) {
    const userId = data.metadata?.userId;

    if (!userId) {
      this.logger.warn('Subscription event received but missing metadata for user. Cannot downgrade.');
      return;
    }

    const status = eventType === 'subscription.cancelled' ? 'cancelled' : 'expired';

    try {
      await this.prisma.$transaction(async (tx) => {
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

        // 2. Reset user subscription tier to FREE
        await tx.user.update({
          where: { id: userId },
          data: { subscriptionTier: 'FREE' },
        });
      });

      this.logger.log(`User ${userId} subscription status updated to ${status} and tier reset to FREE.`);
    } catch (error) {
      this.logger.error(`Failed to process subscription failure (${eventType}) for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
