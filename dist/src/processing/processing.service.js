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
const auth_config_1 = require("../auth/auth.config");
let ProcessingService = class ProcessingService {
    constructor(audioQueue, prisma) {
        this.audioQueue = audioQueue;
        this.prisma = prisma;
    }
    async triggerProcessing(id, tokenUser = null) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: {
                user: {
                    include: {
                        subscription: {
                            include: { plan: true }
                        }
                    }
                }
            },
        });
        if (!project) {
            throw new common_1.BadRequestException('Project not found');
        }
        if (!project.videoUrl) {
            throw new common_1.BadRequestException('No video has been uploaded for this project yet');
        }
        const subscriptionTier = project.user?.subscription?.plan?.name || (tokenUser ? tokenUser.subscriptionTier : 'FREE');
        if (!project.userId || subscriptionTier === 'FREE') {
            let processCount = 0;
            if (project.userId) {
                processCount = await this.prisma.project.count({
                    where: {
                        userId: project.userId,
                        status: { in: ['PROCESSING', 'COMPLETED'] },
                    },
                });
            }
            else if (project.sessionId) {
                processCount = await this.prisma.project.count({
                    where: {
                        sessionId: project.sessionId,
                        status: { in: ['PROCESSING', 'COMPLETED'] },
                    },
                });
            }
            if (processCount >= auth_config_1.AUTH_CONFIG.freeTierMaxProcessingLimit) {
            }
        }
        await this.prisma.project.update({
            where: { id },
            data: { status: 'PROCESSING' },
        });
        const job = await this.audioQueue.add('transcribe-job', {
            projectId: id,
            videoUrl: project.videoUrl,
        });
        return {
            message: 'Processing has been triggered asynchronously',
            jobId: job.id,
            status: 'PROCESSING',
        };
    }
};
exports.ProcessingService = ProcessingService;
exports.ProcessingService = ProcessingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('audio-processing')),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService])
], ProcessingService);
//# sourceMappingURL=processing.service.js.map