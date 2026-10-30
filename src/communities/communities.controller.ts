import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service.js';
import { CommunityProposalsService } from './community-proposals.service.js';
import { AssignResponsibleDto } from './dto/assign-responsible.dto.js';
import { CreateCommunityDto } from './dto/create-community.dto.js';
import { CreateCommunityProposalDto } from './dto/create-community-proposal.dto.js';
import { UpdateCommunityStatusDto } from './dto/update-community-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('communities')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly proposalsService: CommunityProposalsService,
  ) {}

  @Get()
  list() {
    return this.communitiesService.list();
  }

  /** Catalogue ops (tous statuts) — avant `:id` pour éviter collision. */
  @Get('admin/catalog')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listAllForAdmin() {
    return this.communitiesService.listAllForAdmin();
  }

  @Get('admin/:id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  getByIdForAdmin(@Param('id') id: string) {
    return this.communitiesService.getByIdForAdmin(id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.communitiesService.getById(id);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityStatusDto,
  ) {
    return this.communitiesService.updateStatus(id, dto);
  }

  @Post(':id/responsibles')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  assignResponsible(
    @Param('id') id: string,
    @Body() dto: AssignResponsibleDto,
  ) {
    return this.communitiesService.assignResponsible(id, dto);
  }
}

@Controller('community-proposals')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class CommunityProposalsController {
  constructor(private readonly proposalsService: CommunityProposalsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateCommunityProposalDto,
  ) {
    return this.proposalsService.create(user.userId, dto);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listForAdmin() {
    return this.proposalsService.listForAdmin();
  }
}
