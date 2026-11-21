import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';
import { CreateThemeProposalDto } from './dto/create-theme-proposal.dto.js';
import { DecideThemeProposalDto } from './dto/decide-theme-proposal.dto.js';
import { ThemeProposalsService } from './theme-proposals.service.js';

@Controller('communities/:communityId/theme-proposals')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class CommunityThemeProposalsController {
  constructor(private readonly themeProposals: ThemeProposalsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
    @Body() dto: CreateThemeProposalDto,
  ) {
    return this.themeProposals.create(user.userId, communityId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
  ) {
    return this.themeProposals.listForCommunity(user.userId, communityId);
  }
}

@Controller('theme-proposals')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class ThemeProposalsController {
  constructor(private readonly themeProposals: ThemeProposalsService) {}

  @Patch(':id')
  decide(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: DecideThemeProposalDto,
  ) {
    return this.themeProposals.decide(user.userId, id, dto);
  }
}
