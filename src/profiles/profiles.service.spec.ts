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

  it('retourne mon profil', async () => {
    const row = {
      id: 'p1',
      userId: 'u1',
      pseudonym: 'lune_verte',
      bio: 'Hello',
    };
    prisma.profile.findUnique.mockResolvedValue(row);
    await expect(service.getMine('u1')).resolves.toEqual(row);
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
    const updated = {
      id: 'p1',
      pseudonym: 'new_name',
      bio: 'Une courte présentation',
    };
    prisma.profile.update.mockResolvedValue(updated);

    await expect(
      service.updateMine('u1', {
        pseudonym: 'new_name',
        bio: 'Une courte présentation',
      }),
    ).resolves.toEqual(updated);
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
