import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from '@jest/globals';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  it('passe si aucun rôle requis', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'USER' } }) }),
    };
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('autorise le rôle attendu', () => {
    const reflector = {
      getAllAndOverride: () => ['ADMIN'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'ADMIN' } }),
      }),
    };
    expect(guard.canActivate(ctx as never)).toBe(true);
  });

  it('refuse un rôle insuffisant', () => {
    const reflector = {
      getAllAndOverride: () => ['ADMIN'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'USER' } }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException);
  });
});
