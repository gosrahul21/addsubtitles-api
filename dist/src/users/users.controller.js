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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const update_user_dto_1 = require("./dto/update-user.dto");
const cache_constants_1 = require("../common/constants/cache.constants");
let UsersController = class UsersController {
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
    }
    async getMe(req) {
        const userId = req.user.sub;
        const cacheKey = cache_constants_1.CACHE_KEYS.USER_PROFILE(userId);
        const cachedUser = await this.redisService.get(cacheKey);
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                subscription: {
                    include: {
                        plan: true,
                    },
                },
                createdAt: true,
            },
        });
        const payload = {
            id: user.id,
            email: user.email,
            subscriptionTier: user.subscription?.plan?.name || 'FREE',
            createdAt: user.createdAt,
        };
        await this.redisService.set(cacheKey, JSON.stringify(payload), 3600);
        return payload;
    }
    async updateMe(req, updateUserDto) {
        const userId = req.user.sub;
        try {
            const dataToUpdate = {};
            if (updateUserDto.email) {
                dataToUpdate.email = updateUserDto.email;
            }
            if (Object.keys(dataToUpdate).length === 0) {
                return { message: 'No valid fields provided to update.' };
            }
            const updatedUser = await this.prisma.user.update({
                where: { id: userId },
                data: dataToUpdate,
                select: {
                    id: true,
                    email: true,
                    createdAt: true,
                },
            });
            await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PROFILE(userId));
            return {
                message: 'User details updated successfully',
                user: updatedUser,
            };
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.BadRequestException('Email is already in use');
            }
            throw error;
        }
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMe", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], UsersController);
//# sourceMappingURL=users.controller.js.map