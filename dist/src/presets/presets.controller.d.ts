import { PresetsService } from './presets.service';
export declare class PresetsController {
    private presetsService;
    constructor(presetsService: PresetsService);
    createPreset(req: any, name: string, styleJson: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
        styleJson: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
    }>;
    getPresets(req: any): Promise<any>;
    deletePreset(req: any, id: string): Promise<{
        success: boolean;
    }>;
}
