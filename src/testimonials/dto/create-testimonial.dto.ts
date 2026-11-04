import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  TestimonialFormat,
  TestimonialIntention,
} from '../../generated/prisma/enums.js';

export class CreateTestimonialDto {
  @IsEnum(TestimonialFormat)
  format!: (typeof TestimonialFormat)[keyof typeof TestimonialFormat];

  @ValidateIf((o: CreateTestimonialDto) => o.format === 'TEXT')
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body?: string;

  @ValidateIf((o: CreateTestimonialDto) => o.format === 'VOICE')
  @IsUUID()
  mediaId?: string;

  @IsOptional()
  @IsEnum(TestimonialIntention)
  intention?: (typeof TestimonialIntention)[keyof typeof TestimonialIntention];

  /**
   * Thème de lecture — doit correspondre à un tag du `theme` de la communauté
   * (séparateurs · , | /). Obligatoire si la communauté a plusieurs thèmes.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  topic?: string;

  /** Défaut true côté Prisma si omis. */
  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;
}
