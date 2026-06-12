"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const processing_controller_1 = require("./processing.controller");
const processing_processor_1 = require("./processing.processor");
const processing_service_1 = require("./processing.service");
const auth_module_1 = require("../auth/auth.module");
const deepgram_module_1 = require("../deepgram/deepgram.module");
let ProcessingModule = class ProcessingModule {
};
exports.ProcessingModule = ProcessingModule;
exports.ProcessingModule = ProcessingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            deepgram_module_1.DeepgramModule,
            bullmq_1.BullModule.registerQueue({
                name: 'audio-processing',
            }),
        ],
        controllers: [processing_controller_1.ProcessingController],
        providers: [processing_processor_1.ProcessingProcessor, processing_service_1.ProcessingService],
        exports: [processing_service_1.ProcessingService],
    })
], ProcessingModule);
//# sourceMappingURL=processing.module.js.map