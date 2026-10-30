import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_\-.]+$/, {
    message:
      'Le pseudonyme ne peut contenir que des lettres, chiffres, _, - et .',
  })
  pseudonym?: string;

  /** Chaîne vide = effacer la bio. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(280, { message: 'La bio ne peut pas dépasser 280 caractères.' })
  bio?: string | null;
}
