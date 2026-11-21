import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseCommunityThemeTags } from '../testimonials/testimonials.service.js';
import type { CreateThemeProposalDto } from './dto/create-theme-proposal.dto.js';
import type { DecideThemeProposalDto } from './dto/decide-theme-proposal.dto.js';

const proposalSelect = {
  id: true,
  communityId: true,
  proposerId: true,
  label: true,
  rationale: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class ThemeProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipAccess: MembershipAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 1. Exiger membre ACCEPTED (ou admin via MembershipAccess).
   * 2. Refuser si le libellé existe déjà (insensible à la casse).
   * 3. Créer PENDING — pas d’ajout auto à Community.theme.
   * 4. Notifier OWNER / MODERATOR + ADMIN (pas de rôle spécial pour le demandeur).
   */
  async create(
    proposerId: string,
    communityId: string,
    dto: CreateThemeProposalDto,
  ) {
    await this.membershipAccess.requireAcceptedMembership(
      proposerId,
      communityId,
    );

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, status: true, theme: true, name: true },
    });
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    const label = dto.label.trim();
    const rationale = dto.rationale.trim();
    const existingTags = parseCommunityThemeTags(community.theme);
    if (this.tagExists(existingTags, label)) {
      throw new ConflictException(
        'Cette pastille existe déjà dans la communauté.',
      );
    }

    const proposal = await this.prisma.communityThemeProposal.create({
      data: {
        communityId,
        proposerId,
        label,
        rationale,
        status: 'PENDING',
      },
      select: proposalSelect,
    });

    await this.notificationsService.notifyThemeProposal({
      id: proposal.id,
      communityId,
      communityName: community.name,
      label: proposal.label,
      rationale: proposal.rationale,
    });

    return proposal;
  }

  /**
   * File d’examen pour OWNER / MODERATOR / ADMIN plateforme.
   */
  async listForCommunity(actorId: string, communityId: string) {
    await this.requireThemeDecider(actorId, communityId);

    return this.prisma.communityThemeProposal.findMany({
      where: { communityId },
      select: {
        ...proposalSelect,
        proposer: {
          select: {
            profile: { select: { pseudonym: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Décision sur PENDING.
   * ACCEPTED → ajoute la pastille à Community.theme (séparateur ·).
   * Aucun rôle de modération n’est attribué au demandeur.
   */
  async decide(
    actorId: string,
    proposalId: string,
    dto: DecideThemeProposalDto,
  ) {
    const existing = await this.prisma.communityThemeProposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        status: true,
        communityId: true,
        label: true,
        rationale: true,
        community: {
          select: {
            id: true,
            theme: true,
            status: true,
            name: true,
          },
        },
      },
    });
    if (!existing || existing.community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictException('Cette proposition a déjà été traitée.');
    }

    await this.requireThemeDecider(actorId, existing.communityId);

    if (dto.decision === 'ACCEPTED') {
      const tags = parseCommunityThemeTags(existing.community.theme);
      if (this.tagExists(tags, existing.label)) {
        throw new BadRequestException(
          'Cette pastille est déjà présente dans la communauté.',
        );
      }
      const nextTheme = [...tags, existing.label.trim()].join(' · ');
      await this.prisma.community.update({
        where: { id: existing.communityId },
        data: { theme: nextTheme },
      });
    }

    return this.prisma.communityThemeProposal.update({
      where: { id: proposalId },
      data: { status: dto.decision },
      select: proposalSelect,
    });
  }

  private tagExists(tags: string[], label: string): boolean {
    const needle = label.trim().toLowerCase();
    return tags.some((tag) => tag.toLowerCase() === needle);
  }

  /** Décideurs : ADMIN plateforme ACTIVE, ou OWNER / MODERATOR ACCEPTED. */
  private async requireThemeDecider(actorId: string, communityId: string) {
    const [user, membership] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, role: true, status: true },
      }),
      this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: { userId: actorId, communityId },
        },
        select: { status: true, role: true },
      }),
    ]);

    if (user?.role === 'ADMIN' && user.status === 'ACTIVE') {
      return;
    }

    if (
      membership?.status === 'ACCEPTED' &&
      (membership.role === 'OWNER' || membership.role === 'MODERATOR')
    ) {
      return;
    }

    throw new ForbiddenException();
  }
}
