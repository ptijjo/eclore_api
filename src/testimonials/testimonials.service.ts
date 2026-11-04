import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import type { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import type { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import type { ListTestimonialsQueryDto } from './dto/list-testimonials.query.dto.js';

const testimonialSelect = {
  id: true,
  authorId: true,
  communityId: true,
  format: true,
  status: true,
  intention: true,
  topic: true,
  body: true,
  mediaId: true,
  commentsEnabled: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      profile: { select: { pseudonym: true } },
    },
  },
} as const;

/** Découpe le champ Community.theme en tags affichables. */
export function parseCommunityThemeTags(theme: string): string[] {
  return theme
    .split(/[,·|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipAccess: MembershipAccessService,
  ) {}

  async create(
    authorId: string,
    communityId: string,
    dto: CreateTestimonialDto,
  ) {
    // Les ADMIN plateforme surveillent / régulent — ils ne déposent pas de témoignage.
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { role: true },
    });
    if (author?.role === 'ADMIN') {
      throw new ForbiddenException(
        'Les comptes admin ne publient pas de témoignages. Leur rôle est de surveiller et de réguler.',
      );
    }

    await this.membershipAccess.requireAcceptedMembership(
      authorId,
      communityId,
    );

    const topic = await this.resolveTopic(communityId, dto.topic);

    if (dto.format === 'TEXT') {
      if (!dto.body?.trim()) {
        throw new BadRequestException('Le texte du témoignage est requis.');
      }
      return this.prisma.testimonial.create({
        data: {
          authorId,
          communityId,
          format: 'TEXT',
          status: 'DRAFT',
          body: dto.body,
          intention: dto.intention,
          topic,
          commentsEnabled: dto.commentsEnabled ?? true,
        },
        select: testimonialSelect,
      });
    }

    if (dto.format === 'VOICE') {
      if (!dto.mediaId) {
        throw new BadRequestException('Un média audio est requis.');
      }
      await this.assertUsableVoiceMedia(authorId, dto.mediaId, null);
      return this.prisma.testimonial.create({
        data: {
          authorId,
          communityId,
          format: 'VOICE',
          status: 'DRAFT',
          mediaId: dto.mediaId,
          intention: dto.intention,
          topic,
          commentsEnabled: dto.commentsEnabled ?? true,
        },
        select: testimonialSelect,
      });
    }

    const _exhaustive: never = dto.format;
    throw new BadRequestException(`Format non supporté: ${_exhaustive}`);
  }

  /**
   * Modifie un témoignage de l’auteur — brouillon ou déjà publié
   * (texte, intention, commentaires). Pas de changement de statut ici.
   */
  async update(userId: string, id: string, dto: UpdateTestimonialDto) {
    const own = await this.requireOwnEditable(userId, id);
    if (own.format === 'TEXT' && dto.body !== undefined && !dto.body.trim()) {
      throw new BadRequestException('Le texte ne peut pas être vide.');
    }

    const topic =
      dto.topic !== undefined
        ? await this.resolveTopic(own.communityId, dto.topic)
        : undefined;

    return this.prisma.testimonial.update({
      where: { id },
      data: {
        body: dto.body,
        intention: dto.intention,
        ...(topic !== undefined ? { topic } : {}),
        commentsEnabled: dto.commentsEnabled,
      },
      select: testimonialSelect,
    });
  }

  /** Brouillons + publications de l’auteur (Mes témoignages). */
  async listMine(userId: string) {
    return this.prisma.testimonial.findMany({
      where: { authorId: userId },
      select: {
        ...testimonialSelect,
        community: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async publish(userId: string, id: string) {
    const draft = await this.requireOwnDraft(userId, id);
    await this.membershipAccess.requireAcceptedMembership(
      userId,
      draft.communityId,
    );

    if (draft.format === 'TEXT' && !draft.body?.trim()) {
      throw new BadRequestException('Impossible de publier un texte vide.');
    }
    if (draft.format === 'VOICE') {
      if (!draft.mediaId) {
        throw new BadRequestException('Impossible de publier sans audio.');
      }
      await this.assertUsableVoiceMedia(userId, draft.mediaId, draft.id);
    }

    // Publication explicite : jamais automatique à la fin de l’upload.
    return this.prisma.testimonial.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      select: testimonialSelect,
    });
  }

  async listPublished(
    userId: string,
    communityId: string,
    query: ListTestimonialsQueryDto,
  ) {
    await this.membershipAccess.requireAcceptedMembership(userId, communityId);

    const limit = query.limit ?? 20;
    const cursor = query.cursor
      ? await this.decodeCursor(query.cursor)
      : undefined;

    const topicFilter = query.topic?.trim();
    const rows = await this.prisma.testimonial.findMany({
      where: {
        communityId,
        status: 'PUBLISHED',
        ...(topicFilter ? { topic: topicFilter } : {}),
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: cursor.publishedAt } },
                {
                  publishedAt: cursor.publishedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: testimonialSelect,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last?.publishedAt
        ? this.encodeCursor(last.id, last.publishedAt)
        : null;

    return { items, nextCursor };
  }

  async getById(userId: string, id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
      select: testimonialSelect,
    });
    if (!testimonial) {
      throw new NotFoundException();
    }

    if (testimonial.status === 'DRAFT') {
      if (testimonial.authorId !== userId) {
        throw new NotFoundException();
      }
      return testimonial;
    }

    await this.membershipAccess.requireAcceptedMembership(
      userId,
      testimonial.communityId,
    );
    return testimonial;
  }

  async delete(userId: string, id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!testimonial) {
      throw new NotFoundException();
    }
    if (testimonial.authorId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.testimonial.delete({ where: { id } });
    return { message: 'Témoignage supprimé.' };
  }

  /**
   * Si la communauté a plusieurs thèmes → topic obligatoire et dans la liste.
   * Un seul thème → topic = ce thème (ou le choix fourni s’il matche).
   */
  private async resolveTopic(
    communityId: string,
    topic: string | undefined,
  ): Promise<string | null> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { theme: true },
    });
    if (!community) {
      throw new NotFoundException();
    }
    const tags = parseCommunityThemeTags(community.theme);
    if (tags.length === 0) {
      return topic?.trim() || null;
    }
    if (tags.length === 1) {
      const only = tags[0]!;
      if (topic?.trim() && topic.trim() !== only) {
        throw new BadRequestException(
          `Le thème doit être « ${only} » pour cette communauté.`,
        );
      }
      return only;
    }
    const chosen = topic?.trim();
    if (!chosen) {
      throw new BadRequestException(
        'Choisis un thème pour que les autres puissent te trouver plus facilement.',
      );
    }
    if (!tags.includes(chosen)) {
      throw new BadRequestException(
        'Ce thème ne fait pas partie de cette communauté.',
      );
    }
    return chosen;
  }

  private async requireOwnDraft(userId: string, id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
    });
    if (!testimonial || testimonial.status !== 'DRAFT') {
      throw new NotFoundException();
    }
    if (testimonial.authorId !== userId) {
      throw new ForbiddenException();
    }
    return testimonial;
  }

  /** Auteur uniquement — brouillon ou publié (édition / paramètres). */
  private async requireOwnEditable(userId: string, id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
    });
    if (!testimonial) {
      throw new NotFoundException();
    }
    if (testimonial.authorId !== userId) {
      throw new ForbiddenException();
    }
    if (
      testimonial.status !== 'DRAFT' &&
      testimonial.status !== 'PUBLISHED'
    ) {
      throw new NotFoundException();
    }
    return testimonial;
  }

  private async assertUsableVoiceMedia(
    ownerId: string,
    mediaId: string,
    allowTestimonialId: string | null,
  ) {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (
      !media ||
      media.ownerId !== ownerId ||
      media.status !== 'READY'
    ) {
      throw new BadRequestException('Média audio invalide ou non prêt.');
    }

    const linked = await this.prisma.testimonial.findUnique({
      where: { mediaId },
      select: { id: true },
    });
    if (linked && linked.id !== allowTestimonialId) {
      throw new BadRequestException('Ce média est déjà lié à un témoignage.');
    }
  }

  private encodeCursor(id: string, publishedAt: Date) {
    return Buffer.from(
      JSON.stringify({ id, publishedAt: publishedAt.toISOString() }),
      'utf8',
    ).toString('base64url');
  }

  private async decodeCursor(cursor: string) {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { id: string; publishedAt: string };
      return { id: parsed.id, publishedAt: new Date(parsed.publishedAt) };
    } catch {
      throw new BadRequestException('Curseur de pagination invalide.');
    }
  }
}
