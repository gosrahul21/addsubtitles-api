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
var ViewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let ViewsService = ViewsService_1 = class ViewsService {
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.logger = new common_1.Logger(ViewsService_1.name);
    }
    getRedisKey(entityType, slug) {
        return `page_views:${entityType.toLowerCase()}:${slug.toLowerCase()}`;
    }
    hasPageViewDelegate() {
        return !!(this.prisma && this.prisma.pageView);
    }
    async incrementView(entityType, slug) {
        const normType = entityType.toLowerCase().trim();
        const normSlug = slug.toLowerCase().trim();
        const redisKey = this.getRedisKey(normType, normSlug);
        try {
            const existingRedisVal = await this.redisService.get(redisKey);
            let currentCount;
            if (existingRedisVal === null) {
                let initialCount = 0;
                if (this.hasPageViewDelegate()) {
                    try {
                        const dbRecord = await this.prisma.pageView.findUnique({
                            where: { slug: normSlug },
                        });
                        if (dbRecord)
                            initialCount = dbRecord.views;
                    }
                    catch (dbErr) {
                        this.logger.warn(`Cold-start DB check failed for ${normSlug}: ${dbErr.message}`);
                    }
                }
                currentCount = initialCount + 1;
                await this.redisService.set(redisKey, currentCount.toString());
            }
            else {
                currentCount = await this.redisService.incr(redisKey);
            }
            if (this.hasPageViewDelegate()) {
                this.prisma.pageView
                    .upsert({
                    where: { slug: normSlug },
                    update: { views: currentCount },
                    create: {
                        entityType: normType,
                        slug: normSlug,
                        views: currentCount,
                    },
                })
                    .catch((dbErr) => {
                    this.logger.error(`Failed to sync view count to DB for ${normSlug}: ${dbErr.message}`);
                });
            }
            else {
                this.logger.warn(`Prisma pageView model not generated yet in current client. View counted in Redis: ${currentCount}`);
            }
            return currentCount;
        }
        catch (err) {
            this.logger.error(`Error in incrementView for ${normSlug}: ${err.message}`);
            if (this.hasPageViewDelegate()) {
                try {
                    const record = await this.prisma.pageView.upsert({
                        where: { slug: normSlug },
                        update: { views: { increment: 1 } },
                        create: { entityType: normType, slug: normSlug, views: 1 },
                    });
                    return record.views;
                }
                catch (dbErr) {
                    this.logger.error(`DB fallback upsert also failed: ${dbErr.message}`);
                }
            }
            return 1;
        }
    }
    async getViewCount(entityType, slug) {
        const normType = entityType.toLowerCase().trim();
        const normSlug = slug.toLowerCase().trim();
        const redisKey = this.getRedisKey(normType, normSlug);
        const cached = await this.redisService.get(redisKey);
        if (cached !== null) {
            return parseInt(cached, 10) || 0;
        }
        if (this.hasPageViewDelegate()) {
            try {
                const record = await this.prisma.pageView.findUnique({
                    where: { slug: normSlug },
                });
                const count = record ? record.views : 0;
                await this.redisService.set(redisKey, count.toString());
                return count;
            }
            catch (dbErr) {
                this.logger.warn(`Failed to read view count from DB: ${dbErr.message}`);
            }
        }
        return 0;
    }
    async getAllViews(entityType) {
        if (!this.hasPageViewDelegate()) {
            return {};
        }
        try {
            const whereClause = entityType ? { entityType: entityType.toLowerCase().trim() } : {};
            const records = await this.prisma.pageView.findMany({
                where: whereClause,
                select: { slug: true, views: true },
            });
            const result = {};
            for (const r of records) {
                result[r.slug] = r.views;
            }
            return result;
        }
        catch (err) {
            this.logger.error(`Failed to getAllViews: ${err.message}`);
            return {};
        }
    }
};
exports.ViewsService = ViewsService;
exports.ViewsService = ViewsService = ViewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], ViewsService);
//# sourceMappingURL=views.service.js.map