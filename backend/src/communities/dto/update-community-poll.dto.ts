import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PollResultsVisibility } from '../entities/community-poll.entity';

export class UpdatePollOptionDto {
  /** Present for an existing option, so its votes are kept. Missing means a new option. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label: string;
}

/**
 * Edits a poll. Whether it allows one or several choices is fixed at creation,
 * because changing it would invalidate votes that were already cast.
 */
export class UpdateCommunityPollDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question: string;

  @IsOptional()
  @IsEnum(PollResultsVisibility)
  resultsVisibility?: PollResultsVisibility;

  /** An ISO date, or null to remove the closing time. */
  @IsOptional()
  @IsDateString()
  closesAt?: string | null;

  @ValidateNested({ each: true })
  @Type(() => UpdatePollOptionDto)
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  options: UpdatePollOptionDto[];
}
