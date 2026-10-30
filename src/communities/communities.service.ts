import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignResponsibleDto } from './dto/assign-responsible.dto.js';
import type { CreateCommunityDto } from './dto/create-community.dto.js';
import type { UpdateCommunityStatusDto } from './dto/update-community-status.dto.js';

const communitySelect = {
  id: true,
  name: true,
  description: true,
  theme: true,
  rules: true,
  visibility: true,
  joinPolicy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue membre : uniquement les communautés ACTIVE. */
  list() {
    return this.prisma.community.findMany({
      where: { status: 'ACTIVE' },
      select: communitySelect,
      orderBy: { name: 'asc' },
    });
  }

  /** Catalogue ops : tous les statuts (brouillons, suspendues, archivées). */
  listAllForAdmin() {
    return this.prisma.community.findMany({
      select: communitySelect,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: communitySelect,
    });
    if (!community) {
      throw new NotFoundException();
    }
    // Métadonnées hors ACTIVE : pas exposées au catalogue membre (404 sans fuite).
    if (community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }
    return community;
  }

  async getByIdForAdmin(id: string) {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: communitySelect,
    });
    if (!community) {
      throw new NotFoundException();
    }
    return community;
  }

  /**
   * 1. Création toujours en DRAFT.
   * 2. Responsables optionnels → adhésions ACCEPTED (OWNER / MODERATOR).
   * 3. Publication explicite via updateStatus(ACTIVE).
   */
  async create(dto: CreateCommunityDto) {
    const existing = await this.prisma.community.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Une communauté porte déjà ce nom.');
    }

    const ownerIds = uniqueIds(dto.ownerUserIds ?? []);
    const moderatorIds = uniqueIds(dto.moderatorUserIds ?? []).filter(
      (id) => !ownerIds.includes(id),
    );
    const responsibleIds = [...ownerIds, ...moderatorIds];

    if (responsibleIds.length > 0) {
      await this.assertUsersExist(responsibleIds);
    }

    return this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: dto.name,
          description: dto.description,
          theme: dto.theme,
          rules: dto.rules,
          joinPolicy: dto.joinPolicy,
          status: 'DRAFT',
        },
        select: communitySelect,
      });

      const now = new Date();
      for (const userId of ownerIds) {
        await tx.communityMembership.create({
          data: {
            userId,
            communityId: community.id,
            role: 'OWNER',
            status: 'ACCEPTED',
            lastJoinRequestedAt: now,
          },
        });
      }
      for (const userId of moderatorIds) {
        await tx.communityMembership.create({
          data: {
            userId,
            communityId: community.id,
            role: 'MODERATOR',
            status: 'ACCEPTED',
            lastJoinRequestedAt: now,
          },
        });
      }

      return community;
    });
  }

  /**
   * Transitions autorisées :
   * - → ACTIVE : depuis DRAFT ou SUSPENDED ; exige ≥ 1 OWNER ACCEPTED
   * - → SUSPENDED : depuis ACTIVE
   * - → ARCHIVED : depuis ACTIVE ou SUSPENDED
   */
  async updateStatus(id: string, dto: UpdateCommunityStatusDto) {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        description: true,
        theme: true,
        rules: true,
      },
    });
    if (!community) {
      throw new NotFoundException();
    }

    this.assertStatusTransition(community.status, dto.status);

    if (dto.status === 'ACTIVE') {
      if (
        !community.description.trim() ||
        !community.theme.trim() ||
        !community.rules.trim()
      ) {
        throw new BadRequestException(
          'Description, thème et règles sont requis avant publication.',
        );
      }
      const ownerCount = await this.prisma.communityMembership.count({
        where: {
          communityId: id,
          status: 'ACCEPTED',
          role: 'OWNER',
        },
      });
      if (ownerCount < 1) {
        throw new BadRequestException(
          'Désigne au moins un responsable (OWNER) avant de publier.',
        );
      }
    }

    return this.prisma.community.update({
      where: { id },
      data: { status: dto.status },
      select: communitySelect,
    });
  }

  /**
   * Nomme un OWNER ou MODERATOR (adhésion ACCEPTED).
   * Ne peut pas s’auto-attribuer côté membre : réservé ADMIN plateforme.
   */
  async assignResponsible(communityId: string, dto: AssignResponsibleDto) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, status: true },
    });
    if (!community) {
      throw new NotFoundException();
    }
    if (community.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Impossible de nommer un responsable sur une communauté archivée.',
      );
    }

    await this.assertUsersExist([dto.userId]);

    const existing = await this.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: { userId: dto.userId, communityId },
      },
    });
    const now = new Date();

    if (existing) {
      return this.prisma.communityMembership.update({
        where: { id: existing.id },
        data: {
          role: dto.role,
          status: 'ACCEPTED',
          lastJoinRequestedAt: existing.lastJoinRequestedAt ?? now,
        },
        select: {
          id: true,
          userId: true,
          communityId: true,
          role: true,
          status: true,
        },
      });
    }

    return this.prisma.communityMembership.create({
      data: {
        userId: dto.userId,
        communityId,
        role: dto.role,
        status: 'ACCEPTED',
        lastJoinRequestedAt: now,
      },
      select: {
        id: true,
        userId: true,
        communityId: true,
        role: true,
        status: true,
      },
    });
  }

  private assertStatusTransition(
    from: string,
    to: UpdateCommunityStatusDto['status'],
  ) {
    const allowed: Record<string, UpdateCommunityStatusDto['status'][]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['SUSPENDED', 'ARCHIVED'],
      SUSPENDED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [],
    };
    const next = allowed[from] ?? [];
    if (!next.includes(to)) {
      throw new BadRequestException(
        `Transition de statut interdite : ${from} → ${to}.`,
      );
    }
  }

  private async assertUsersExist(userIds: string[]) {
    const found = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    if (found.length !== userIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs utilisateurs responsables sont introuvables.',
      );
    }
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
