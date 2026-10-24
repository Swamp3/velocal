import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  /** Strava profile link or athlete id; normalized by the service. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  stravaUrl?: string;

  @IsOptional()
  @IsString()
  homeZip?: string;

  @IsOptional()
  @IsString()
  homeCountry?: string;

  /** For the "fits me" class filter only; null clears it. */
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number | null;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsIn(['male', 'female', 'diverse'])
  gender?: 'male' | 'female' | 'diverse' | null;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsIn(['none', 'hobby', 'license'])
  licenseType?: 'none' | 'hobby' | 'license' | null;

  @IsOptional()
  @IsIn(['de', 'en'])
  preferredLanguage?: string;

  @IsOptional()
  @IsIn(['de', 'en'])
  preferredLocale?: string;
}
