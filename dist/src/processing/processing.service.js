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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const projects_service_1 = require("../projects/projects.service");
const project_status_enum_1 = require("../common/types/project-status.enum");
const redis_service_1 = require("../redis/redis.service");
const deepgram_service_1 = require("../deepgram/deepgram.service");
let ProcessingService = class ProcessingService {
    constructor(audioQueue, prisma, projectsService, redisService, deepgramService) {
        this.audioQueue = audioQueue;
        this.prisma = prisma;
        this.projectsService = projectsService;
        this.redisService = redisService;
        this.deepgramService = deepgramService;
    }
    async triggerProcessing(id) {
        const audioUrl = await this.projectsService.getTempAudioUrl(id);
        if (!audioUrl) {
            throw new common_1.BadRequestException("No audio has been uploaded for this project yet");
        }
        const project = await this.projectsService.updateProjectStatus(id, project_status_enum_1.ProjectStatus.PROCESSING);
        if (!project) {
            throw new common_1.BadRequestException('Project not found');
        }
        this.process(id, audioUrl);
        return {
            message: 'Processing has been triggered asynchronously',
            status: 'PROCESSING',
        };
    }
    async process(projectId, audioUrl) {
        try {
            console.log(`[Starting audio transcription pipeline for project: ${projectId}`);
            console.log(`[audioUrl: ${audioUrl}`);
            const project = await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.PROCESSING);
            console.log(project);
            console.log(`[Job ${projectId}] Sending URL directly to Deepgram: ${audioUrl}`);
            const words = await this.deepgramService.transcribeUrl(audioUrl, project.language || 'en');
            await this.saveSubtitlesToDb(projectId, words);
            console.log('words', words);
            await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.COMPLETED);
            console.log(`[Job ${projectId}] Pipeline finished successfully for Project: ${projectId}`);
        }
        catch (err) {
            console.error(`[Job ${projectId}] Pipeline failed:`, err);
            await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.FAILED);
            throw err;
        }
    }
    async saveSubtitlesToDb(projectId, words) {
        if (words.length === 0)
            return;
        const groupedBlocks = this.deepgramService.groupIntoBlocks(words);
        const { randomUUID } = require('crypto');
        const dbBlocks = groupedBlocks.map((b) => ({
            id: randomUUID(),
            language: 'en',
            timestampStart: b.start,
            timestampEnd: b.end,
            text: b.words.map((w) => w.word).join(' '),
            wordsJson: b.words,
            speaker: b.words[0]?.speaker || 'A',
        }));
        await this.prisma.subtitle.create({
            data: {
                projectId,
                subtitlesJson: dbBlocks,
            },
        });
    }
};
exports.ProcessingService = ProcessingService;
exports.ProcessingService = ProcessingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('audio-processing')),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => projects_service_1.ProjectsService))),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService,
        projects_service_1.ProjectsService,
        redis_service_1.RedisService,
        deepgram_service_1.DeepgramService])
], ProcessingService);
//# sourceMappingURL=processing.service.js.map