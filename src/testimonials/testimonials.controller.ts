import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TestimonialsService } from './testimonials.service.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import { ListTestimonialsQueryDto } from './dto/list-testimonials.query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

@Controller()
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Post('communities/:communityId/testimonials')
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
    @Body() dto: CreateTestimonialDto,
  ) {
    return this.testimonialsService.create(user.userId, communityId, dto);
  }

  @Get('communities/:communityId/testimonials')
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('communityId') communityId: string,
    @Query() query: ListTestimonialsQueryDto,
  ) {
    return this.testimonialsService.listPublished(
      user.userId,
      communityId,
      query,
    );
  }

  @Get('testimonials/:id')
  getById(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.testimonialsService.getById(user.userId, id);
  }

  @Patch('testimonials/:id')
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.update(user.userId, id, dto);
  }

  @Post('testimonials/:id/publish')
  publish(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.testimonialsService.publish(user.userId, id);
  }

  @Delete('testimonials/:id')
  delete(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.testimonialsService.delete(user.userId, id);
  }
}
