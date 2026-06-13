"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const cache_constants_1 = require("../common/constants/cache.constants");
const project_status_enum_1 = require("../common/types/project-status.enum");
let ProjectsService = class ProjectsService {
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
    }
    async createProject(dto, userId) {
        const project = await this.prisma.project.create({
            data: {
                userId,
                language: dto.language,
                sessionId: dto.sessionId || null,
                status: project_status_enum_1.ProjectStatus.PENDING,
            },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(project.id));
        return project;
    }
    async saveUploadedVideo(projectId, videoUrl) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const updated = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                videoUrl,
            },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId));
        return updated;
    }
    async updateSettings(projectId, dto) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const updated = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                settingsJson: {
                    ...project.settingsJson,
                    ...dto,
                },
            },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId));
        return updated;
    }
    async getProject(projectId) {
        const cacheKey = cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId);
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { subtitle: true },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        await this.redisService.set(cacheKey, JSON.stringify(project), 3600);
        return project;
    }
    async saveTempAudioUrl(projectId, audioUrl) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const cacheKey = `project:${projectId}:tempUrl`;
        await this.redisService.set(cacheKey, audioUrl, 3600);
        return { message: 'Temporary audio URL saved successfully' };
    }
    async getUserProjects(userId) {
        const projects = await this.prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return projects;
    }
    async updateProjectStatus(projectId, status) {
        const project = await this.prisma.project.update({
            where: { id: projectId },
            data: { status },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId));
        return project;
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map