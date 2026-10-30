import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { MembershipsService } from './memberships.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import {
  createMockRedisService,
  type MockRedisService,
} from '../test/mocks/redis.mock.js';
import { createMockConfigService } from '../test/mocks/config.mock.js';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prisma: MockPrismaService;
  let redis: MockRedisService;

  const communityOpen = {
    id: 'c1',
    joinPolicy: 'OPEN',
    status: 'ACTIVE',
  };
  const communityRequest = {
    id: 'c1',
    joinPolicy: 'REQUEST',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    redis = createMockRedisService();
    redis.get.mockResolvedValue(null);
    service = new MembershipsService(
      prisma as never,
      redis as never,
      createMockConfigService({
        JOIN_REQUEST_COOLDOWN_SECONDS: '3600',
      }),
    );
  });

  describe('join', () => {
    it('OPEN → ACCEPTED immédiat', async () => {
      prisma.community.findUnique.mockResolvedValue(communityOpen);
      prisma.communityMembership.findUnique.mockResolvedValue(null);
      const created = {
        id: 'm1',
        status: 'ACCEPTED',
        role: 'MEMBER',
      };
      prisma.communityMembership.create.mockResolvedValue(created);

      await expect(service.join('u1', 'c1')).resolves.toEqual(created);
      expect(prisma.communityMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCEPTED',
            role: 'MEMBER',
          }),
        }),
      );
    });

    it('REQUEST → PENDING', async () => {
      prisma.community.findUnique.mockResolvedValue(communityRequest);
      prisma.communityMembership.findUnique.mockResolvedValue(null);
      prisma.communityMembership.create.mockResolvedValue({
        status: 'PENDING',
      });

      await service.join('u1', 'c1');
      expect(prisma.communityMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('réadhésion LEFT + OPEN → ACCEPTED', async () => {
      prisma.community.findUnique.mockResolvedValue(communityOpen);
      prisma.communityMembership.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'LEFT',
        role: 'MODERATOR',
      });
      prisma.communityMembership.update.mockResolvedValue({
        id: 'm1',
        status: 'ACCEPTED',
        role: 'MEMBER',
      });

      await service.join('u1', 'c1');
      expect(prisma.communityMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCEPTED',
            role: 'MEMBER',
          }),
        }),
      );
    });

    it('réadhésion REJECTED + REQUEST → PENDING', async () => {
      prisma.community.findUnique.mockResolvedValue(communityRequest);
      prisma.communityMembership.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'REJECTED',
      });
      prisma.communityMembership.update.mockResolvedValue({
        status: 'PENDING',
      });

      await service.join('u1', 'c1');
      expect(prisma.communityMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('refuse si déjà ACCEPTED', async () => {
      prisma.community.findUnique.mockResolvedValue(communityOpen);
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      });
      await expect(service.join('u1', 'c1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuse si PENDING', async () => {
      prisma.community.findUnique.mockResolvedValue(communityRequest);
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'PENDING',
      });
      await expect(service.join('u1', 'c1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('404 si communauté absente', async () => {
      prisma.community.findUnique.mockResolvedValue(null);
      await expect(service.join('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404 si communauté non ACTIVE', async () => {
      prisma.community.findUnique.mockResolvedValue({
        id: 'c1',
        joinPolicy: 'OPEN',
        status: 'SUSPENDED',
      });
      await expect(service.join('u1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('anti-spam : cooldown Redis', async () => {
      prisma.community.findUnique.mockResolvedValue(communityRequest);
      redis.get.mockResolvedValue('1');
      await expect(service.join('u1', 'c1')).rejects.toBeInstanceOf(
        HttpException,
      );
    });
  });

  describe('leave', () => {
    it('passe ACCEPTED → LEFT', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        id: 'm1',
        status: 'ACCEPTED',
      });
      prisma.communityMembership.update.mockResolvedValue({
        status: 'LEFT',
      });
      await expect(service.leave('u1', 'c1')).resolves.toEqual({
        status: 'LEFT',
      });
    });

    it('404 si pas membre accepté', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'PENDING',
      });
      await expect(service.leave('u1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('decide', () => {
    it('modérateur accepte une demande PENDING', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce({
          status: 'ACCEPTED',
          role: 'MODERATOR',
        })
        .mockResolvedValueOnce({
          id: 'm2',
          userId: 'u2',
          status: 'PENDING',
        });
      prisma.communityMembership.update.mockResolvedValue({
        status: 'ACCEPTED',
      });

      await expect(
        service.decide('mod1', 'c1', 'u2', 'ACCEPT'),
      ).resolves.toEqual({ status: 'ACCEPTED' });
    });

    it('refuse un non-modérateur', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });
      await expect(
        service.decide('u1', 'c1', 'u2', 'ACCEPT'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('OWNER peut accepter une demande PENDING', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce({
          status: 'ACCEPTED',
          role: 'OWNER',
        })
        .mockResolvedValueOnce({
          id: 'm2',
          userId: 'u2',
          status: 'PENDING',
        });
      prisma.communityMembership.update.mockResolvedValue({
        status: 'ACCEPTED',
      });

      await expect(
        service.decide('owner1', 'c1', 'u2', 'ACCEPT'),
      ).resolves.toEqual({ status: 'ACCEPTED' });
    });

    it('404 si cible non PENDING', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce({
          status: 'ACCEPTED',
          role: 'MODERATOR',
        })
        .mockResolvedValueOnce({
          status: 'LEFT',
        });
      await expect(
        service.decide('mod1', 'c1', 'u2', 'REJECT'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listAccepted', () => {
    it('liste les membres ACCEPTED pour un membre', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      });
      prisma.community.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      prisma.communityMembership.findMany.mockResolvedValue([
        { userId: 'u1', role: 'MEMBER', status: 'ACCEPTED' },
      ]);
      await expect(service.listAccepted('u1', 'c1')).resolves.toHaveLength(1);
    });

    it('404 pour non-membre', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        status: 'PENDING',
      });
      prisma.community.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      await expect(service.listAccepted('u1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
