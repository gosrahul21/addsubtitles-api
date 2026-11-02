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
        language: string | null;
        sessionId: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    saveUploadedVideo(projectId: string, videoUrl: string): Promise<{
        id: string;
        language: string | null;
        sessionId: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
    delProjectCache(projectId: string): Promise<void>;
    updateSettings(projectId: string, dto: UpdateSettingsDto): Promise<{
        id: string;
        language: string | null;
        sessionId: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
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
        id: string;
        language: string | null;
        sessionId: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }[]>;
    updateProjectStatus(projectId: string, status: ProjectStatus): Promise<{
        id: string;
        language: string | null;
        sessionId: string | null;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ProjectStatus;
        videoUrl: string | null;
        settingsJson: import("@prisma/client/runtime/library").JsonValue;
        userId: string | null;
    }>;
}
