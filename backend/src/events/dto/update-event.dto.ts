import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EventListing,
  EventSource,
  EventStatus,
} from '../entities/event.entity';

const STRAVA_URL = /^https:\/\/(www\.)?strava\.com\/.+/i;

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

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  /** False when only the day is known (no time shown). Derived from the start time when missing. */
  @IsOptional()
  @IsBoolean()
  startTimeKnown?: boolean;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  locationName?: string;

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

  /** `null` clears the value. */
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

  @IsOptional()
  @IsString()
  disciplineSlug?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string | null;

  @IsOptional()
  @IsEnum(EventListing)
  listing?: EventListing;

  @IsOptional()
  @ValidateIf((dto: UpdateEventDto) => dto.stravaUrl !== '')
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @Matches(STRAVA_URL)
  stravaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  meetupPlace?: string;

  @IsOptional()
  @ValidateIf((dto: UpdateEventDto) => dto.meetupAt !== '')
  @IsISO8601()
  meetupAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetupNote?: string;
}
