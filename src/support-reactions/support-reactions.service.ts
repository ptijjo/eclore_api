import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupportReactionKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { UpsertSupportReactionDto } from './dto/upsert-support-reaction.dto.js';

const KIND_LABELS: Record<SupportReactionKind, string> = {
  I_UNDERSTAND: 'Je te comprends',
  COURAGE: 'Du courage',
  I_READ_YOU: 'Je t’ai lu·e',
  NOT_ALONE: 'Tu n’es pas seul·e',
  THANK_YOU_TRUST: 'Merci de nous faire confiance',
};

@Injectable()
export class SupportReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipAccess: MembershipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * État des signes pour un témoignage publié.
   * - mine : mon unique signe (ou null)
   * - presentKinds : quels signes existent (sans chiffres publics)
   * - countsByKind : uniquement pour l’auteur (résumé privé)
   */
  async getForTestimonial(userId: string, testimonialId: string) {
    const testimonial = await this.requireReadablePublished(
      userId,
      testimonialId,
    );

    const rows = await this.prisma.testimonialSupportReaction.findMany({
      where: { testimonialId: testimonial.id },
      select: { userId: true, kind: true },
    });

    const mine = rows.find((row) => row.userId === userId)?.kind ?? null;
    const presentKinds = [...new Set(rows.map((row) => row.kind))];

    const isAuthor = testimonial.authorId === userId;
    let countsByKind: Record<SupportReactionKind, number> | null = null;
    if (isAuthor) {
      // Toujours les 5 clés (y compris 0) — l’auteur voit tout de suite la grille.
      countsByKind = {
        I_UNDERSTAND: 0,
        COURAGE: 0,
        I_READ_YOU: 0,
        NOT_ALONE: 0,
        THANK_YOU_TRUST: 0,
      };
      for (const row of rows) {
        countsByKind[row.kind] += 1;
      }
    }

    return { mine, presentKinds, countsByKind };
  }

  /**
   * Pose ou remplace mon unique signe.
   * Notifie l’auteur (sauf soi-même) si création ou changement de kind.
   */
  async upsert(
    userId: string,
    testimonialId: string,
    dto: UpsertSupportReactionDto,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        profile: { select: { pseudonym: true } },
      },
    });
    if (actor?.role === 'ADMIN') {
      throw new ForbiddenException(
        'Les comptes admin ne laissent pas de signes. Leur rôle est de surveiller et de réguler.',
      );
    }

    const testimonial = await this.requireReadablePublished(
      userId,
      testimonialId,
    );
    if (testimonial.authorId === userId) {
      throw new ForbiddenException(
        'Tu ne peux pas laisser de signe sur ton propre témoignage.',
      );
    }

    const existing = await this.prisma.testimonialSupportReaction.findUnique({
      where: {
        testimonialId_userId: {
          testimonialId: testimonial.id,
          userId,
        },
      },
      select: { kind: true },
    });

    const row = await this.prisma.testimonialSupportReaction.upsert({
      where: {
        testimonialId_userId: {
          testimonialId: testimonial.id,
          userId,
        },
      },
      create: {
        testimonialId: testimonial.id,
        userId,
        kind: dto.kind,
      },
      update: { kind: dto.kind },
      select: { kind: true, testimonialId: true },
    });

    const kindChanged = !existing || existing.kind !== dto.kind;
    if (kindChanged) {
      await this.notifications.notifySupportReaction({
        authorUserId: testimonial.authorId,
        actorPseudonym: actor?.profile?.pseudonym ?? 'Un membre',
        kindLabel: KIND_LABELS[dto.kind],
        testimonialId: testimonial.id,
        communityId: testimonial.communityId,
      });
    }

    return this.getForTestimonial(userId, row.testimonialId);
  }

  /** Retire mon signe. */
  async removeMine(userId: string, testimonialId: string) {
    await this.requireReadablePublished(userId, testimonialId);
    await this.prisma.testimonialSupportReaction.deleteMany({
      where: { testimonialId, userId },
    });
    return this.getForTestimonial(userId, testimonialId);
  }

  private async requireReadablePublished(
    userId: string,
    testimonialId: string,
  ) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id: testimonialId },
      select: {
        id: true,
        communityId: true,
        status: true,
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
