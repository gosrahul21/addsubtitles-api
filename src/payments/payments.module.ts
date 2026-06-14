import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [PaymentsService, SubscriptionService],
  controllers: [PaymentsController],
  exports: [PaymentsService, SubscriptionService],
})
export class PaymentsModule {}
