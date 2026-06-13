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
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const projects_service_1 = require("./projects.service");
const project_dto_1 = require("./dto/project.dto");
const jwt_1 = require("@nestjs/jwt");
const processing_service_1 = require("../processing/processing.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let ProjectsController = class ProjectsController {
    constructor(projectsService, jwtService, processingService) {
        this.projectsService = projectsService;
        this.jwtService = jwtService;
        this.processingService = processingService;
    }
    getUserIdOrNull(req) {
        const token = req.cookies?.['access_token'];
        if (!token)
            return null;
        try {
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
            });
            return payload.sub;
        }
        catch {
            return null;
        }
    }
    getAuthenticatedUserOrNull(req) {
        const token = req.cookies?.['access_token'];
        if (!token)
            return null;
        try {
            return this.jwtService.verify(token, {
                secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-123',
            });
        }
        catch {
            return null;
        }
    }
    async createProject(dto, req) {
        const userId = this.getUserIdOrNull(req);
        if (!userId && !dto.sessionId) {
            throw new common_1.BadRequestException('Either authentication or guest sessionId is required');
        }
        return this.projectsService.createProject(dto, userId);
    }
    async getUserProjects(req) {
        const userId = req.user.sub;
        if (!userId) {
            throw new common_1.BadRequestException('Authentication required');
        }
        return this.projectsService.getUserProjects(userId);
    }
    async uploadAudio(id, audioUrl) {
        if (!audioUrl) {
            throw new common_1.BadRequestException('audioUrl is required');
        }
        return this.projectsService.saveTempAudioUrl(id, audioUrl);
    }
    getCloudinarySignature() {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) {
            throw new common_1.BadRequestException('Cloudinary credentials are not properly configured.');
        }
        const timestamp = Math.round(new Date().getTime() / 1000).toString();
        const paramsToSign = `timestamp=${timestamp}`;
        const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');
        return {
            signature,
            timestamp,
            apiKey,
            cloudName,
        };
    }
    async uploadVideo(id, req, videoUrl) {
        if (!videoUrl) {
            throw new common_1.BadRequestException('videoUrl is required');
        }
        const result = await this.projectsService.saveUploadedVideo(id, videoUrl);
        if (result) {
            const tokenUser = this.getAuthenticatedUserOrNull(req);
            await this.processingService.triggerProcessing(id, tokenUser);
            return result;
        }
    }
    async updateSettings(id, dto) {
        return this.projectsService.updateSettings(id, dto);
    }
    async getProjectDetails(id) {
        return this.projectsService.getProject(id);
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [project_dto_1.CreateProjectDto, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "createProject", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getUserProjects", null);
__decorate([
    (0, common_1.Patch)(':id/audio'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('audioUrl')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "uploadAudio", null);
__decorate([
    (0, common_1.Get)('cloudinary-signature'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getCloudinarySignature", null);
__decorate([
    (0, common_1.Post)(':id/upload'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)('videoUrl')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "uploadVideo", null);
__decorate([
    (0, common_1.Put)(':id/settings'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, project_dto_1.UpdateSettingsDto]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProjectDetails", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService,
        jwt_1.JwtService,
        processing_service_1.ProcessingService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map