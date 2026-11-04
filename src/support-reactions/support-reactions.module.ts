import { Module } from '@nestjs/common';
import { SupportReactionsController } from './support-reactions.controller.js';
import { SupportReactionsService } from './support-reactions.service.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, MembershipsModule, NotificationsModule],
  controllers: [SupportReactionsController],
  providers: [SupportReactionsService],
})
export class SupportReactionsModule {}
