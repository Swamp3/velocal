import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SubgroupVisibility } from '../entities/subgroup.entity';

export class CreateSubgroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsEnum(SubgroupVisibility)
  visibility?: SubgroupVisibility;
}
