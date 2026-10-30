import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('profiles')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.profilesService.getMine(user.userId);
  }

  @Patch('me')
  updateMine(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateMine(user.userId, dto);
  }
}
