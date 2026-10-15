import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminCommunitySearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['public', 'request', 'private'])
  visibility?: 'public' | 'request' | 'private';

  @IsOptional()
  @IsIn(['createdAt', 'name', 'members', 'pending'])
  sort?: 'createdAt' | 'name' | 'members' | 'pending';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
