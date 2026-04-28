import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  homeZip?: string;

  @IsOptional()
  @IsString()
  homeCountry?: string;

  @IsOptional()
  @IsIn(['de', 'en'])
  preferredLanguage?: string;

  @IsOptional()
  @IsIn(['de', 'en'])
  preferredLocale?: string;
}
