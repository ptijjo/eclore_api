import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<{
      user: AuthenticatedRequestUser;
    }>();
    return request.user;
  },
);
