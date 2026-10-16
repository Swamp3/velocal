import { IsEmail, IsUUID, ValidateIf } from 'class-validator';

/**
 * Subgroup members come from the community's members, picked by id or found by
 * email (display names are not unique). Either `userId` or `email` is required.
 */
export class InviteSubgroupMemberDto {
  @ValidateIf((dto: InviteSubgroupMemberDto) => !dto.email)
  @IsUUID()
  userId?: string;

  @ValidateIf((dto: InviteSubgroupMemberDto) => !dto.userId)
  @IsEmail()
  email?: string;
}
