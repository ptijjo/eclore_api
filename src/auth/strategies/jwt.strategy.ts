import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service.js';
import type {
  AuthenticatedRequestUser,
  JwtAccessPayload,
} from '../auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(
    payload: JwtAccessPayload,
  ): Promise<AuthenticatedRequestUser> {
    // Recharger le compte : le JWT ne fait pas foi pour rôle / statut.
    const user = await this.authService.validateAccessUser(payload.sub);
    if (!payload.sid) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      sessionId: payload.sid,
      role: user.role,
      status: user.status,
    };
  }
}
