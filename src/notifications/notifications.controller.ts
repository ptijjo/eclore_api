import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto.js';
import { RegisterPushTokenDto } from './dto/register-push-token.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const unreadOnly = query.unreadOnly === 'true';
    return this.notificationsService.listForUser(user.userId, unreadOnly);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Post('device-token')
  registerDeviceToken(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user.userId, dto);
  }
}
