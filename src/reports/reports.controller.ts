import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { DecideReportDto } from './dto/decide-report.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Membre authentifié — dépose un signalement (snapshot + IP capturés). */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateReportDto,
    @Ip() ip: string,
  ) {
    return this.reportsService.create(user.userId, dto, ip);
  }

  /** File de modération — ADMIN uniquement (PII : emails, IPs). */
  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listForAdmin() {
    return this.reportsService.listForAdmin();
  }

  @Get(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  getByIdForAdmin(@Param('id') id: string) {
    return this.reportsService.getByIdForAdmin(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  decide(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: DecideReportDto,
  ) {
    return this.reportsService.decide(id, user.userId, dto);
  }
}
