import { IsEnum } from 'class-validator';

/** Même vocabulaire que les propositions de communauté. */
export const ThemeProposalDecision = {
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  DISMISSED: 'DISMISSED',
} as const;

export class DecideThemeProposalDto {
  @IsEnum(ThemeProposalDecision)
  decision!: (typeof ThemeProposalDecision)[keyof typeof ThemeProposalDecision];
}
