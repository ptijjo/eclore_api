import { CanActivate, ExecutionContext } from '@nestjs/common';

export const allowAllGuard: CanActivate = {
  canActivate: () => true,
};

export const denyAllGuard: CanActivate = {
  canActivate: () => false,
};

export function mockAuthenticatedUser(user: {
  userId: string;
  sessionId: string;
  role: string;
  status: string;
}) {
  return {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<{ user?: unknown }>();
      request.user = user;
      return true;
    },
  };
}
