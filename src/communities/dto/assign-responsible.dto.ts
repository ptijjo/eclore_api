import { IsEnum, IsUUID } from 'class-validator';

const ResponsibleRole = {
  OWNER: 'OWNER',
  MODERATOR: 'MODERATOR',
} as const;

export class AssignResponsibleDto {
  @IsUUID()
  userId!: string;

  @IsEnum(ResponsibleRole)
  role!: (typeof ResponsibleRole)[keyof typeof ResponsibleRole];
}
