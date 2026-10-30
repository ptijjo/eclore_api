import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CommunityJoinPolicy } from '../../generated/prisma/enums.js';

/**
 * Création admin — toujours en DRAFT.
 * La publication (ACTIVE) exige au moins un OWNER (voir assign / ownerUserIds).
 */
export class CreateCommunityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  theme!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  rules!: string;

  @IsEnum(CommunityJoinPolicy)
  joinPolicy!: (typeof CommunityJoinPolicy)[keyof typeof CommunityJoinPolicy];

  /** Responsables principaux (adhésion ACCEPTED + rôle OWNER). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  ownerUserIds?: string[];

  /** Modérateurs délégués (adhésion ACCEPTED + rôle MODERATOR). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  moderatorUserIds?: string[];
}
