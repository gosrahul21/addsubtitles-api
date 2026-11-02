import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { RedisService } from '../redis/redis.service';
import { ProjectStatus } from 'src/common/types/project-status.enum';
import { ProcessingService } from 'src/processing/processing.service';
export declare class ProjectsService {
    private prisma;
    private redisService;
    private readonly processingService;
    constructor(prisma: PrismaService, redisService: RedisService, processingService: ProcessingService);
    createProject(dto: CreateProjectDto, userId: string | null): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    saveUploadedVideo(projectId: string, videoUrl: string): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    delProjectCache(projectId: string): Promise<void>;
    updateSettings(projectId: string, dto: UpdateSettingsDto): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    getProject(projectId: string): Promise<any>;
    getTempAudioUrl(projectId: string): Promise<string>;
    saveTempAudioUrl(projectId: string, audioUrl: string): Promise<{
        message: string;
    }>;
    getUserProjects(userId: string): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }[]>;
    updateProjectStatus(projectId: string, status: ProjectStatus): Promise<{
        sessionId: string | null;
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
}
