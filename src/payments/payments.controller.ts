import { Controller, Post, Body, Req, Headers, UnauthorizedException, BadRequestException, UseGuards, RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout-session')
  async createCheckoutSession(
    @Req() req: any,
    @Body('tier') tier: string,
  ) {
    const allowedTiers = ['FREE', 'PRO', 'ENTERPRISE'];
    const normalizedTier = tier?.toUpperCase();
    if (!normalizedTier || !allowedTiers.includes(normalizedTier)) {
      throw new BadRequestException('Invalid subscription tier');
    }

    const userId = req.user.id;
    const checkoutUrl = await this.paymentsService.createCheckoutSession(userId, normalizedTier);
    return { checkoutUrl };
  }

  // this will be called by payment provider on receiving payment on your behalf, 
  // you trust them and their platform. 
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('webhook-id') webhookId: string,
    @Headers('webhook-signature') webhookSignature: string,
    @Headers('webhook-timestamp') webhookTimestamp: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw body not found. Make sure rawBody is enabled in NestFactory.');
    }

    let event: any;

    try {
      // In production, pass a valid webhook_key or verify it manually if unwrap needs it.
      // The dodopayments unwrap function takes string body and headers to verify the signature.
      event = this.paymentsService.dodoClient.webhooks.unwrap(req.rawBody.toString('utf8'), {
        headers: {
          'webhook-id': webhookId,
          'webhook-signature': webhookSignature,
          'webhook-timestamp': webhookTimestamp,
        },
      });
    } catch (err) {
      // If signature validation fails or it's misconfigured
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.paymentsService.handleWebhookEvent(event);
    return { received: true };
  }
}
