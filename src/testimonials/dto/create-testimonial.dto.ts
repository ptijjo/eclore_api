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

  /** Défaut true côté Prisma si omis. */
  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;
}
