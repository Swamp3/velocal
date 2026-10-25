import { SERIES_KINDS, type SeriesKind } from '../../events/racing';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateSeriesDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  disciplineSlug?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  /** `series`, `cup` (runs for one ranking) or `league` (matchdays of a season). */
  @IsOptional()
  @IsIn(SERIES_KINDS)
  kind?: SeriesKind;

  /** Season across years, e.g. `2026/27`. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;
}
