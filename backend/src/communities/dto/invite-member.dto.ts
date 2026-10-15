import { IsEmail, IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** Invite by email, or by user id when picked from the community's members. */
export class InviteMemberDto {
  @ValidateIf((dto: InviteMemberDto) => !dto.userId)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
