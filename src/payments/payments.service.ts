import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import DodoPayments from 'dodopayments';
import { SubscriptionTier } from '@prisma/client';

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

  async createCheckoutSession(userId: string, tier: SubscriptionTier) {
    // Placeholder product IDs based on tier. 
    // In production, these should be real product IDs from your Dodo Payments dashboard.
    let productId = 'prod_placeholder';
    if (tier === SubscriptionTier.PRO) {
      productId = 'prod_pro_placeholder';
    } else if (tier === SubscriptionTier.ENTERPRISE) {
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
        await this.handleSubscriptionFailed(event.data);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handlePaymentSucceeded(data: any) {
    // In a real scenario, you'd extract userId and tier from data.metadata or custom fields
    const userId = data.metadata?.userId;
    const tier = data.metadata?.tier as SubscriptionTier;

    if (!userId || !tier) {
      // logging this information in logger file 
      // with paymentId, date, time, any other identifer to track down the issue.
      this.logger.warn('Payment succeeded but missing metadata for user or tier. Cannot upgrade.');
      return;
    }
   // updating the payment status in user , but we should store it a subcription table for user
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: tier },
    });
    this.logger.log(`User ${userId} successfully upgraded to ${tier}`);
  }

  private async handleSubscriptionFailed(data: any) {
    const userId = data.metadata?.userId;

    if (!userId) {
      this.logger.warn('Subscription event received but missing metadata for user. Cannot downgrade.');
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: SubscriptionTier.FREE },
    });
    this.logger.log(`User ${userId} downgraded to FREE tier due to subscription event.`);
  }
}
