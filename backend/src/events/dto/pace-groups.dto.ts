import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PACE_CATEGORIES } from '../entities/event-pace-group.entity';
import type { PaceCategory } from '../entities/event-pace-group.entity';

/** strava.com links, including the strava.app.link share short links. */
export const STRAVA_LINK =
  /^https:\/\/((www\.)?strava\.com|strava\.app\.link)\/.+/i;

export class StravaLinkDto {
  @IsString()
  @MaxLength(500)
  @Matches(STRAVA_LINK, { message: 'url must be a https strava.com link' })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class PaceGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsIn(PACE_CATEGORIES)
  category: PaceCategory;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(5)
  @Max(80)
  speedMinKmh: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(5)
  @Max(80)
  speedMaxKmh: number;

  @IsOptional()
  @IsUUID()
  routeId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => StravaLinkDto)
  stravaLinks?: StravaLinkDto[];
}

export class SetPaceGroupsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PaceGroupDto)
  paceGroups: PaceGroupDto[];
}

export class SetStravaLinksDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StravaLinkDto)
  links: StravaLinkDto[];
}
