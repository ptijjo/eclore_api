import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export const PushPlatformDto = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WEB: 'WEB',
} as const;

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token!: string;

  @IsEnum(PushPlatformDto)
  platform!: (typeof PushPlatformDto)[keyof typeof PushPlatformDto];
}
