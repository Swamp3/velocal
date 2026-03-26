import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddSeriesEventDto {
  @IsUUID()
  eventId: string;

  @IsOptional()
  @IsInt()
  stageNumber?: number;

  @IsOptional()
  @IsString()
  label?: string;
}
