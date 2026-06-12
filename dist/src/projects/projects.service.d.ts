import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateSettingsDto } from './dto/project.dto';
import { RedisService } from '../redis/redis.service';
export declare class ProjectsService {
    private prisma;
    private redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
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
}
