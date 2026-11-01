import { Module } from '@nestjs/common';
import {
  CommunitiesController,
  CommunityProposalsController,
} from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';
import { CommunityProposalsService } from './community-proposals.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CommunitiesController, CommunityProposalsController],
  providers: [CommunitiesService, CommunityProposalsService],
  exports: [CommunitiesService, CommunityProposalsService],
})
export class CommunitiesModule {}
