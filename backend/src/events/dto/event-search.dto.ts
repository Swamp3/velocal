import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { EventStatus } from '../entities/event.entity';

export enum EventSort {
  DATE = 'date',
  DISTANCE = 'distance',
  NAME = 'name',
}

/** `marker` drops description and other fields the map popup does not render. */
export enum EventListView {
  FULL = 'full',
  MARKER = 'marker',
}

export class EventSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius?: number;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  limit: number = 20;

  @IsOptional()
  @IsEnum(EventSort)
  sort?: EventSort;

  @IsOptional()
  @IsIn([EventListView.FULL, EventListView.MARKER])
  view?: EventListView;

  /** Signed-in riders: only events with a class that fits their age, gender and licence. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  fitsMe?: boolean;

  /** Only championships (the event or one of its classes). */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  championship?: boolean;

  /** Only these formats, comma separated (`race,jedermann`); `touring` stands for all touring formats. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]+(,[a-z_]+)*$/)
  format?: string;

  /** Leave out league matchdays (events of a series of kind `league`). */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  hideLeagues?: boolean;
}
