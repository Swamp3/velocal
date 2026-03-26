import { IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSeriesDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  disciplineSlug?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}
