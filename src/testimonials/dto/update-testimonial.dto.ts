import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TestimonialIntention } from '../../generated/prisma/enums.js';

export class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsEnum(TestimonialIntention)
  intention?: (typeof TestimonialIntention)[keyof typeof TestimonialIntention];

  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;
}
