import { IsEnum } from 'class-validator';
import { SubgroupMemberRole } from '../entities/subgroup-member.entity';

export class UpdateSubgroupRoleDto {
  @IsEnum(SubgroupMemberRole)
  role: SubgroupMemberRole;
}
