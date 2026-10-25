import {
  CHAMPIONSHIP_LEVELS,
  type ChampionshipLevel,
  EVENT_FORMAT_KEYS,
  type EventFormat,
} from '../racing';
import { EventClassDto } from './event-class.dto';
import { ParkingAreaDto } from './parking-area.dto';
import { MAX_PARKING_AREAS } from '../parking';
import { Type } from 'class-transformer';
import { PaceGroupDto, StravaLinkDto } from './pace-groups.dto';
import {
  IsIn,
  IsBoolean,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  MaxLength,
  IsISO8601,
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { EventSource, EventStatus } from '../entities/event.entity';

class CoordinatesDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class RecurrenceDto {
  @IsEnum(['weekly', 'biweekly'])
  frequency: 'weekly' | 'biweekly';

  /** Last day (inclusive) on which an occurrence may start. */
  @IsOptional()
  @IsISO8601()
  until?: string;

  /** Total number of events including the first one. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(104)
  count?: number;

  /** IANA zone the weekly time is kept in, e.g. Europe/Berlin. */
  @IsString()
  @MaxLength(64)
  timezone: string;
}

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  startDate: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  /** False when only the day is known (no time shown). Derived from the start time when missing. */
  @IsOptional()
  @IsBoolean()
  startTimeKnown?: boolean;

  /** Championship level of the whole event, or null for none. */
  @IsOptional()
  @IsIn([...CHAMPIONSHIP_LEVELS, null])
  championship?: ChampionshipLevel | null;

  /** Licence race, Jedermann or touring format; null when unknown. */
  @IsOptional()
  @IsIn([...EVENT_FORMAT_KEYS, null])
  format?: EventFormat | null;

  /** Rating classes; replaces the stored list when given. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => EventClassDto)
  classes?: EventClassDto[];

  /** Parking areas; replaces the stored list when given. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PARKING_AREAS)
  @ValidateNested({ each: true })
  @Type(() => ParkingAreaDto)
  parkingAreas?: ParkingAreaDto[];

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsString()
  locationName: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsOptional()
  @IsISO8601()
  registrationStart?: string | null;

  @IsOptional()
  @IsISO8601()
  registrationDeadline?: string | null;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @IsOptional()
  @IsEnum(EventSource)
  source?: EventSource;

  @IsString()
  disciplineSlug: string;

  @IsOptional()
  @IsUUID()
  routeId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PaceGroupDto)
  paceGroups?: PaceGroupDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StravaLinkDto)
  stravaLinks?: StravaLinkDto[];
}
