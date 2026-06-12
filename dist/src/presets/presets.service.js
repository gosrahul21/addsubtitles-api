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
exports.PresetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const cache_constants_1 = require("../common/constants/cache.constants");
let PresetsService = class PresetsService {
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
    }
    async createPreset(userId, name, styleJson) {
        const preset = await this.prisma.preset.create({
            data: {
                userId,
                name,
                styleJson,
            },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PRESETS(userId));
        return preset;
    }
    async getPresetsForUser(userId) {
        const cacheKey = cache_constants_1.CACHE_KEYS.USER_PRESETS(userId);
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const presets = await this.prisma.preset.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        await this.redisService.set(cacheKey, JSON.stringify(presets), 3600);
        return presets;
    }
    async deletePreset(userId, id) {
        const preset = await this.prisma.preset.findFirst({
            where: { id, userId },
        });
        if (!preset) {
            throw new common_1.NotFoundException('Preset not found or unauthorized');
        }
        await this.prisma.preset.delete({
            where: { id },
        });
        await this.redisService.del(cache_constants_1.CACHE_KEYS.USER_PRESETS(userId));
        return { success: true };
    }
};
exports.PresetsService = PresetsService;
exports.PresetsService = PresetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], PresetsService);
//# sourceMappingURL=presets.service.js.map