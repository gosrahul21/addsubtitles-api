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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const subscription_service_1 = require("../payments/subscription.service");
let AiController = class AiController {
    constructor(aiService, subscriptionService) {
        this.aiService = aiService;
        this.subscriptionService = subscriptionService;
    }
    async generateHooks(req, text) {
        const userId = req.user.sub;
        const subscription = await this.subscriptionService.getUserSubscription(userId);
        if (!subscription || subscription.status !== 'active' || subscription.plan.name === 'FREE') {
            throw new Error('User is not subscribed to a premium plan');
        }
        const hooks = await this.aiService.generateHooks(text);
        return { hooks };
    }
    async generateEmojis(req, segments) {
        const userId = req.user.sub;
        const subscriptionPlan = await this.subscriptionService.getUserSubscription(userId);
        if (!subscriptionPlan || subscriptionPlan.status !== 'active' || subscriptionPlan.plan.name === 'FREE') {
            throw new Error('User is not subscribed to a premium plan');
        }
        if (!segments || !Array.isArray(segments) || segments.length === 0) {
            return { emojis: [] };
        }
        const emojis = await this.aiService.generateEmojis(segments);
        return { emojis };
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('generate-hooks'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('text')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateHooks", null);
__decorate([
    (0, common_1.Post)('generate-emojis'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('segments')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateEmojis", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        subscription_service_1.SubscriptionService])
], AiController);
//# sourceMappingURL=ai.controller.js.map