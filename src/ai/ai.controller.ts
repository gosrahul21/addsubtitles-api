import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SubscriptionService } from 'src/payments/subscription.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // Removing AuthGuard for POC/easier testing, or we can keep it if needed. Let's keep it public for now since the frontend might not pass the token properly for free tools.
  // Wait, these are premium features, so we can use @UseGuards(AuthGuard). 
  // Let's not use AuthGuard initially to prevent blocker, as we might need a fast POC.
  
  @Post('generate-hooks')
  async generateHooks(@Req() req: any, @Body('text') text: string) {
    const userId = req.user.sub;
    // get user plan 
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
    // get user plan 
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
}
