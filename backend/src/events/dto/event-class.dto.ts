import { CATEGORY_KEYS } from '../categories';
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

export const CHAMPIONSHIP_LEVELS = [
  'club',
  'district',
  'state',
  'regional',
  'national',
  'continental',
  'world',
] as const;

/** A rating class as entered in the event form. */
export class EventClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(['open', 'male', 'female'])
  gender?: 'open' | 'male' | 'female';

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
  @IsIn(['open', 'unlicensed', 'license', 'uci'])
  license?: 'open' | 'unlicensed' | 'license' | 'uci';

  @IsOptional()
  @IsBoolean()
  dayLicense?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(['elite_amateur', 'amateur', 'master'], { each: true })
  licenseClasses?: ('elite_amateur' | 'amateur' | 'master')[] | null;

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
  championship?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
