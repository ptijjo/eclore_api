import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const membershipSelect = {
  id: true,
  userId: true,
  communityId: true,
  role: true,
  status: true,
  lastJoinRequestedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async join(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, joinPolicy: true, status: true },
    });
    // Adhésion seulement sur communauté ACTIVE (brouillon / suspendue / archivée → 404).
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    await this.assertJoinCooldown(userId, communityId);

    const existing = await this.prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (existing?.status === 'ACCEPTED' || existing?.status === 'PENDING') {
      throw new ConflictException(
        existing.status === 'ACCEPTED'
          ? 'Tu es déjà membre de cette communauté.'
          : 'Une demande d’adhésion est déjà en cours.',
      );
    }

    // Réévaluer la joinPolicy actuelle (réadhésion LEFT / REJECTED ou première).
    const nextStatus =
      community.joinPolicy === 'OPEN' ? 'ACCEPTED' : 'PENDING';
    const now = new Date();

    const membership = existing
      ? await this.prisma.communityMembership.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            role: 'MEMBER',
            lastJoinRequestedAt: now,
          },
          select: membershipSelect,
        })
      : await this.prisma.communityMembership.create({
          data: {
            userId,
            communityId,
            status: nextStatus,
            role: 'MEMBER',
            lastJoinRequestedAt: now,
          },
          select: membershipSelect,
        });

    await this.markJoinCooldown(userId, communityId);

    // Demande sur REQUEST → notifier responsables + ADMIN.
    if (nextStatus === 'PENDING') {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { pseudonym: true },
      });
      await this.notifications.notifyMembershipRequest({
        communityId,
        communityName: community.name,
        requesterUserId: userId,
        requesterPseudonym: profile?.pseudonym ?? 'un membre',
      });
    }

    return membership;
  }

  /**
   * Statut d’adhésion du user courant — pour l’UI (témoigner seulement si ACCEPTED).
   * ADMIN plateforme ACTIVE → accès direct (pas de demande d’adhésion).
   * Communauté ACTIVE requise ; sinon 404.
   */
  async getMine(userId: string, communityId: string) {
    const [community, user] = await Promise.all([
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { id: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
      }),
    ]);
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    const membership = await this.prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      select: membershipSelect,
    });

    if (membership && membership.status !== 'LEFT') {
      return membership;
    }

    // Admin ops : accès immédiat sans passer par REQUEST / PENDING.
    if (user?.role === 'ADMIN' && user.status === 'ACTIVE') {
      return {
        id: `admin-access:${userId}:${communityId}`,
        userId,
        communityId,
        role: 'OWNER' as const,
        status: 'ACCEPTED' as const,
        lastJoinRequestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return {
      communityId,
      status: 'NONE' as const,
      role: null,
      id: null,
      userId,
    };
  }

  async leave(userId: string, communityId: string) {
    const membership = await this.prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (!membership || membership.status !== 'ACCEPTED') {
      throw new NotFoundException();
    }

    return this.prisma.communityMembership.update({
      where: { id: membership.id },
      data: { status: 'LEFT' },
      select: membershipSelect,
    });
  }

  async listAccepted(requesterId: string, communityId: string) {
    await this.requireAccepted(requesterId, communityId);

    return this.prisma.communityMembership.findMany({
      where: { communityId, status: 'ACCEPTED' },
      select: {
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            profile: { select: { pseudonym: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** File des demandes PENDING — OWNER / MODERATOR / ADMIN plateforme. */
  async listPending(actorId: string, communityId: string) {
    await this.requireCanDecide(actorId, communityId);

    return this.prisma.communityMembership.findMany({
      where: { communityId, status: 'PENDING' },
      select: {
        userId: true,
        role: true,
        status: true,
        lastJoinRequestedAt: true,
        createdAt: true,
        user: {
          select: {
            profile: { select: { pseudonym: true } },
          },
        },
      },
      orderBy: { lastJoinRequestedAt: 'asc' },
    });
  }

  /**
   * Adhésions du user courant (ACCEPTED + PENDING) — pour badges liste / Accueil.
   */
  async listMine(userId: string) {
    return this.prisma.communityMembership.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      select: {
        ...membershipSelect,
        community: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Toutes les demandes PENDING (toutes communautés) — ADMIN plateforme.
   * Pour la file Accueil / cloche, pas seulement communauté par communauté.
   */
  async listAllPending(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true, status: true },
    });
    if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      throw new ForbiddenException();
    }

    return this.prisma.communityMembership.findMany({
      where: { status: 'PENDING' },
      select: {
        userId: true,
        communityId: true,
        role: true,
        status: true,
        lastJoinRequestedAt: true,
        createdAt: true,
        community: {
          select: { id: true, name: true },
        },
        user: {
          select: {
            profile: { select: { pseudonym: true } },
          },
        },
      },
      orderBy: { lastJoinRequestedAt: 'asc' },
    });
  }

  async decide(
    moderatorId: string,
    communityId: string,
    targetUserId: string,
    decision: 'ACCEPT' | 'REJECT',
  ) {
    await this.requireCanDecide(moderatorId, communityId);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, status: true },
    });
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    const target = await this.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: { userId: targetUserId, communityId },
      },
    });
    if (!target || target.status !== 'PENDING') {
      throw new NotFoundException();
    }

    const updated = await this.prisma.communityMembership.update({
      where: { id: target.id },
      data: { status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' },
      select: membershipSelect,
    });

    await this.notifications.notifyMembershipDecision({
      communityId,
      communityName: community.name,
      targetUserId,
      accepted: decision === 'ACCEPT',
    });

    return updated;
  }

  private async requireCanDecide(actorId: string, communityId: string) {
    const [membership, actor] = await Promise.all([
      this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: { userId: actorId, communityId },
        },
        select: { status: true, role: true },
      }),
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { role: true, status: true },
      }),
    ]);

    const isPlatformAdmin =
      actor?.role === 'ADMIN' && actor.status === 'ACTIVE';
    const isLocalModerator =
      membership?.status === 'ACCEPTED' &&
      (membership.role === 'OWNER' || membership.role === 'MODERATOR');

    if (!isPlatformAdmin && !isLocalModerator) {
      throw new ForbiddenException();
    }
  }

  private async requireAccepted(userId: string, communityId: string) {
    const [membership, community] = await Promise.all([
      this.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId, communityId } },
      }),
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { status: true },
      }),
    ]);
    if (
      !community ||
      community.status !== 'ACTIVE' ||
      !membership ||
      membership.status !== 'ACCEPTED'
    ) {
      throw new NotFoundException();
    }
    return membership;
  }

  private joinCooldownKey(userId: string, communityId: string) {
    return `join-request:${userId}:${communityId}`;
  }

  private async assertJoinCooldown(userId: string, communityId: string) {
    const hit = await this.redis.get(this.joinCooldownKey(userId, communityId));
    if (hit) {
      throw new HttpException(
        'Trop de demandes d’adhésion. Réessaie plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async markJoinCooldown(userId: string, communityId: string) {
    const ttl = Number(
      this.config.get('JOIN_REQUEST_COOLDOWN_SECONDS', 3600),
    );
    await this.redis.set(
      this.joinCooldownKey(userId, communityId),
      '1',
      ttl,
    );
  }
}
