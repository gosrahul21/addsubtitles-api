import { Module } from '@nestjs/common';
import { PaymentsModule } from 'src/payments/payments.module';
import { RedisModule } from 'src/redis/redis.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PaymentsModule, RedisModule, AuthModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }
