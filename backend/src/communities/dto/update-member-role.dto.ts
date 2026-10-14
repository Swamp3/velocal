import { IsEnum } from 'class-validator';
import { CommunityMemberRole } from '../entities/community-member.entity';

export class UpdateMemberRoleDto {
  @IsEnum(CommunityMemberRole)
  role: CommunityMemberRole;
}
