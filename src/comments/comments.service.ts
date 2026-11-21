import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';

const commentSelect = {
  id: true,
  testimonialId: true,
  authorId: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      profile: { select: { pseudonym: true } },
    },
  },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipAccess: MembershipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Liste les commentaires VISIBLE d’un témoignage publié.
   * Membre ACCEPTED (ou ADMIN plateforme) de la communauté.
   */
  async list(userId: string, testimonialId: string) {
    const testimonial = await this.requireReadablePublished(
      userId,
      testimonialId,
    );

    return this.prisma.comment.findMany({
      where: {
        testimonialId: testimonial.id,
        status: 'VISIBLE',
      },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  /**
   * Répondre sous un témoignage publié avec commentsEnabled.
   * ADMIN plateforme : lecture/modération, pas de dépôt de commentaire.
   */
  async create(userId: string, testimonialId: string, dto: CreateCommentDto) {
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        profile: { select: { pseudonym: true } },
      },
    });
    if (author?.role === 'ADMIN') {
      throw new ForbiddenException(
        'Les comptes admin ne déposent pas de commentaires. Leur rôle est de surveiller et de réguler.',
      );
    }

    const testimonial = await this.requireReadablePublished(
      userId,
      testimonialId,
    );
    if (!testimonial.commentsEnabled) {
      throw new BadRequestException(
        'L’auteur a fermé les commentaires sur ce témoignage.',
      );
    }

    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Le commentaire ne peut pas être vide.');
    }

    const comment = await this.prisma.comment.create({
      data: {
        testimonialId: testimonial.id,
        authorId: userId,
        body,
        status: 'VISIBLE',
      },
      select: commentSelect,
    });

    // Notifier le propriétaire de la confidence — pas soi-même.
    if (testimonial.authorId !== userId) {
      await this.notifications.notifyTestimonialComment({
        authorUserId: testimonial.authorId,
        actorPseudonym: author?.profile?.pseudonym ?? 'Un membre',
        testimonialId: testimonial.id,
        communityId: testimonial.communityId,
        commentId: comment.id,
      });
    }

    return comment;
  }

  /**
   * Soft-remove : status REMOVED.
   * Auteur du commentaire, auteur du témoignage, ou ADMIN plateforme.
   */
  async remove(userId: string, testimonialId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        testimonialId: true,
        status: true,
        testimonial: {
          select: {
            authorId: true,
            communityId: true,
            status: true,
          },
        },
      },
    });
    if (
      !comment ||
      comment.testimonialId !== testimonialId ||
      comment.status !== 'VISIBLE'
    ) {
      throw new NotFoundException();
    }

    await this.membershipAccess.requireAcceptedMembership(
      userId,
      comment.testimonial.communityId,
    );

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    const isAdmin = actor?.role === 'ADMIN' && actor.status === 'ACTIVE';
    const isCommentAuthor = comment.authorId === userId;
    const isTestimonialAuthor = comment.testimonial.authorId === userId;

    if (!isAdmin && !isCommentAuthor && !isTestimonialAuthor) {
      throw new ForbiddenException();
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { status: 'REMOVED' },
      select: commentSelect,
    });
  }

  private async requireReadablePublished(userId: string, testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id: testimonialId },
      select: {
        id: true,
        communityId: true,
        status: true,
        commentsEnabled: true,
        authorId: true,
      },
    });
    if (!testimonial || testimonial.status !== 'PUBLISHED') {
      throw new NotFoundException();
    }
    await this.membershipAccess.requireAcceptedMembership(
      userId,
      testimonial.communityId,
    );
    return testimonial;
  }
}
