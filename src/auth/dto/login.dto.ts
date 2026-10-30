import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Email (insensible à la casse) ou pseudonyme. */
  @IsString()
  @IsNotEmpty()
  login!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
