import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EventListing } from '../../events/entities/event.entity';
import { CreateEventDto } from '../../events/dto/create-event.dto';

const STRAVA_URL = /^https:\/\/(www\.)?strava\.com\/.+/i;

export class CreateHostedEventDto extends CreateEventDto {
  @IsOptional()
  @IsEnum(EventListing)
  listing?: EventListing;

  @IsOptional()
  @ValidateIf((dto: CreateHostedEventDto) => dto.stravaUrl !== '')
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @Matches(STRAVA_URL)
  stravaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  meetupPlace?: string;

  @IsOptional()
  @ValidateIf((dto: CreateHostedEventDto) => dto.meetupAt !== '')
  @IsISO8601()
  meetupAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetupNote?: string;
}
