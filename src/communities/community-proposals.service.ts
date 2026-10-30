import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommunityProposalDto } from './dto/create-community-proposal.dto.js';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Proposition membre — n’ouvre pas la communauté.
   * L’équipe Éclore crée et configure l’espace si l’idée est retenue.
   */
  create(proposerId: string, dto: CreateCommunityProposalDto) {
    return this.prisma.communityProposal.create({
      data: {
        proposerId,
        name: dto.name.trim(),
        rationale: dto.rationale.trim(),
        status: 'PENDING',
      },
      select: proposalSelect,
    });
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
}
