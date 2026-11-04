import { IsEnum } from 'class-validator';
import { SupportReactionKind } from '../../generated/prisma/enums.js';

export class UpsertSupportReactionDto {
  @IsEnum(SupportReactionKind)
  kind!: (typeof SupportReactionKind)[keyof typeof SupportReactionKind];
}
