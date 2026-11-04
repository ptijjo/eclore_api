import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SupportReactionsService } from './support-reactions.service.js';
import { UpsertSupportReactionDto } from './dto/upsert-support-reaction.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('testimonials/:testimonialId/support-reactions')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class SupportReactionsController {
  constructor(
    private readonly supportReactionsService: SupportReactionsService,
  ) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
  ) {
    return this.supportReactionsService.getForTestimonial(
      user.userId,
      testimonialId,
    );
  }

  /** Pose ou remplace mon unique signe (un seul par personne). */
  @Put()
  upsert(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
    @Body() dto: UpsertSupportReactionDto,
  ) {
    return this.supportReactionsService.upsert(
      user.userId,
      testimonialId,
      dto,
    );
  }

  @Delete('me')
  removeMine(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
  ) {
    return this.supportReactionsService.removeMine(user.userId, testimonialId);
  }
}
