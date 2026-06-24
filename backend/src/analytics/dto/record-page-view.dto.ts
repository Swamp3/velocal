import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RecordPageViewDto {
  @IsString()
  @MaxLength(500)
  path: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
