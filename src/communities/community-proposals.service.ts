import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateCommunityProposalDto } from './dto/create-community-proposal.dto.js';
import type { DecideCommunityProposalDto } from './dto/decide-community-proposal.dto.js';

const proposalSelect = {
  id: true,
  proposerId: true,
  name: true,
  rationale: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class CommunityProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 1. Enregistrer la proposition en PENDING (pas de création auto de communauté).
   * 2. Notifier chaque ADMIN ACTIVE in-app pour réagir vite.
   */
  async create(proposerId: string, dto: CreateCommunityProposalDto) {
    const proposal = await this.prisma.communityProposal.create({
      data: {
        proposerId,
        name: dto.name.trim(),
        rationale: dto.rationale.trim(),
        status: 'PENDING',
      },
      select: proposalSelect,
    });

    await this.notificationsService.notifyAdminsOfCommunityProposal(proposal);
    return proposal;
  }

  listForAdmin() {
    return this.prisma.communityProposal.findMany({
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
   * Décision admin uniquement sur PENDING — n’ouvre pas la communauté.
   * Après ACCEPTED, l’admin crée le DRAFT via POST /communities.
   */
  async decide(id: string, dto: DecideCommunityProposalDto) {
    const existing = await this.prisma.communityProposal.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException();
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictException(
        'Cette proposition a déjà été traitée.',
      );
    }

    return this.prisma.communityProposal.update({
      where: { id },
      data: { status: dto.decision },
      select: proposalSelect,
    });
  }
}
