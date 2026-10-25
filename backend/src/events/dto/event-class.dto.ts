import {
  CATEGORY_KEYS,
  CHAMPIONSHIP_LEVELS,
  type ChampionshipLevel,
  CLASS_GENDERS,
  CLASS_LICENSES,
  LICENSE_CLASS_KEYS,
  type ClassGender,
  type ClassLicense,
  type LicenseClass,
} from '../racing';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** A rating class as entered in the event form. */
export class EventClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(CLASS_GENDERS)
  gender?: ClassGender;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  ageMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  ageMax?: number | null;

  /** Age category key (`u15`, `elite`, `masters2` …). Fills missing ages. */
  @IsOptional()
  @IsIn([...CATEGORY_KEYS, null])
  category?: string | null;

  @IsOptional()
  @IsIn(CLASS_LICENSES)
  license?: ClassLicense;

  @IsOptional()
  @IsBoolean()
  dayLicense?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(LICENSE_CLASS_KEYS, { each: true })
  licenseClasses?: LicenseClass[] | null;

  /** Length in km (one decimal). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9999)
  distanceKm?: number | null;

  /** Climbing in metres. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  elevationM?: number | null;

  @IsOptional()
  @IsISO8601()
  startTime?: string | null;

  @IsOptional()
  @IsIn(CHAMPIONSHIP_LEVELS)
  championship?: ChampionshipLevel | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
