import {
  IsIn,
  IsInt,
  IsISO8601,
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

  @IsOptional()
  @IsIn(['none', 'hobby', 'license'])
  license?: 'none' | 'hobby' | 'license';

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
