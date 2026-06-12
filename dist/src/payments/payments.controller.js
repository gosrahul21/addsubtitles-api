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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const update_plan_dto_1 = require("./dto/update-plan.dto");
const roles_enum_1 = require("../common/types/roles.enum");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async getPlans() {
        return this.paymentsService.getPlans();
    }
    async updatePlan(id, dto) {
        if (Object.keys(dto).length === 0) {
            throw new common_1.BadRequestException('Provide at least one field to update');
        }
        return this.paymentsService.updatePlan(id, dto);
    }
    async createCheckoutSession(req, tier) {
        const plans = await this.paymentsService.getPlans();
        const allowedTiers = plans.map(p => p.name.toUpperCase());
        const normalizedTier = tier?.toUpperCase();
        if (!normalizedTier || !allowedTiers.includes(normalizedTier)) {
            throw new common_1.BadRequestException('Invalid subscription tier');
        }
        const userId = req.user.sub;
        console.log("userId", userId);
        const checkoutUrl = await this.paymentsService.createCheckoutSession(userId, normalizedTier);
        return { checkoutUrl };
    }
    async handleWebhook(req, webhookId, webhookSignature, webhookTimestamp) {
        if (!req.rawBody) {
            throw new common_1.BadRequestException('Raw body not found. Make sure rawBody is enabled in NestFactory.');
        }
        let event;
        try {
            console.log(req.rawBody.toString('utf8'));
            event = this.paymentsService.dodoClient.webhooks.unwrap(req.rawBody.toString('utf8'), {
                headers: {
                    'webhook-id': webhookId,
                    'webhook-signature': webhookSignature,
                    'webhook-timestamp': webhookTimestamp,
                },
            });
            console.log(event);
        }
        catch (err) {
            console.log(err);
            throw new common_1.UnauthorizedException('Invalid webhook signature');
        }
        await this.paymentsService.handleWebhookEvent(event);
        return { received: true };
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPlans", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, roles_decorator_1.Roles)(roles_enum_1.Role.ADMIN),
    (0, common_1.Put)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_plan_dto_1.UpdatePlanDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('checkout-session'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('tier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createCheckoutSession", null);
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('webhook-id')),
    __param(2, (0, common_1.Headers)('webhook-signature')),
    __param(3, (0, common_1.Headers)('webhook-timestamp')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handleWebhook", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map