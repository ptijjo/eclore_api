import { IsEnum } from 'class-validator';

/** Décision admin sur une proposition encore PENDING. */
export const CommunityProposalDecision = {
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  DISMISSED: 'DISMISSED',
} as const;

export class DecideCommunityProposalDto {
  @IsEnum(CommunityProposalDecision)
  decision!: (typeof CommunityProposalDecision)[keyof typeof CommunityProposalDecision];
}
