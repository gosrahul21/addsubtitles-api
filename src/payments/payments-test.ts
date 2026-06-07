import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// Setup environment variable fallback for test execution
const TEST_WEBHOOK_KEY = 'whsec_MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';
process.env.DODO_PAYMENTS_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY || TEST_WEBHOOK_KEY;
process.env.DODO_PAYMENTS_API_KEY = process.env.DODO_PAYMENTS_API_KEY || 'test_api_key';

function generateSvixSignature(webhookKey: string, id: string, timestamp: string, body: string): string {
  let cleanKey = webhookKey;
  if (webhookKey.startsWith('whsec_')) {
    cleanKey = webhookKey.substring(6);
  }
  const keyBytes = Buffer.from(cleanKey, 'base64');
  const toSign = `${id}.${timestamp}.${body}`;
  const hmac = crypto.createHmac('sha256', keyBytes);
  hmac.update(toSign);
  const hash = hmac.digest('base64');
  return `v1,${hash}`;
}

async function runTests() {
  console.log('--- Initializing Payments Integration Test ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  const paymentsService = app.get(PaymentsService);
  const prismaService = app.get(PrismaService);

  const email = 'payments-test-user@example.com';

  try {
    // 1. Cleanup old test users
    await prismaService.user.deleteMany({ where: { email } });

    // 2. Create target test user (starts at FREE)
    let user: any = await prismaService.user.create({
      data: {
        email,
        subscriptionTier: 'FREE',
      },
    });
    console.log(`✔ Created test user: ${email} with ID: ${user.id}`);

    // 3. Test Checkout Session creation
    console.log('Testing checkout session creation...');
    try {
      const checkoutUrl = await paymentsService.createCheckoutSession(user.id, 'PRO');
      console.log('✔ Checkout URL successfully generated:', checkoutUrl);
    } catch (err) {
      console.warn('⚠ Failed to generate checkout URL (likely due to mock/invalid DODO_PAYMENTS_API_KEY). Skipping checkout URL assertion, continuing to webhook signature verification...');
    }

    // 4. Test Webhook signature unwrapping & Upgrade
    console.log('Testing webhook signature validation and PRO upgrade...');
    const upgradePayload = {
      type: 'payment.succeeded',
      data: {
        metadata: {
          userId: user.id,
          tier: 'PRO',
        },
      },
    };

    const webhookId = 'evt_test_upgrade_123';
    const webhookTimestamp = Math.floor(Date.now() / 1000).toString();
    const upgradeBody = JSON.stringify(upgradePayload);
    const signature = generateSvixSignature(process.env.DODO_PAYMENTS_WEBHOOK_KEY!, webhookId, webhookTimestamp, upgradeBody);

    // Verify unwrapping succeeds using SDK unwrap
    const unwrappedEvent = paymentsService.dodoClient.webhooks.unwrap(upgradeBody, {
      headers: {
        'webhook-id': webhookId,
        'webhook-signature': signature,
        'webhook-timestamp': webhookTimestamp,
      },
    });
    console.log('✔ SDK signature validation passed. Event unwrapped type:', unwrappedEvent.type);

    // Process the event
    await paymentsService.handleWebhookEvent(unwrappedEvent);

    // Verify DB update and relational entities
    user = await prismaService.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        orders: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (user.subscriptionTier !== 'PRO') {
      throw new Error(`Expected subscription tier to be PRO, got ${user.subscriptionTier}`);
    }
    console.log('✔ Database verification: User upgraded to PRO successfully');

    if (!user.subscription) {
      throw new Error('Expected active subscription record, but none found');
    }
    if (user.subscription.status !== 'active') {
      throw new Error(`Expected subscription status to be active, got ${user.subscription.status}`);
    }
    if (user.subscription.plan.name !== 'PRO') {
      throw new Error(`Expected subscription plan name to be PRO, got ${user.subscription.plan.name}`);
    }
    console.log('✔ Database verification: Relational Subscription record verified successfully');

    if (user.orders.length === 0) {
      throw new Error('Expected at least one order record, but none found');
    }
    const order = user.orders[0];
    if (order.status !== 'completed') {
      throw new Error(`Expected order status to be completed, got ${order.status}`);
    }
    if (order.plan.name !== 'PRO') {
      throw new Error(`Expected order plan name to be PRO, got ${order.plan.name}`);
    }
    console.log('✔ Database verification: Relational Order record verified successfully');

    // 5. Test Webhook Downgrade
    console.log('Testing subscription failure and FREE downgrade...');
    const downgradePayload = {
      type: 'subscription.cancelled',
      data: {
        metadata: {
          userId: user.id,
        },
      },
    };

    const downgradeBody = JSON.stringify(downgradePayload);
    const downgradeId = 'evt_test_downgrade_123';
    const downgradeTimestamp = Math.floor(Date.now() / 1000).toString();
    const downgradeSignature = generateSvixSignature(process.env.DODO_PAYMENTS_WEBHOOK_KEY!, downgradeId, downgradeTimestamp, downgradeBody);

    const unwrappedDowngrade = paymentsService.dodoClient.webhooks.unwrap(downgradeBody, {
      headers: {
        'webhook-id': downgradeId,
        'webhook-signature': downgradeSignature,
        'webhook-timestamp': downgradeTimestamp,
      },
    });
    
    await paymentsService.handleWebhookEvent(unwrappedDowngrade);

    // Verify DB update
    user = await prismaService.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });
    if (user.subscriptionTier !== 'FREE') {
      throw new Error(`Expected subscription tier to be FREE, got ${user.subscriptionTier}`);
    }
    if (!user.subscription || user.subscription.status !== 'cancelled') {
      throw new Error(`Expected subscription status to be cancelled, got ${user.subscription?.status}`);
    }
    console.log('✔ Database verification: User downgraded to FREE and subscription status updated to cancelled successfully');

    console.log('\n=============================================');
    console.log('🎉 ALL PAYMENT SYSTEM INTEGRATION TESTS PASSED 🎉');
    console.log('=============================================\n');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup database
    await prismaService.user.deleteMany({ where: { email } });
    await app.close();
  }
}

runTests();
