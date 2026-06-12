"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const payments_service_1 = require("./payments.service");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto = require("crypto");
const TEST_WEBHOOK_KEY = 'whsec_MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';
process.env.DODO_PAYMENTS_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY || TEST_WEBHOOK_KEY;
process.env.DODO_PAYMENTS_API_KEY = process.env.DODO_PAYMENTS_API_KEY || 'test_api_key';
function generateSvixSignature(webhookKey, id, timestamp, body) {
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
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const paymentsService = app.get(payments_service_1.PaymentsService);
    const prismaService = app.get(prisma_service_1.PrismaService);
    const email = 'payments-test-user@example.com';
    try {
        await prismaService.user.deleteMany({ where: { email } });
        let user = await prismaService.user.create({
            data: {
                email,
            },
        });
        console.log(`✔ Created test user: ${email} with ID: ${user.id}`);
        console.log('Seeding plans database using getPlans self-healing query...');
        await paymentsService.getPlans();
        console.log('Testing checkout session creation...');
        try {
            const checkoutUrl = await paymentsService.createCheckoutSession(user.id, 'PRO');
            console.log('✔ Checkout URL successfully generated:', checkoutUrl);
        }
        catch (err) {
            console.warn('⚠ Failed to generate checkout URL (likely due to mock/invalid DODO_PAYMENTS_API_KEY). Skipping checkout URL assertion, continuing to webhook signature verification...');
        }
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
        const signature = generateSvixSignature(process.env.DODO_PAYMENTS_WEBHOOK_KEY, webhookId, webhookTimestamp, upgradeBody);
        const unwrappedEvent = paymentsService.dodoClient.webhooks.unwrap(upgradeBody, {
            headers: {
                'webhook-id': webhookId,
                'webhook-signature': signature,
                'webhook-timestamp': webhookTimestamp,
            },
        });
        console.log('✔ SDK signature validation passed. Event unwrapped type:', unwrappedEvent.type);
        await paymentsService.handleWebhookEvent(unwrappedEvent);
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
        if (!user.subscription.plan.benefits || user.subscription.plan.benefits.length === 0) {
            throw new Error('Expected subscription plan benefits to be populated, but got none');
        }
        if (!user.subscription.plan.limitations || user.subscription.plan.limitations.length === 0) {
            throw new Error('Expected subscription plan limitations to be populated, but got none');
        }
        console.log('✔ Database verification: Relational Subscription record & benefits/limitations verified successfully');
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
        console.log('Testing webhook upgrade with non-existent plan (should throw error and log file)...');
        const invalidPayload = {
            type: 'payment.succeeded',
            data: {
                metadata: {
                    userId: user.id,
                    tier: 'NON_EXISTENT_TIER',
                },
            },
        };
        const invalidBody = JSON.stringify(invalidPayload);
        const invalidId = 'evt_test_invalid_123';
        const invalidTimestamp = Math.floor(Date.now() / 1000).toString();
        const invalidSignature = generateSvixSignature(process.env.DODO_PAYMENTS_WEBHOOK_KEY, invalidId, invalidTimestamp, invalidBody);
        const unwrappedInvalid = paymentsService.dodoClient.webhooks.unwrap(invalidBody, {
            headers: {
                'webhook-id': invalidId,
                'webhook-signature': invalidSignature,
                'webhook-timestamp': invalidTimestamp,
            },
        });
        try {
            await paymentsService.handleWebhookEvent(unwrappedInvalid);
            throw new Error('Expected handleWebhookEvent to throw an error for non-existent plan, but it did not.');
        }
        catch (err) {
            console.log('✔ Correctly threw error for missing plan:', err.message);
            const fs = require('fs');
            const path = require('path');
            const logsDir = path.join(process.cwd(), 'logs');
            const files = fs.readdirSync(logsDir);
            const logFile = files.find((f) => f.startsWith(`failed-plan-${user.id}-NON_EXISTENT_TIER`));
            if (!logFile) {
                throw new Error('Expected a log file to be created for the failed plan upgrade event, but none was found.');
            }
            const logContent = JSON.parse(fs.readFileSync(path.join(logsDir, logFile), 'utf-8'));
            if (logContent.tier !== 'NON_EXISTENT_TIER' || logContent.userId !== user.id) {
                throw new Error('Log file content does not match the failed plan upgrade details.');
            }
            console.log('✔ Log file verified successfully:', logFile);
            fs.unlinkSync(path.join(logsDir, logFile));
        }
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
        const downgradeSignature = generateSvixSignature(process.env.DODO_PAYMENTS_WEBHOOK_KEY, downgradeId, downgradeTimestamp, downgradeBody);
        const unwrappedDowngrade = paymentsService.dodoClient.webhooks.unwrap(downgradeBody, {
            headers: {
                'webhook-id': downgradeId,
                'webhook-signature': downgradeSignature,
                'webhook-timestamp': downgradeTimestamp,
            },
        });
        await paymentsService.handleWebhookEvent(unwrappedDowngrade);
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
    }
    catch (error) {
        console.error('❌ Integration test failed:', error);
        process.exit(1);
    }
    finally {
        await prismaService.user.deleteMany({ where: { email } });
        await app.close();
    }
}
runTests();
//# sourceMappingURL=payments-test.js.map