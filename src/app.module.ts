import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ProcessingModule } from './processing/processing.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    // Configurations
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Global BullMQ connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // Database
    PrismaModule,

    // Monolith Scaffolds
    AuthModule,
    UsersModule,
    ProjectsModule,
    ProcessingModule,
    ExportModule,
  ],
})
export class AppModule {}
