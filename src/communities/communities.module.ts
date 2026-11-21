import { Module } from '@nestjs/common';
import {
  CommunitiesController,
  CommunityProposalsController,
} from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';
import { CommunityProposalsService } from './community-proposals.service.js';
import {
  CommunityThemeProposalsController,
  ThemeProposalsController,
} from './theme-proposals.controller.js';
import { ThemeProposalsService } from './theme-proposals.service.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, MembershipsModule],
  controllers: [
    CommunitiesController,
    CommunityProposalsController,
    CommunityThemeProposalsController,
    ThemeProposalsController,
  ],
  providers: [
    CommunitiesService,
    CommunityProposalsService,
    ThemeProposalsService,
  ],
  exports: [
    CommunitiesService,
    CommunityProposalsService,
    ThemeProposalsService,
  ],
})
export class CommunitiesModule {}
