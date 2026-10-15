import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

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
