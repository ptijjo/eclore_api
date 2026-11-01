import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const ReportTargetTypeDto = {
  TESTIMONIAL: 'TESTIMONIAL',
  COMMENT: 'COMMENT',
  PROFILE: 'PROFILE',
} as const;

export const ReportReasonDto = {
  HARASSMENT: 'HARASSMENT',
  THREAT: 'THREAT',
  SCAM: 'SCAM',
  IMPERSONATION: 'IMPERSONATION',
  PERSONAL_DATA: 'PERSONAL_DATA',
  DANGEROUS_CONTENT: 'DANGEROUS_CONTENT',
  OTHER: 'OTHER',
} as const;

export class CreateReportDto {
  @IsEnum(ReportTargetTypeDto)
  targetType!: (typeof ReportTargetTypeDto)[keyof typeof ReportTargetTypeDto];

  @IsUUID()
  targetId!: string;

  @IsEnum(ReportReasonDto)
  reason!: (typeof ReportReasonDto)[keyof typeof ReportReasonDto];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
