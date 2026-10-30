import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, { ip, userAgent });
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Get('verify-email')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async verifyEmailGet(@Query('token') token: string) {
    const result = await this.authService.verifyEmail(token);
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Éclore</title></head><body><h1>${result.message}</h1><p>Tu peux fermer cette page et ouvrir l’application pour te connecter.</p></body></html>`;
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmailPost(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPasswordPost(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('reset-password')
  @Header('Content-Type', 'text/html; charset=utf-8')
  resetPasswordGet(@Query('token') token: string) {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Éclore</title></head><body><h1>Réinitialisation</h1><p>Utilise l’application Éclore avec ce jeton pour choisir un nouveau mot de passe.</p><code>${token ?? ''}</code></body></html>`;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedRequestUser) {
    await this.authService.logout(user.userId, user.sessionId);
    return { message: 'Session terminée.' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.listSessions(user.userId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    await this.authService.revokeSession(user.userId, sessionId);
    return { message: 'Session révoquée.' };
  }
}
