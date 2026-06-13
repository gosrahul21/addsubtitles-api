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
exports.ProcessingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const cache_constants_1 = require("../common/constants/cache.constants");
const deepgram_service_1 = require("../deepgram/deepgram.service");
const language_config_1 = require("../common/constants/language.config");
let ProcessingProcessor = class ProcessingProcessor extends bullmq_1.WorkerHost {
    constructor(prisma, redisService, deepgramService) {
        super();
        this.prisma = prisma;
        this.redisService = redisService;
        this.deepgramService = deepgramService;
    }
    async process(job) {
        const { projectId, videoUrl } = job.data;
        try {
            console.log(`[Job ${job.id}] Starting audio transcription pipeline for project: ${projectId}`);
            console.log(`[Job ${job.id}] videoUrl: ${videoUrl}`);
            const project = await this.prisma.project.update({
                where: { id: projectId },
                data: { status: 'PROCESSING' },
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId));
            const tempUrlCacheKey = `project:${projectId}:tempUrl`;
            const tempAudioUrl = await this.redisService.get(tempUrlCacheKey);
            const transcriptionUrl = tempAudioUrl || videoUrl;
            console.log(`[Job ${job.id}] Sending URL directly to Deepgram: ${transcriptionUrl}`);
            const words = await this.deepgramService.transcribeUrl(transcriptionUrl, language_config_1.languageMap[project.language?.toLowerCase()] || 'en');
            await this.saveSubtitlesToDb(projectId, words);
            if (tempAudioUrl) {
                await this.redisService.del(tempUrlCacheKey);
            }
            await this.prisma.project.update({
                where: { id: projectId },
                data: { status: 'COMPLETED' },
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.PROJECT_DETAILS(projectId));
            console.log(`[Job ${job.id}] Pipeline finished successfully for Project: ${projectId}`);
        }
        catch (err) {
            console.error(`[Job ${job.id}] Pipeline failed:`, err);
            await this.prisma.project.update({
                where: { id: projectId },
                data: { status: 'FAILED' },
            });
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
exports.ProcessingProcessor = ProcessingProcessor;
exports.ProcessingProcessor = ProcessingProcessor = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)('audio-processing'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        deepgram_service_1.DeepgramService])
], ProcessingProcessor);
//# sourceMappingURL=processing.processor.js.map