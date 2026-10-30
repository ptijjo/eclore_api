import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityProposalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  rationale!: string;
}
