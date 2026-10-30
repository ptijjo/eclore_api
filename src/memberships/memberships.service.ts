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
  ) {}

  async join(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, joinPolicy: true, status: true },
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
    return membership;
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

  async decide(
    moderatorId: string,
    communityId: string,
    targetUserId: string,
    decision: 'ACCEPT' | 'REJECT',
  ) {
    const moderator = await this.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: { userId: moderatorId, communityId },
      },
    });
    // OWNER et MODERATOR peuvent trancher les demandes — pas un ADMIN plateforme.
    const canDecide =
      moderator?.status === 'ACCEPTED' &&
      (moderator.role === 'OWNER' || moderator.role === 'MODERATOR');
    if (!canDecide) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: { userId: targetUserId, communityId },
      },
    });
    if (!target || target.status !== 'PENDING') {
      throw new NotFoundException();
    }

    return this.prisma.communityMembership.update({
      where: { id: target.id },
      data: { status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' },
      select: membershipSelect,
    });
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
