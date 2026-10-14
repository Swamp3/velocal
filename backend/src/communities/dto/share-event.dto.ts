import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ShareEventDto {
  @IsUUID()
  eventId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  meetupPlace?: string;

  @IsOptional()
  @ValidateIf((dto: ShareEventDto) => dto.meetupAt !== '')
  @IsISO8601()
  meetupAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetupNote?: string;
}
