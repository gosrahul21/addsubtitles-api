import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SubscriptionService } from 'src/payments/subscription.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('generate-hooks')
  async generateHooks(@Req() req: any, @Body('text') text: string) {
    const userId = req.user.sub;
    const subscription = await this.subscriptionService.getUserSubscription(userId);
    if (!subscription || subscription.status !== 'active' || subscription.plan.name === 'FREE') {
      throw new Error('User is not subscribed to a premium plan');
    }
    const hooks = await this.aiService.generateHooks(text);
    return { hooks };
  }

  @Post('generate-emojis')
  async generateEmojis(@Req() req: any, @Body('segments') segments: any[]) {
    const userId = req.user.sub;
    const subscriptionPlan = await this.subscriptionService.getUserSubscription(userId);
    if (!subscriptionPlan || subscriptionPlan.status !== 'active' || subscriptionPlan.plan.name === 'FREE') {
      throw new Error('User is not subscribed to a premium plan');
    }

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return { emojis: [] };
    }
    const emojis = await this.aiService.generateEmojis(segments);
    return { emojis };
  }

  @Post('translate-subtitles')
  async translateSubtitles(
    @Req() req: any,
    @Body('segments') segments: any[],
    @Body('targetLanguage') targetLanguage: string,
  ) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return { translatedSegments: [] };
    }
    if (!targetLanguage) {
      throw new BadRequestException('targetLanguage is required');
    }

    const translatedSegments = await this.aiService.translateSubtitles(segments, targetLanguage);
    return { translatedSegments };
  }
}
