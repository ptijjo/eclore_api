import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtStrategy } from './jwt.strategy.js';
import { createMockConfigService } from '../../test/mocks/config.mock.js';
import { mockFn } from '../../test/mocks/jest-fn.js';
import type { AuthService } from '../auth.service.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const authService = {
    validateAccessUser: mockFn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      createMockConfigService(),
      authService as unknown as AuthService,
    );
  });

  it('recharge le compte et renvoie le contexte authentifié', async () => {
    authService.validateAccessUser.mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      status: 'ACTIVE',
    });

    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1' }),
    ).resolves.toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'USER',
      status: 'ACTIVE',
    });
  });

  it('refuse un access token sans session', async () => {
    authService.validateAccessUser.mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      status: 'ACTIVE',
    });

    await expect(
      strategy.validate({ sub: 'user-1', sid: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
