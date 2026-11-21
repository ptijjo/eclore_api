import { IsString, MaxLength, MinLength } from 'class-validator';

/** Proposition d’une pastille thème — pas de création auto ni rôle modérateur. */
export class CreateThemeProposalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  rationale!: string;
}
