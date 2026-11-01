import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Clôture / suivi d’un signalement par un ADMIN. */
export const ReportDecisionDto = {
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;

export const ModerationMeasureDto = {
  WARNING: 'WARNING',
  CONTENT_REMOVAL: 'CONTENT_REMOVAL',
  RESTRICTION: 'RESTRICTION',
  SUSPENSION: 'SUSPENSION',
  EXCLUSION: 'EXCLUSION',
} as const;

export class DecideReportDto {
  @IsEnum(ReportDecisionDto)
  decision!: (typeof ReportDecisionDto)[keyof typeof ReportDecisionDto];

  /** Mesure optionnelle si RESOLVED (obligatoire si subjectUserId ou CONTENT_REMOVAL). */
  @ValidateIf((o: DecideReportDto) => o.decision === 'RESOLVED')
  @IsOptional()
  @IsEnum(ModerationMeasureDto)
  measure?: (typeof ModerationMeasureDto)[keyof typeof ModerationMeasureDto];

  @ValidateIf((o: DecideReportDto) => Boolean(o.measure))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  measureReason?: string;

  /** Compte concerné par la sanction (auteur, signalant abusif, etc.). */
  @IsOptional()
  @IsUUID()
  subjectUserId?: string;
}
