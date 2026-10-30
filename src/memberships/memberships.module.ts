import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
import { MembershipAccessService } from './membership-access.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipAccessService],
  exports: [MembershipsService, MembershipAccessService],
})
export class MembershipsModule {}
