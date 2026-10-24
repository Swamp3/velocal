import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DISCIPLINE_SEEDS } from '../../disciplines/disciplines.seed';

export const MAX_IMPORT_EVENTS = 5000;

export const IMPORT_STATUSES = ['published', 'cancelled', 'completed'] as const;

const URL_OPTIONS = { require_protocol: true, protocols: ['http', 'https'] };

/** One event as a person or script outside the app collected it. */
export class ImportEventDto {
  /** Stable id of the event at the source; re-importing the same id updates the event. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** ISO 8601 with offset, e.g. `2027-05-01T09:00:00+02:00`. */
  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsIn(DISCIPLINE_SEEDS.map((discipline) => discipline.slug))
  disciplineSlug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  locationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /** Two-letter ISO country code; `DE` when left out. */
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be a two-letter ISO code such as DE',
  })
  country?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  externalUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  sourceUrl?: string;

  @IsIn(IMPORT_STATUSES)
  status: (typeof IMPORT_STATUSES)[number];
}

export class ImportEventsDto {
  /** Name of the data source or collector, e.g. `uci-calendar`. Lower case, digits and hyphens. */
  @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, {
    message:
      'sourceName must be 3-40 characters: lower-case letters, digits and hyphens',
  })
  sourceName: string;

  /**
   * True when the file lists every upcoming event of the source. Upcoming events of this source
   * that are missing from it are then marked as gone. Leave it out for a partial file.
   */
  @IsOptional()
  @IsBoolean()
  complete?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_EVENTS)
  @ValidateNested({ each: true })
  @Type(() => ImportEventDto)
  events: ImportEventDto[];
}
