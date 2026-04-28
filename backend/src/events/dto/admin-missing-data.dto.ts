import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum MissingDataType {
  URL = 'url',
  ADDRESS = 'address',
  COORDINATES = 'coordinates',
  DESCRIPTION = 'description',
}

export class AdminMissingDataDto {
  @IsOptional()
  @IsEnum(MissingDataType)
  type?: MissingDataType;

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
}
