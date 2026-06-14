import { AiService } from './ai.service';
import { SubscriptionService } from 'src/payments/subscription.service';
export declare class AiController {
    private readonly aiService;
    private readonly subscriptionService;
    constructor(aiService: AiService, subscriptionService: SubscriptionService);
    generateHooks(req: any, text: string): Promise<{
        hooks: string[];
    }>;
    generateEmojis(req: any, segments: any[]): Promise<{
        emojis: any[];
    }>;
}
