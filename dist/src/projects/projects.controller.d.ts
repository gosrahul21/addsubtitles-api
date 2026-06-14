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
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    getUserProjects(req: Request & {
        user: any;
    }): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
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
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    updateSettings(id: string, dto: UpdateSettingsDto): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    getProjectDetails(id: string): Promise<any>;
}
