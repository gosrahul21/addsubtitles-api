import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      username: this.configService.get<string>('REDIS_USERNAME') || '',
      password: this.configService.get<string>('REDIS_PASSWORD') || '',
      db: this.configService.get<number>('REDIS_DB') || 0,
      maxRetriesPerRequest: 3,
      showFriendlyErrorStack: true,
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts to avoid console spam when Redis is down
        if (times > 3) {
          this.logger.warn('Redis is unreachable. Stopped retrying.');
          return null; // Stop reconnecting
        }
        return Math.min(times * 1000, 3000); // Reconnect after 1s, 2s, 3s
      },
    });

    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.redisClient.status !== 'ready') return null;
      return await this.redisClient.get(key);
    } catch (err) {
      this.logger.warn(`Failed to GET from Redis [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (this.redisClient.status !== 'ready') return;
      if (ttlSeconds) {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (err) {
      this.logger.warn(`Failed to SET in Redis [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redisClient.status !== 'ready') return;
      await this.redisClient.del(key);
    } catch (err) {
      this.logger.warn(`Failed to DEL in Redis [${key}]: ${err.message}`);
    }
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }
}
