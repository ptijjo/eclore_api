import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ReportsService } from './reports.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import {
  createMockRedisService,
  type MockRedisService,
} from '../test/mocks/redis.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: MockPrismaService;
  let redis: MockRedisService;
  const notifications = {
    notifyAdminsOfContentReport: mockFn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrismaService();
    redis = createMockRedisService();
    service = new ReportsService(
      prisma as never,
      redis as never,
      notifications as never,
    );
  });

  describe('create', () => {
    it('crée un signalement avec snapshot et notifie les admins', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        authorId: 'author-1',
        body: 'Texte difficile à lire.',
        format: 'TEXT',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        publishedAt: new Date('2026-01-01T11:00:00Z'),
        communityId: 'c1',
        community: { name: 'Vie quotidienne' },
        author: {
          email: 'auteur@example.com',
          profile: { pseudonym: 'auteur' },
        },
      });
      prisma.report.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        email: 'signale@example.com',
        profile: { pseudonym: 'signaleuse' },
      });
      redis.lrange.mockResolvedValue(['sid-1']);
      redis.get.mockResolvedValue(
        JSON.stringify({ ip: '9.9.9.9', sessionId: 'sid-1' }),
      );
      const created = {
        id: 'r1',
        targetType: 'TESTIMONIAL',
        targetId: 't1',
        reason: 'HARASSMENT',
        status: 'OPEN',
        createdAt: new Date(),
      };
      prisma.report.create.mockResolvedValue(created);
      notifications.notifyAdminsOfContentReport.mockResolvedValue(undefined);

      await expect(
        service.create(
          'reporter-1',
          {
            targetType: 'TESTIMONIAL',
            targetId: 't1',
            reason: 'HARASSMENT',
            details: '  insultes  ',
          },
          '1.2.3.4',
        ),
      ).resolves.toEqual(created);

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reporterId: 'reporter-1',
            reason: 'HARASSMENT',
            details: 'insultes',
            reporterIp: '1.2.3.4',
            reporterEmail: 'signale@example.com',
            reporterPseudonym: 'signaleuse',
            targetAuthorId: 'author-1',
            targetAuthorEmail: 'auteur@example.com',
            targetAuthorPseudonym: 'auteur',
            targetAuthorIp: '9.9.9.9',
            targetPreview: 'Texte difficile à lire.',
            communityName: 'Vie quotidienne',
            status: 'OPEN',
          }),
        }),
      );
      expect(notifications.notifyAdminsOfContentReport).toHaveBeenCalledWith({
        id: 'r1',
        reason: 'HARASSMENT',
        targetType: 'TESTIMONIAL',
      });
    });

    it('refuse de signaler son propre contenu', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        authorId: 'same-user',
        body: 'moi',
        format: 'TEXT',
        createdAt: new Date(),
        publishedAt: new Date(),
        communityId: 'c1',
        community: { name: 'X' },
        author: { email: 'a@b.c', profile: { pseudonym: 'moi' } },
      });

      await expect(
        service.create('same-user', {
          targetType: 'TESTIMONIAL',
          targetId: 't1',
          reason: 'OTHER',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('409 si signalement déjà ouvert', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        authorId: 'author-1',
        body: 'x',
        format: 'TEXT',
        createdAt: new Date(),
        publishedAt: null,
        communityId: 'c1',
        community: { name: 'X' },
        author: { email: 'a@b.c', profile: { pseudonym: 'a' } },
      });
      prisma.report.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('reporter-1', {
          targetType: 'TESTIMONIAL',
          targetId: 't1',
          reason: 'SCAM',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('decide', () => {
    it('passe en IN_REVIEW', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'OPEN',
        targetType: 'TESTIMONIAL',
        targetId: 't1',
        targetAuthorId: 'author-1',
        moderationAction: null,
      });
      const updated = { id: 'r1', status: 'IN_REVIEW' };
      prisma.report.update.mockResolvedValue(updated);

      await expect(
        service.decide('r1', 'admin-1', { decision: 'IN_REVIEW' }),
      ).resolves.toEqual(updated);
    });

    it('RESOLVED avec SUSPENSION met à jour le compte auteur', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'OPEN',
        targetType: 'TESTIMONIAL',
        targetId: 't1',
        targetAuthorId: 'author-1',
        moderationAction: null,
      });
      prisma.report.findUniqueOrThrow.mockResolvedValue({
        id: 'r1',
        status: 'RESOLVED',
        targetType: 'TESTIMONIAL',
        targetId: 't1',
        reason: 'THREAT',
        createdAt: new Date(),
      });

      await expect(
        service.decide('r1', 'admin-1', {
          decision: 'RESOLVED',
          measure: 'SUSPENSION',
          measureReason: 'Menaces répétées',
        }),
      ).resolves.toEqual(
        expect.objectContaining({ status: 'RESOLVED' }),
      );

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('404 si signalement absent', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(
        service.decide('missing', 'admin-1', { decision: 'DISMISSED' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si déjà clôturé', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'RESOLVED',
        targetType: 'TESTIMONIAL',
        targetId: 't1',
        targetAuthorId: 'a',
        moderationAction: null,
      });
      await expect(
        service.decide('r1', 'admin-1', { decision: 'DISMISSED' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
