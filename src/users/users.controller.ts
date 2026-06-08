import { Controller, Get, Patch, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CACHE_KEYS } from '../common/constants/cache.constants';

@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const userId = req.user.sub;
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId);

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

    // Cache user profile for 1 hour (3600 seconds)
    await this.redisService.set(cacheKey, JSON.stringify(payload), 3600);

    return payload;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.sub;

    try {
      // Create a payload with only the fields that exist in the Prisma schema
      // (ignoring 'name' since it doesn't exist in the current schema yet)
      const dataToUpdate: any = {};
      if (updateUserDto.email) {
        dataToUpdate.email = updateUserDto.email;
      }

      // If no valid fields are provided to update, just return early
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

      // Crucial: Invalidate the user cache so the next GET /users/me fetches fresh data
      await this.redisService.del(CACHE_KEYS.USER_PROFILE(userId));

      return {
        message: 'User details updated successfully',
        user: updatedUser,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Email is already in use');
      }
      throw error;
    }
  }
}
