import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { AUTH_CONFIG } from './auth.config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  private async hashValue(val: string): Promise<string> {
    return bcrypt.hash(val, 10);
  }

  private async compareHash(val: string, hash: string): Promise<boolean> {
    return bcrypt.compare(val, hash);
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: AUTH_CONFIG.jwtAccessSecret,
      expiresIn: AUTH_CONFIG.jwtAccessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: AUTH_CONFIG.jwtRefreshSecret,
      expiresIn: AUTH_CONFIG.jwtRefreshExpiresIn,
    });

    // Update refresh token hash in DB
    const refreshTokenHash = await this.hashValue(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  private async claimGuestProjects(userId: string, sessionId?: string) {
    if (!sessionId) return;
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

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
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

  async login(dto: LoginDto) {
    const user = await (this.prisma as any).user.findUnique({
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const matched = await this.compareHash(dto.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.claimGuestProjects(user.id, dto.sessionId);
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: { id: user.id, email: user.email, subscriptionTier: user.subscription?.plan?.name || 'FREE' },
      tokens,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    let email: string;
    let googleId: string;

    try {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'your-google-client-id');
      
      // Verify token authenticity against Google's OAuth2 endpoints
      const ticket = await client.verifyIdToken({
        idToken: dto.token,
        audience: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      email = payload.email;
      googleId = payload.sub; // Google's unique, permanent user ID
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new UnauthorizedException('Google OAuth verification failed');
    }

    let user: any = await (this.prisma as any).user.findUnique({
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
      // If user doesn't exist by googleId, check by their email to link their account
      user = await (this.prisma as any).user.findUnique({
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
      } else {
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

  async refreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: AUTH_CONFIG.jwtRefreshSecret,
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException();
      }

      const isMatched = await this.compareHash(token, user.refreshTokenHash);
      if (!isMatched) {
        throw new UnauthorizedException();
      }

      // Rotate tokens
      return {
        tokens: await this.generateTokens(user.id, user.email, user.role),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: AUTH_CONFIG.jwtRefreshSecret,
      });
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
    } catch {}
  }
}
