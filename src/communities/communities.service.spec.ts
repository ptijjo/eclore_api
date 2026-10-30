import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { CommunitiesService } from './communities.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CommunitiesService(prisma as never);
    prisma.$transaction.mockImplementation(
      async (fn: (tx: MockPrismaService) => Promise<unknown>) => fn(prisma),
    );
  });

  it('liste uniquement les communautés ACTIVE', async () => {
    const rows = [
      {
        id: 'c1',
        name: 'Solitude',
        status: 'ACTIVE',
        joinPolicy: 'OPEN',
      },
    ];
    prisma.community.findMany.mockResolvedValue(rows);

    await expect(service.list()).resolves.toEqual(rows);
    expect(prisma.community.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
      }),
    );
  });

  it('retourne une communauté ACTIVE par id', async () => {
    const row = { id: 'c1', name: 'Solitude', status: 'ACTIVE' };
    prisma.community.findUnique.mockResolvedValue(row);
    await expect(service.getById('c1')).resolves.toEqual(row);
  });

  it('404 si communauté absente', async () => {
    prisma.community.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 si communauté non ACTIVE (brouillon / suspendue)', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
    });
    await expect(service.getById('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crée une communauté en DRAFT (admin)', async () => {
    prisma.community.findUnique.mockResolvedValue(null);
    const created = {
      id: 'c1',
      name: 'Solitude',
      joinPolicy: 'REQUEST',
      status: 'DRAFT',
    };
    prisma.community.create.mockResolvedValue(created);

    await expect(
      service.create({
        name: 'Solitude',
        description: 'd',
        theme: 't',
        rules: 'r',
        joinPolicy: 'REQUEST',
      }),
    ).resolves.toEqual(created);
    expect(prisma.community.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });

  it('crée avec OWNER / MODERATOR désignés', async () => {
    prisma.community.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([{ id: 'u-owner' }, { id: 'u-mod' }]);
    prisma.community.create.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
    });
    prisma.communityMembership.create.mockResolvedValue({});

    await service.create({
      name: 'Solitude',
      description: 'd',
      theme: 't',
      rules: 'r',
      joinPolicy: 'OPEN',
      ownerUserIds: ['u-owner'],
      moderatorUserIds: ['u-mod'],
    });

    expect(prisma.communityMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-owner',
          role: 'OWNER',
          status: 'ACCEPTED',
        }),
      }),
    );
    expect(prisma.communityMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-mod',
          role: 'MODERATOR',
          status: 'ACCEPTED',
        }),
      }),
    );
  });

  it('conflit si le nom existe déjà', async () => {
    prisma.community.findUnique.mockResolvedValue({ id: 'c1' });
    await expect(
      service.create({
        name: 'Solitude',
        description: 'd',
        theme: 't',
        rules: 'r',
        joinPolicy: 'OPEN',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuse ACTIVE sans OWNER', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
      description: 'd',
      theme: 't',
      rules: 'r',
    });
    prisma.communityMembership.count.mockResolvedValue(0);

    await expect(
      service.updateStatus('c1', { status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publie DRAFT → ACTIVE si OWNER présent', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
      description: 'd',
      theme: 't',
      rules: 'r',
    });
    prisma.communityMembership.count.mockResolvedValue(1);
    const updated = { id: 'c1', status: 'ACTIVE' };
    prisma.community.update.mockResolvedValue(updated);

    await expect(
      service.updateStatus('c1', { status: 'ACTIVE' }),
    ).resolves.toEqual(updated);
  });

  it('refuse transition ARCHIVED → ACTIVE', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ARCHIVED',
      description: 'd',
      theme: 't',
      rules: 'r',
    });

    await expect(
      service.updateStatus('c1', { status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigne un OWNER', async () => {
    prisma.community.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    prisma.communityMembership.findUnique.mockResolvedValue(null);
    const created = {
      id: 'm1',
      userId: 'u1',
      role: 'OWNER',
      status: 'ACCEPTED',
    };
    prisma.communityMembership.create.mockResolvedValue(created);

    await expect(
      service.assignResponsible('c1', { userId: 'u1', role: 'OWNER' }),
    ).resolves.toEqual(created);
  });
});
