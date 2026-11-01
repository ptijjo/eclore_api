import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Prisma } from '../generated/prisma/client.js';
import { ProfilesService } from './profiles.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ProfilesService(prisma as never);
  });

  it('retourne mon profil avec role et status compte', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      pseudonym: 'lune_verte',
      bio: 'Hello',
      avatarKey: null,
      updatedAt: new Date('2026-01-01'),
      user: { role: 'ADMIN', status: 'ACTIVE' },
    });
    await expect(service.getMine('u1')).resolves.toEqual({
      id: 'p1',
      userId: 'u1',
      pseudonym: 'lune_verte',
      bio: 'Hello',
      avatarKey: null,
      updatedAt: new Date('2026-01-01'),
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });

  it('404 si profil absent', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.getMine('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('met à jour bio et pseudonyme', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      id: 'p1',
      pseudonym: 'old_name',
    });
    prisma.profile.update.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      pseudonym: 'new_name',
      bio: 'Une courte présentation',
      avatarKey: null,
      updatedAt: new Date('2026-01-01'),
      user: { role: 'USER', status: 'ACTIVE' },
    });

    await expect(
      service.updateMine('u1', {
        pseudonym: 'new_name',
        bio: 'Une courte présentation',
      }),
    ).resolves.toEqual({
      id: 'p1',
      userId: 'u1',
      pseudonym: 'new_name',
      bio: 'Une courte présentation',
      avatarKey: null,
      updatedAt: new Date('2026-01-01'),
      role: 'USER',
      status: 'ACTIVE',
    });
  });

  it('refuse un pseudonyme déjà pris (409)', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      id: 'p1',
      pseudonym: 'old_name',
    });
    prisma.profile.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.updateMine('u1', { pseudonym: 'pris' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
