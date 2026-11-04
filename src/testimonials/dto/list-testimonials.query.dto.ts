import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListTestimonialsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Filtre lecture par thème (exact match sur Testimonial.topic). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
