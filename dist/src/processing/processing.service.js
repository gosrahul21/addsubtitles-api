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
var ProcessingService_1;
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
const groq_service_1 = require("../groq/groq.service");
const subscription_service_1 = require("../payments/subscription.service");
let ProcessingService = ProcessingService_1 = class ProcessingService {
    constructor(audioQueue, prisma, projectsService, redisService, deepgramService, groqService, subscriptionService) {
        this.audioQueue = audioQueue;
        this.prisma = prisma;
        this.projectsService = projectsService;
        this.redisService = redisService;
        this.deepgramService = deepgramService;
        this.groqService = groqService;
        this.subscriptionService = subscriptionService;
        this.logger = new common_1.Logger(ProcessingService_1.name);
    }
    async triggerProcessing(id) {
        const audioUrl = await this.projectsService.getTempAudioUrl(id);
        if (!audioUrl) {
            throw new common_1.BadRequestException('No audio has been uploaded for this project yet');
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
    async isPaidUser(userId) {
        if (!userId)
            return false;
        try {
            const subscription = await this.subscriptionService.getUserSubscription(userId);
            if (!subscription)
                return false;
            const isStatusActive = subscription.status === 'active';
            const isNotExpired = subscription.endDate ? new Date(subscription.endDate) > new Date() : true;
            const isPaidPlan = subscription.plan?.name && subscription.plan.name !== 'FREE';
            return !!(isStatusActive && isNotExpired && isPaidPlan);
        }
        catch (err) {
            this.logger.error(`Error checking user subscription: ${err.message}`);
            return false;
        }
    }
    async transcribeWithFallback(projectId, audioUrl, language = 'en') {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { userId: true },
        });
        const isPaid = await this.isPaidUser(project?.userId);
        if (isPaid) {
            this.logger.log(`[Job ${projectId}] Paid subscriber detected. Transcribing directly with Deepgram: ${audioUrl}`);
            return this.deepgramService.transcribeUrl(audioUrl, language);
        }
        this.logger.log(`[Job ${projectId}] Free user/guest detected. Attempting Groq Whisper Large v3...`);
        try {
            if (!this.groqService.isAvailable()) {
                throw new Error('Groq API key not configured or client unavailable');
            }
            const words = await this.groqService.transcribeUrl(audioUrl, language);
            if (!words || words.length === 0) {
                throw new Error('Groq Whisper returned empty word list');
            }
            this.logger.log(`[Job ${projectId}] Groq Whisper transcription succeeded (${words.length} words).`);
            return words;
        }
        catch (groqErr) {
            this.logger.warn(`[Job ${projectId}] Groq Whisper failed (${groqErr.message}). Seamlessly falling back to Deepgram...`);
            return this.deepgramService.transcribeUrl(audioUrl, language);
        }
    }
    async process(projectId, audioUrl) {
        try {
            this.logger.log(`Starting audio transcription pipeline for project: ${projectId}`);
            this.logger.log(`audioUrl: ${audioUrl}`);
            const project = await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.PROCESSING);
            const words = await this.transcribeWithFallback(projectId, audioUrl, project.language || 'en');
            await this.saveSubtitlesToDb(projectId, words);
            await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.COMPLETED);
            this.logger.log(`[Job ${projectId}] Pipeline finished successfully for Project: ${projectId}`);
        }
        catch (err) {
            this.logger.error(`[Job ${projectId}] Pipeline failed: ${err.message}`, err.stack);
            await this.projectsService.updateProjectStatus(projectId, project_status_enum_1.ProjectStatus.FAILED);
            throw err;
        }
    }
    async saveSubtitlesToDb(projectId, words) {
        if (!words || words.length === 0)
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
        await this.prisma.subtitle.upsert({
            where: { projectId },
            update: {
                subtitlesJson: dbBlocks,
            },
            create: {
                projectId,
                subtitlesJson: dbBlocks,
            },
        });
    }
};
exports.ProcessingService = ProcessingService;
exports.ProcessingService = ProcessingService = ProcessingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('audio-processing')),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => projects_service_1.ProjectsService))),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService,
        projects_service_1.ProjectsService,
        redis_service_1.RedisService,
        deepgram_service_1.DeepgramService,
        groq_service_1.GroqService,
        subscription_service_1.SubscriptionService])
], ProcessingService);
//# sourceMappingURL=processing.service.js.map