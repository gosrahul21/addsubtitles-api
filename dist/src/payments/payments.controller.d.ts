import { RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request } from 'express';
import { UpdatePlanDto } from './dto/update-plan.dto';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    getPlans(): Promise<any>;
    updatePlan(id: string, dto: UpdatePlanDto): Promise<any>;
    createCheckoutSession(req: any, tier: string): Promise<{
        checkoutUrl: string;
    }>;
    handleWebhook(req: RawBodyRequest<Request>, webhookId: string, webhookSignature: string, webhookTimestamp: string): Promise<{
        received: boolean;
    }>;
}
