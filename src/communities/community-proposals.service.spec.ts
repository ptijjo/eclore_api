import { beforeEach, describe, expect, it } from '@jest/globals';
import { CommunityProposalsService } from './community-proposals.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';

describe('CommunityProposalsService', () => {
  let service: CommunityProposalsService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CommunityProposalsService(prisma as never);
  });

  it('crée une proposition PENDING', async () => {
    const created = {
      id: 'p1',
      name: 'Deuil',
      status: 'PENDING',
    };
    prisma.communityProposal.create.mockResolvedValue(created);

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
  });
});
