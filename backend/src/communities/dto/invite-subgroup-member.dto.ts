import { IsUUID } from 'class-validator';

/** Subgroup members are picked from the community's members, never by email. */
export class InviteSubgroupMemberDto {
  @IsUUID()
  userId: string;
}
