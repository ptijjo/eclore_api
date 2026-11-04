import { Controller, Get, UseGuards } from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

/**
 * Routes globales memberships (hors :communityId).
 * - GET /memberships/me — mes adhésions (tous les users)
 * - GET /memberships/pending — file admin des demandes
 */
@Controller('memberships')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class MembershipsAdminController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.membershipsService.listMine(user.userId);
  }

  @Get('pending')
  listAllPending(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.membershipsService.listAllPending(user.userId);
  }
}
