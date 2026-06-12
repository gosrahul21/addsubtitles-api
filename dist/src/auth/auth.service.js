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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const auth_config_1 = require("./auth.config");
const google_auth_library_1 = require("google-auth-library");
const bcrypt = require("bcrypt");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async hashValue(val) {
        return bcrypt.hash(val, 10);
    }
    async compareHash(val, hash) {
        return bcrypt.compare(val, hash);
    }
    async generateTokens(userId, email, role) {
        const payload = { sub: userId, email, role };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: auth_config_1.AUTH_CONFIG.jwtAccessSecret,
            expiresIn: auth_config_1.AUTH_CONFIG.jwtAccessExpiresIn,
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: auth_config_1.AUTH_CONFIG.jwtRefreshSecret,
            expiresIn: auth_config_1.AUTH_CONFIG.jwtRefreshExpiresIn,
        });
        const refreshTokenHash = await this.hashValue(refreshToken);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash },
        });
        return { accessToken, refreshToken };
    }
    async claimGuestProjects(userId, sessionId) {
        if (!sessionId)
            return;
        await this.prisma.project.updateMany({
            where: {
                sessionId,
                userId: null,
            },
            data: {
                userId,
            },
        });
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new common_1.BadRequestException('Email already registered');
        }
        const passwordHash = await this.hashValue(dto.password);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
            },
        });
        await this.claimGuestProjects(user.id, dto.sessionId);
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        return {
            user: { id: user.id, email: user.email, subscriptionTier: 'FREE' },
            tokens,
        };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: {
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
        });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const matched = await this.compareHash(dto.password, user.passwordHash);
        if (!matched) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.claimGuestProjects(user.id, dto.sessionId);
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        return {
            user: { id: user.id, email: user.email, subscriptionTier: user.subscription?.plan?.name || 'FREE' },
            tokens,
        };
    }
    async googleLogin(dto) {
        let email;
        let googleId;
        try {
            const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'your-google-client-id');
            const ticket = await client.verifyIdToken({
                idToken: dto.token,
                audience: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new common_1.UnauthorizedException('Invalid Google token payload');
            }
            email = payload.email;
            googleId = payload.sub;
        }
        catch (error) {
            console.error('Google token verification failed:', error);
            throw new common_1.UnauthorizedException('Google OAuth verification failed');
        }
        let user = await this.prisma.user.findUnique({
            where: { googleId },
            include: {
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
        });
        if (!user) {
            user = await this.prisma.user.findUnique({
                where: { email },
                include: {
                    subscription: {
                        include: {
                            plan: true,
                        },
                    },
                },
            });
            if (user) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { googleId },
                });
            }
            else {
                user = await this.prisma.user.create({
                    data: {
                        email,
                        googleId,
                    },
                });
            }
        }
        await this.claimGuestProjects(user.id, dto.sessionId);
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        return {
            user: { id: user.id, email: user.email, subscriptionTier: user.subscription?.plan?.name || 'FREE' },
            tokens,
        };
    }
    async refreshToken(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: auth_config_1.AUTH_CONFIG.jwtRefreshSecret,
            });
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user || !user.refreshTokenHash) {
                throw new common_1.UnauthorizedException();
            }
            const isMatched = await this.compareHash(token, user.refreshTokenHash);
            if (!isMatched) {
                throw new common_1.UnauthorizedException();
            }
            return {
                tokens: await this.generateTokens(user.id, user.email, user.role),
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
    }
    async logout(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: auth_config_1.AUTH_CONFIG.jwtRefreshSecret,
            });
            await this.prisma.user.update({
                where: { id: payload.sub },
                data: { refreshTokenHash: null },
            });
        }
        catch { }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map