import { IsEnum } from 'class-validator';

/** Transitions admin hors DRAFT (la création pose toujours DRAFT). */
export const CommunityStatusTransition = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export class UpdateCommunityStatusDto {
  @IsEnum(CommunityStatusTransition)
  status!: (typeof CommunityStatusTransition)[keyof typeof CommunityStatusTransition];
}
