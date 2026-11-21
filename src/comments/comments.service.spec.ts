import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: MockPrismaService;
  const membershipAccess = {
    requireAcceptedMembership: mockFn(),
  };
  const notifications = {
    notifyTestimonialComment: mockFn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrismaService();
    membershipAccess.requireAcceptedMembership.mockResolvedValue({
      status: 'ACCEPTED',
    });
    notifications.notifyTestimonialComment.mockResolvedValue(undefined);
    service = new CommentsService(
      prisma as never,
      membershipAccess as never,
      notifications as never,
    );
  });

  describe('create', () => {
    it('crée un commentaire et notifie l’auteur du témoignage', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        profile: { pseudonym: 'luna' },
      });
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        communityId: 'c1',
        status: 'PUBLISHED',
        commentsEnabled: true,
        authorId: 'author',
      });
      prisma.comment.create.mockResolvedValue({
        id: 'cm1',
        body: 'Je t’ai lu·e',
      });

      await expect(
        service.create('u1', 't1', { body: 'Je t’ai lu·e' }),
      ).resolves.toMatchObject({ id: 'cm1' });
      expect(prisma.comment.create).toHaveBeenCalled();
      expect(notifications.notifyTestimonialComment).toHaveBeenCalledWith({
        authorUserId: 'author',
        actorPseudonym: 'luna',
        testimonialId: 't1',
        communityId: 'c1',
        commentId: 'cm1',
      });
    });

    it('ne notifie pas si l’auteur commente son propre témoignage', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        profile: { pseudonym: 'luna' },
      });
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        communityId: 'c1',
        status: 'PUBLISHED',
        commentsEnabled: true,
        authorId: 'u1',
      });
      prisma.comment.create.mockResolvedValue({
        id: 'cm1',
        body: 'Note perso',
      });

      await service.create('u1', 't1', { body: 'Note perso' });
      expect(notifications.notifyTestimonialComment).not.toHaveBeenCalled();
    });

    it('refuse si commentaires fermés', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        communityId: 'c1',
        status: 'PUBLISHED',
        commentsEnabled: false,
        authorId: 'author',
      });
      await expect(
        service.create('u1', 't1', { body: 'hello' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un ADMIN plateforme', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      await expect(
        service.create('admin', 't1', { body: 'hello' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('list', () => {
    it('liste les commentaires visibles', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        communityId: 'c1',
        status: 'PUBLISHED',
        commentsEnabled: true,
        authorId: 'author',
      });
      prisma.comment.findMany.mockResolvedValue([{ id: 'cm1' }]);
      await expect(service.list('u1', 't1')).resolves.toEqual([{ id: 'cm1' }]);
    });

    it('404 si témoignage non publié', async () => {
      prisma.testimonial.findUnique.mockResolvedValue({
        id: 't1',
        status: 'DRAFT',
        communityId: 'c1',
      });
      await expect(service.list('u1', 't1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('auteur du commentaire peut retirer', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'cm1',
        authorId: 'u1',
        testimonialId: 't1',
        status: 'VISIBLE',
        testimonial: {
          authorId: 'other',
          communityId: 'c1',
          status: 'PUBLISHED',
        },
      });
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        status: 'ACTIVE',
      });
      prisma.comment.update.mockResolvedValue({
        id: 'cm1',
        status: 'REMOVED',
      });
      await expect(service.remove('u1', 't1', 'cm1')).resolves.toMatchObject({
        status: 'REMOVED',
      });
    });
  });
});
