import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CommunityProposalsService } from './community-proposals.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('CommunityProposalsService', () => {
  let service: CommunityProposalsService;
  let prisma: MockPrismaService;
  const notifications = {
    notifyAdminsOfCommunityProposal: mockFn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrismaService();
    service = new CommunityProposalsService(
      prisma as never,
      notifications as never,
    );
  });

  it('crée une proposition PENDING et notifie les admins', async () => {
    const created = {
      id: 'p1',
      name: 'Deuil',
      status: 'PENDING',
      rationale: 'Se sentir moins seul après une perte.',
    };
    prisma.communityProposal.create.mockResolvedValue(created);
    notifications.notifyAdminsOfCommunityProposal.mockResolvedValue(undefined);

    await expect(
      service.create('u1', {
        name: '  Deuil  ',
        rationale: 'Se sentir moins seul après une perte.',
      }),
    ).resolves.toEqual(created);

    expect(prisma.communityProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposerId: 'u1',
          name: 'Deuil',
          rationale: 'Se sentir moins seul après une perte.',
          status: 'PENDING',
        }),
      }),
    );
    expect(notifications.notifyAdminsOfCommunityProposal).toHaveBeenCalledWith(
      created,
    );
  });

  it('décide ACCEPTED sur une proposition PENDING', async () => {
    prisma.communityProposal.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'PENDING',
    });
    const updated = { id: 'p1', status: 'ACCEPTED', name: 'Deuil' };
    prisma.communityProposal.update.mockResolvedValue(updated);

    await expect(
      service.decide('p1', { decision: 'ACCEPTED' }),
    ).resolves.toEqual(updated);
    expect(prisma.communityProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { status: 'ACCEPTED' },
      }),
    );
  });

  it('404 si proposition absente', async () => {
    prisma.communityProposal.findUnique.mockResolvedValue(null);
    await expect(
      service.decide('missing', { decision: 'REJECTED' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 si proposition déjà tranchée', async () => {
    prisma.communityProposal.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'REJECTED',
    });
    await expect(
      service.decide('p1', { decision: 'ACCEPTED' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
