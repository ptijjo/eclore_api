import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const service = {
    listForUser: mockFn(),
    markAllRead: mockFn(),
    registerPushToken: mockFn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(
        mockAuthenticatedUser({
          userId: 'u1',
          sessionId: 's1',
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      )
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(NotificationsController);
  });

  it('délègue list', async () => {
    service.listForUser.mockResolvedValue([]);
    await controller.list(
      { userId: 'u1', sessionId: 's1', role: 'ADMIN', status: 'ACTIVE' },
      {},
    );
    expect(service.listForUser).toHaveBeenCalledWith('u1', false);
  });

  it('passe unreadOnly=true', async () => {
    service.listForUser.mockResolvedValue([]);
    await controller.list(
      { userId: 'u1', sessionId: 's1', role: 'ADMIN', status: 'ACTIVE' },
      { unreadOnly: 'true' },
    );
    expect(service.listForUser).toHaveBeenCalledWith('u1', true);
  });

  it('délègue markAllRead', async () => {
    service.markAllRead.mockResolvedValue({ count: 2 });
    await controller.markAllRead({
      userId: 'u1',
      sessionId: 's1',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    expect(service.markAllRead).toHaveBeenCalledWith('u1');
  });

  it('délègue registerDeviceToken', async () => {
    service.registerPushToken.mockResolvedValue({ id: 't1' });
    await controller.registerDeviceToken(
      { userId: 'u1', sessionId: 's1', role: 'ADMIN', status: 'ACTIVE' },
      { token: 'ExponentPushToken[xyz]', platform: 'ANDROID' },
    );
    expect(service.registerPushToken).toHaveBeenCalledWith('u1', {
      token: 'ExponentPushToken[xyz]',
      platform: 'ANDROID',
    });
  });
});
