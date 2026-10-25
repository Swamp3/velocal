import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Search, filter and page of a member list (club or subgroup). */
export class MemberSearchDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  /** `admin` (club) or `moderator` (subgroup) show only the people with that role. */
  @IsOptional()
  @IsIn(['all', 'admin', 'moderator', 'member'])
  role?: 'all' | 'admin' | 'moderator' | 'member';

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

  /** Club list only: leave out people who are already in this subgroup (for "add member"). */
  @IsOptional()
  @IsUUID()
  excludeSubgroup?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
