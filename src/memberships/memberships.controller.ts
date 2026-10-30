import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';
import { DecideMembershipDto } from './dto/decide-membership.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('communities/:communityId/memberships')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  join(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
  ) {
    return this.membershipsService.join(user.userId, communityId);
  }

  @Delete('me')
  leave(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
  ) {
    return this.membershipsService.leave(user.userId, communityId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
  ) {
    return this.membershipsService.listAccepted(user.userId, communityId);
  }

  @Patch(':userId')
  decide(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: DecideMembershipDto,
  ) {
    return this.membershipsService.decide(
      user.userId,
      communityId,
      targetUserId,
      dto.decision,
    );
  }
}
