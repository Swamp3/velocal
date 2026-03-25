import { IsOptional, IsString } from 'class-validator';

export class TriggerImportDto {
  @IsOptional()
  @IsString()
  source?: string;
}
