import { Module } from '@nestjs/common';
import { MembershipsAdminController } from './memberships-admin.controller.js';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
import { MembershipAccessService } from './membership-access.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [PrismaModule, RedisModule, NotificationsModule],
  controllers: [MembershipsController, MembershipsAdminController],
  providers: [MembershipsService, MembershipAccessService],
  exports: [MembershipsService, MembershipAccessService],
})
export class MembershipsModule {}
