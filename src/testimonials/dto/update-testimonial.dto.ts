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
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;
}
