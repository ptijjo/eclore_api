import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller('testimonials/:testimonialId/comments')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
  ) {
    return this.commentsService.list(user.userId, testimonialId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.userId, testimonialId, dto);
  }

  @Delete(':commentId')
  remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('testimonialId', ParseUUIDPipe) testimonialId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.remove(user.userId, testimonialId, commentId);
  }
}
