import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum UserSortField {
  CREATED_AT = 'createdAt',
  EMAIL = 'email',
  DISPLAY_NAME = 'displayName',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class AdminUserSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  role?: 'admin' | 'user';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(UserSortField)
  sort?: UserSortField = UserSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}
