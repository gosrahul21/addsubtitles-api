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
exports.PresetsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const presets_service_1 = require("./presets.service");
let PresetsController = class PresetsController {
    constructor(presetsService) {
        this.presetsService = presetsService;
    }
    async createPreset(req, name, styleJson) {
        if (!name || typeof name !== 'string') {
            throw new common_1.BadRequestException('Preset name is required');
        }
        if (!styleJson || typeof styleJson !== 'object') {
            throw new common_1.BadRequestException('Style configuration (styleJson) is required');
        }
        const userId = req.user.id;
        return this.presetsService.createPreset(userId, name, styleJson);
    }
    async getPresets(req) {
        const userId = req.user.id;
        return this.presetsService.getPresetsForUser(userId);
    }
    async deletePreset(req, id) {
        const userId = req.user.id;
        return this.presetsService.deletePreset(userId, id);
    }
};
exports.PresetsController = PresetsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('name')),
    __param(2, (0, common_1.Body)('styleJson')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], PresetsController.prototype, "createPreset", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PresetsController.prototype, "getPresets", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PresetsController.prototype, "deletePreset", null);
exports.PresetsController = PresetsController = __decorate([
    (0, common_1.Controller)('presets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [presets_service_1.PresetsService])
], PresetsController);
//# sourceMappingURL=presets.controller.js.map