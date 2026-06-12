import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ProcessingService } from './processing.service';
export declare class ProcessingController {
    private processingService;
    private jwtService;
    constructor(processingService: ProcessingService, jwtService: JwtService);
    private getAuthenticatedUserOrNull;
    triggerProcessing(id: string, req: Request): Promise<{
        message: string;
        jobId: string;
        status: string;
    }>;
}
