import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CommunitiesModule } from './communities/communities.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { MediaModule } from './media/media.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { TestimonialsModule } from './testimonials/testimonials.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    ProfilesModule,
    CommunitiesModule,
    MembershipsModule,
    TestimonialsModule,
    MediaModule,
    NotificationsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
