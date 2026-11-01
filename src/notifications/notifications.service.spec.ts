import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationsService } from './notifications.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrismaService;
  const expoPush = { send: mockFn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrismaService();
    expoPush.send.mockResolvedValue(undefined);
    service = new NotificationsService(prisma as never, expoPush as never);
  });

  it('crée une notif pour chaque ADMIN ACTIVE puis push', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 2 });
    prisma.devicePushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[aaa]' },
    ]);

    await service.notifyAdminsOfCommunityProposal({
      id: 'p1',
      name: 'Deuil',
      rationale: 'Se sentir moins seul.',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'a1',
          type: 'COMMUNITY_PROPOSAL',
          title: 'Nouvelle proposition de communauté',
        }),
        expect.objectContaining({
          userId: 'a2',
          type: 'COMMUNITY_PROPOSAL',
        }),
      ],
    });
    expect(prisma.devicePushToken.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['a1', 'a2'] } },
      select: { token: true },
    });
    expect(expoPush.send).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[aaa]',
        title: 'Éclore',
        body: 'Tu as une nouvelle interaction sur Éclore',
        data: expect.objectContaining({
          type: 'COMMUNITY_PROPOSAL',
          proposalId: 'p1',
        }),
      }),
    ]);
  });

  it('ne crée rien s’il n’y a pas d’admin', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.notifyAdminsOfCommunityProposal({
      id: 'p1',
      name: 'Deuil',
      rationale: 'x'.repeat(20),
    });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(expoPush.send).not.toHaveBeenCalled();
  });

  it('notifie les admins d’un signalement (type CONTENT_REPORT)', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'a1' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 1 });
    prisma.devicePushToken.findMany.mockResolvedValue([]);

    await service.notifyAdminsOfContentReport({
      id: 'r1',
      reason: 'THREAT',
      targetType: 'TESTIMONIAL',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'a1',
          type: 'CONTENT_REPORT',
          data: { reportId: 'r1' },
        }),
      ],
    });
  });

  it('enregistre un token push (upsert)', async () => {
    const row = {
      id: 't1',
      userId: 'u1',
      token: 'ExponentPushToken[xyz]',
      platform: 'ANDROID',
    };
    prisma.devicePushToken.upsert.mockResolvedValue(row);
    await expect(
      service.registerPushToken('u1', {
        token: 'ExponentPushToken[xyz]',
        platform: 'ANDROID',
      }),
    ).resolves.toEqual(row);
    expect(prisma.devicePushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExponentPushToken[xyz]' },
        create: expect.objectContaining({
          userId: 'u1',
          platform: 'ANDROID',
        }),
      }),
    );
  });

  it('liste les notifications du user (récentes d’abord)', async () => {
    const rows = [{ id: 'n1' }];
    prisma.notification.findMany.mockResolvedValue(rows);
    await expect(service.listForUser('u1', false)).resolves.toEqual(rows);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('filtre les non lues si demandé', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await service.listForUser('u1', true);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', readAt: null },
      }),
    );
  });

  it('marque toutes les notifs comme lues', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.markAllRead('u1')).resolves.toEqual({ count: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
