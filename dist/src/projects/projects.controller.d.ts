import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ProcessingService } from '../processing/processing.service';
export declare class ProjectsController {
    private projectsService;
    private jwtService;
    private processingService;
    constructor(projectsService: ProjectsService, jwtService: JwtService, processingService: ProcessingService);
    private getUserIdOrNull;
    private getAuthenticatedUserOrNull;
    createProject(dto: CreateProjectDto, req: Request): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    getUserProjects(req: Request & {
        user: any;
    }): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }[]>;
    uploadAudio(id: string, audioUrl: string): Promise<{
        message: string;
    }>;
    getCloudinarySignature(): {
        signature: string;
        timestamp: string;
        apiKey: string;
        cloudName: string;
    };
    uploadVideo(id: string, req: Request, videoUrl?: string): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    updateSettings(id: string, dto: UpdateSettingsDto): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    getProjectDetails(id: string): Promise<any>;
}
