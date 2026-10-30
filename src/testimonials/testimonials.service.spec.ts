import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { TestimonialsService } from './testimonials.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('TestimonialsService', () => {
  let service: TestimonialsService;
  let prisma: MockPrismaService;
  let membershipAccess: {
    requireAcceptedMembership: ReturnType<typeof mockFn>;
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    membershipAccess = {
      requireAcceptedMembership: mockFn().mockResolvedValue({
        status: 'ACCEPTED',
        role: 'MEMBER',
      }),
    };
    service = new TestimonialsService(
      prisma as never,
      membershipAccess as unknown as MembershipAccessService,
    );
  });

  describe('create', () => {
    it('crée un brouillon TEXT pour un membre', async () => {
      prisma.testimonial.create.mockResolvedValue({
        id: 't1',
        status: 'DRAFT',
        format: 'TEXT',
      });
      await service.create('u1', 'c1', {
        format: 'TEXT',
        body: 'Mon histoire',
      });
      expect(membershipAccess.requireAcceptedMembership).toHaveBeenCalledWith(
        'u1',
        'c1',
      );
      expect(prisma.testimonial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            format: 'TEXT',
            body: 'Mon histoire',
            commentsEnabled: true,
          }),
        }),
      );
    });

    it('respecte commentsEnabled: false à la création', async () => {
      prisma.testimonial.create.mockResolvedValue({
        id: 't1',
        commentsEnabled: false,
      });
      await service.create('u1', 'c1', {
        format: 'TEXT',
        body: 'Sans réponses',
        commentsEnabled: false,
      });
      expect(prisma.testimonial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ commentsEnabled: false }),
        }),
      );
    });

    it('refuse TEXT sans body', async () => {
      await expect(
        service.create('u1', 'c1', { format: 'TEXT' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('crée un brouillon VOICE lié à un média prêt', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'u1',
        status: 'READY',
      });
      prisma.testimonial.findUnique.mockResolvedValue(null);
      prisma.testimonial.create.mockResolvedValue({
        id: 't1',
        format: 'VOICE',
      });

      await service.create('u1', 'c1', {
        format: 'VOICE',
        mediaId: 'media-1',
      });
      expect(prisma.testimonial.create).toHaveBeenCalled();
    });

    it('refuse VOICE avec média d’un autre', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'other',
        status: 'READY',
      });
      await expect(
        service.create('u1', 'c1', { format: 'VOICE', mediaId: 'media-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('publish', () => {
    it('publie un brouillon TEXT de l’auteur', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        communityId: 'c1',
        status: 'DRAFT',
        format: 'TEXT',
        body: 'ok',
        mediaId: null,
      });
      prisma.testimonial.update.mockResolvedValue({
        id: 't1',
        status: 'PUBLISHED',
      });

      await expect(service.publish('u1', 't1')).resolves.toEqual({
        id: 't1',
        status: 'PUBLISHED',
      });
    });

    it('refuse de publier le brouillon d’un autre', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'other',
        communityId: 'c1',
        status: 'DRAFT',
        format: 'TEXT',
        body: 'ok',
      });
      await expect(service.publish('u1', 't1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('listPublished', () => {
    it('liste chronologique pour un membre ACCEPTED', async () => {
      prisma.testimonial.findMany.mockResolvedValue([
        { id: 't1', publishedAt: new Date('2026-01-01') },
      ]);
      await expect(
        service.listPublished('u1', 'c1', { limit: 20 }),
      ).resolves.toMatchObject({ items: expect.any(Array) });
      expect(membershipAccess.requireAcceptedMembership).toHaveBeenCalled();
    });

    it('non-membre → 404 via membership access', async () => {
      membershipAccess.requireAcceptedMembership.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(
        service.listPublished('u1', 'c1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getById', () => {
    it('auteur peut lire son brouillon', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        communityId: 'c1',
        status: 'DRAFT',
      });
      await expect(service.getById('u1', 't1')).resolves.toMatchObject({
        id: 't1',
      });
    });

    it('membre ACCEPTED lit un publié', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'other',
        communityId: 'c1',
        status: 'PUBLISHED',
      });
      await expect(service.getById('u1', 't1')).resolves.toMatchObject({
        id: 't1',
      });
    });

    it('non-membre ne lit pas un publié (404)', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'other',
        communityId: 'c1',
        status: 'PUBLISHED',
      });
      membershipAccess.requireAcceptedMembership.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(service.getById('u1', 't1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('met à jour un brouillon de l’auteur', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        status: 'DRAFT',
        format: 'TEXT',
        communityId: 'c1',
      });
      prisma.testimonial.update.mockResolvedValue({
        id: 't1',
        body: 'nouveau',
      });
      await expect(
        service.update('u1', 't1', { body: 'nouveau' }),
      ).resolves.toMatchObject({ body: 'nouveau' });
    });

    it('refuse un body vide', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        status: 'DRAFT',
        format: 'TEXT',
      });
      await expect(
        service.update('u1', 't1', { body: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('delete', () => {
    it('auteur peut supprimer', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
      });
      prisma.testimonial.delete.mockResolvedValue({});
      await service.delete('u1', 't1');
      expect(prisma.testimonial.delete).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
    });

    it('autre utilisateur → 403', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'other',
      });
      await expect(service.delete('u1', 't1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('404 si absent', async () => {
      prisma.testimonial.findUnique.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('publish garde-fous', () => {
    it('refuse publier un texte vide', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        communityId: 'c1',
        status: 'DRAFT',
        format: 'TEXT',
        body: '  ',
        mediaId: null,
      });
      await expect(service.publish('u1', 't1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuse publier un vocal sans media', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        authorId: 'u1',
        communityId: 'c1',
        status: 'DRAFT',
        format: 'VOICE',
        body: null,
        mediaId: null,
      });
      await expect(service.publish('u1', 't1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  it('refuse un curseur invalide', async () => {
    await expect(
      service.listPublished('u1', 'c1', { cursor: '%%%', limit: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

