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
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    saveUploadedVideo(projectId: string, videoUrl: string): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    delProjectCache(projectId: string): Promise<void>;
    updateSettings(projectId: string, dto: UpdateSettingsDto): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
    getProject(projectId: string): Promise<any>;
    getTempAudioUrl(projectId: string): Promise<string>;
    saveTempAudioUrl(projectId: string, audioUrl: string): Promise<{
        message: string;
    }>;
    getUserProjects(userId: string): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }[]>;
    updateProjectStatus(projectId: string, status: ProjectStatus): Promise<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        status: import(".prisma/client").$Enums.ProjectStatus;
        language: string | null;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
    }>;
}
