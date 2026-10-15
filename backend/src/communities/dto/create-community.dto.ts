import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CommunityVisibility } from '../entities/community.entity';

const STRAVA_URL = /^https:\/\/(www\.)?strava\.com\/.+/i;

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @ValidateIf((dto: { stravaUrl?: string | null }) => !!dto.stravaUrl)
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @Matches(STRAVA_URL)
  @MaxLength(500)
  stravaUrl?: string;

  @IsOptional()
  @IsEnum(CommunityVisibility)
  visibility?: CommunityVisibility;
}
