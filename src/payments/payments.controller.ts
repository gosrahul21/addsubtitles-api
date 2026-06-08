import { Controller, Get, Post, Put, Body, Req, Headers, UnauthorizedException, BadRequestException, UseGuards, RawBodyRequest, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Role } from '../common/types/roles.enum';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('plans')
  async getPlans() {
    return this.paymentsService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }
    return this.paymentsService.updatePlan(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-session')
  async createCheckoutSession(
    @Req() req: any,
    @Body('tier') tier: string,
  ) {
    const plans = await this.paymentsService.getPlans();
    const allowedTiers = plans.map(p => p.name.toUpperCase());
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
