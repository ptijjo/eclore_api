import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ThemeProposalsService } from './theme-proposals.service.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('ThemeProposalsService', () => {
  const prisma = {
    community: {
      findUnique: mockFn(),
      update: mockFn(),
    },
    communityMembership: {
      findUnique: mockFn(),
      findMany: mockFn(),
    },
    communityThemeProposal: {
      create: mockFn(),
      findUnique: mockFn(),
      findMany: mockFn(),
      update: mockFn(),
    },
    user: {
      findUnique: mockFn(),
      findMany: mockFn(),
    },
    $transaction: mockFn(),
  };

  const notifications = {
    notifyThemeProposal: mockFn(),
  };

  const membershipAccess = {
    requireAcceptedMembership: mockFn(),
  };

  let service: ThemeProposalsService;

  beforeEach(() => {
    for (const group of Object.values(prisma)) {
      if (typeof group === 'object') {
        for (const fn of Object.values(group)) {
          (fn as ReturnType<typeof mockFn>).mockReset();
        }
      }
    }
    notifications.notifyThemeProposal.mockReset();
    membershipAccess.requireAcceptedMembership.mockReset();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );

    service = new ThemeProposalsService(
      prisma as never,
      membershipAccess as never,
      notifications as never,
    );
  });

  describe('create', () => {
    it('refuse si non membre ACCEPTED', async () => {
      membershipAccess.requireAcceptedMembership.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.create('user-1', 'com-1', {
          label: 'Fatigue',
          rationale: 'Beaucoup de messages sur ce sujet.',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un libellé déjà présent dans la communauté', async () => {
      membershipAccess.requireAcceptedMembership.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });
      prisma.community.findUnique.mockResolvedValue({
        id: 'com-1',
        status: 'ACTIVE',
        theme: 'Solitude · Charge mentale',
        name: 'Vie quotidienne',
      });

      await expect(
        service.create('user-1', 'com-1', {
          label: 'solitude',
          rationale: 'Déjà couvert mais mal orthographié.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée une proposition PENDING et notifie', async () => {
      membershipAccess.requireAcceptedMembership.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });
      prisma.community.findUnique.mockResolvedValue({
        id: 'com-1',
        status: 'ACTIVE',
        theme: 'Solitude · Charge mentale',
        name: 'Vie quotidienne',
      });
      const created = {
        id: 'prop-1',
        communityId: 'com-1',
        proposerId: 'user-1',
        label: 'Fatigue du quotidien',
        rationale: 'Beaucoup de messages sur ce sujet précis.',
        status: 'PENDING',
        createdAt: new Date(),
      };
      prisma.communityThemeProposal.create.mockResolvedValue(created);
      notifications.notifyThemeProposal.mockResolvedValue(undefined);

      const result = await service.create('user-1', 'com-1', {
        label: '  Fatigue du quotidien  ',
        rationale: 'Beaucoup de messages sur ce sujet précis.',
      });

      expect(result.label).toBe('Fatigue du quotidien');
      expect(prisma.communityThemeProposal.create).toHaveBeenCalled();
      expect(notifications.notifyThemeProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prop-1',
          communityId: 'com-1',
          label: 'Fatigue du quotidien',
        }),
      );
    });
  });

  describe('decide', () => {
    it('refuse un membre ordinaire', async () => {
      prisma.communityThemeProposal.findUnique.mockResolvedValue({
        id: 'prop-1',
        status: 'PENDING',
        communityId: 'com-1',
        label: 'Fatigue',
        rationale: 'x'.repeat(20),
        community: {
          id: 'com-1',
          theme: 'Solitude',
          status: 'ACTIVE',
          name: 'Vie quotidienne',
        },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        role: 'USER',
        status: 'ACTIVE',
      });
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });

      await expect(
        service.decide('user-2', 'prop-1', { decision: 'ACCEPTED' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ajoute la pastille au thème si ACCEPTED (modérateur)', async () => {
      prisma.communityThemeProposal.findUnique.mockResolvedValue({
        id: 'prop-1',
        status: 'PENDING',
        communityId: 'com-1',
        label: 'Fatigue',
        rationale: 'x'.repeat(20),
        community: {
          id: 'com-1',
          theme: 'Solitude · Charge mentale',
          status: 'ACTIVE',
          name: 'Vie quotidienne',
        },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'mod-1',
        role: 'USER',
        status: 'ACTIVE',
      });
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MODERATOR',
      });
      prisma.community.update.mockResolvedValue({});
      prisma.communityThemeProposal.update.mockResolvedValue({
        id: 'prop-1',
        status: 'ACCEPTED',
        label: 'Fatigue',
        communityId: 'com-1',
        proposerId: 'user-1',
        rationale: 'x'.repeat(20),
        createdAt: new Date(),
      });

      const result = await service.decide('mod-1', 'prop-1', {
        decision: 'ACCEPTED',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(prisma.community.update).toHaveBeenCalledWith({
        where: { id: 'com-1' },
        data: {
          theme: 'Solitude · Charge mentale · Fatigue',
        },
      });
    });

    it('refuse ACCEPTED si le libellé existe déjà', async () => {
      prisma.communityThemeProposal.findUnique.mockResolvedValue({
        id: 'prop-1',
        status: 'PENDING',
        communityId: 'com-1',
        label: 'Solitude',
        rationale: 'x'.repeat(20),
        community: {
          id: 'com-1',
          theme: 'Solitude · Charge mentale',
          status: 'ACTIVE',
          name: 'Vie quotidienne',
        },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      await expect(
        service.decide('admin-1', 'prop-1', { decision: 'ACCEPTED' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
