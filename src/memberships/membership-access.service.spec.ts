import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { MembershipAccessService } from './membership-access.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';

describe('MembershipAccessService', () => {
  let service: MembershipAccessService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new MembershipAccessService(prisma as never);
  });

  it('retourne le membership ACCEPTED si communauté ACTIVE', async () => {
    const membership = {
      id: 'm1',
      userId: 'u1',
      communityId: 'c1',
      status: 'ACCEPTED',
      role: 'MEMBER',
    };
    prisma.communityMembership.findUnique.mockResolvedValue(membership);
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
    });

    await expect(
      service.requireAcceptedMembership('u1', 'c1'),
    ).resolves.toEqual(membership);
  });

  it.each(['PENDING', 'LEFT', 'REJECTED'] as const)(
    'refuse %s sans fuite (404)',
    async (status) => {
      prisma.communityMembership.findUnique.mockResolvedValue({ status });
      prisma.community.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
      });
      await expect(
        service.requireAcceptedMembership('u1', 'c1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('refuse sans membership (404)', async () => {
    prisma.communityMembership.findUnique.mockResolvedValue(null);
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
    });
    await expect(
      service.requireAcceptedMembership('u1', 'c1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['DRAFT', 'SUSPENDED', 'ARCHIVED'] as const)(
    'refuse communauté %s même si ACCEPTED (404)',
    async (status) => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', status });
      await expect(
        service.requireAcceptedMembership('u1', 'c1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );
});
