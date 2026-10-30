import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Le mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule, un chiffre et un symbole.',
    },
  )
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_\-.]+$/, {
    message:
      'Le pseudonyme ne peut contenir que des lettres, chiffres, _, - et .',
  })
  pseudonym!: string;

  @Type(() => Date)
  @IsDate()
  birthDate!: Date;

  @IsBoolean()
  @IsNotEmpty()
  confirmIsAdult!: boolean;

  @IsBoolean()
  @IsNotEmpty()
  acceptTerms!: boolean;

  @IsBoolean()
  @IsNotEmpty()
  acceptAnonymityAck!: boolean;
}
