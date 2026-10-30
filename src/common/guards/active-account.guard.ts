import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../../auth/auth.types.js';

/**
 * Routes métier : seul un compte ACTIVE passe.
 * RESTRICTED / SUSPENDED / EXCLUDED → 403 (le JWT bloque déjà les deux derniers).
 */
@Injectable()
export class ActiveAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedRequestUser;
    }>();
    const user = request.user;
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Compte non autorisé pour cette action.');
    }
    return true;
  }
}
