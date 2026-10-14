import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PollResultsVisibility } from '../entities/community-poll.entity';

export class CreatePollOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label: string;
}

export class CreateCommunityPollDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question: string;

  @IsOptional()
  @IsBoolean()
  multiple?: boolean;

  @IsOptional()
  @IsEnum(PollResultsVisibility)
  resultsVisibility?: PollResultsVisibility;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @ValidateNested({ each: true })
  @Type(() => CreatePollOptionDto)
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  options: CreatePollOptionDto[];
}
