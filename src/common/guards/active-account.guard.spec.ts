import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { ActiveAccountGuard } from './active-account.guard.js';

function makeContext(user?: { status: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe('ActiveAccountGuard', () => {
  const guard = new ActiveAccountGuard();

  it('autorise un compte ACTIVE', () => {
    expect(
      guard.canActivate(
        makeContext({ status: 'ACTIVE' }) as never,
      ),
    ).toBe(true);
  });

  it('refuse RESTRICTED', () => {
    expect(() =>
      guard.canActivate(makeContext({ status: 'RESTRICTED' }) as never),
    ).toThrow(ForbiddenException);
  });

  it('refuse sans utilisateur', () => {
    expect(() => guard.canActivate(makeContext() as never)).toThrow(
      ForbiddenException,
    );
  });
});
