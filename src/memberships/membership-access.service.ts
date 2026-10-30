import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type AcceptedMembership = {
  id: string;
  userId: string;
  communityId: string;
  role: string;
  status: 'ACCEPTED';
};

@Injectable()
export class MembershipAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Accès contenu : communauté ACTIVE **et** membership ACCEPTED.
   * Tout autre cas → 404 (pas de fuite sur existence / statut).
   */
  async requireAcceptedMembership(
    userId: string,
    communityId: string,
  ): Promise<AcceptedMembership> {
    const [membership, community] = await Promise.all([
      this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: { userId, communityId },
        },
        select: {
          id: true,
          userId: true,
          communityId: true,
          role: true,
          status: true,
        },
      }),
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { id: true, status: true },
      }),
    ]);

    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    if (!membership || membership.status !== 'ACCEPTED') {
      throw new NotFoundException();
    }

    return membership as AcceptedMembership;
  }
}
