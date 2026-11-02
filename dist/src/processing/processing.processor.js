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
var ProcessingProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const processing_service_1 = require("./processing.service");
let ProcessingProcessor = ProcessingProcessor_1 = class ProcessingProcessor extends bullmq_1.WorkerHost {
    constructor(processingService) {
        super();
        this.processingService = processingService;
        this.logger = new common_1.Logger(ProcessingProcessor_1.name);
    }
    async process(job) {
        const { projectId, audioUrl } = job.data;
        this.logger.log(`[Job ${job.id}] Executing audio processing queue job for project: ${projectId}`);
        return this.processingService.process(projectId, audioUrl);
    }
};
exports.ProcessingProcessor = ProcessingProcessor;
exports.ProcessingProcessor = ProcessingProcessor = ProcessingProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)('audio-processing'),
    __metadata("design:paramtypes", [processing_service_1.ProcessingService])
], ProcessingProcessor);
//# sourceMappingURL=processing.processor.js.map