import { IsIn } from 'class-validator';

export class DecideMembershipDto {
  @IsIn(['ACCEPT', 'REJECT'])
  decision!: 'ACCEPT' | 'REJECT';
}
