import { Type } from 'class-transformer';
import { PaceGroupDto, StravaLinkDto } from './pace-groups.dto';
import {
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
