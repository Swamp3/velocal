import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSeriesEventDto {
  @IsOptional()
  @IsInt()
  stageNumber?: number;

  @IsOptional()
  @IsString()
  label?: string;
}
