import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { REPORT_REASONS, REPORT_TARGETS } from '../entities/report.entity';
import type { ReportReason, ReportTarget } from '../entities/report.entity';

export class CreateReportDto {
  @IsIn(REPORT_TARGETS)
  targetType: ReportTarget;

  /** Id of the post or comment; ignored for `community` (the page itself). */
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ResolveReportDto {
  @IsIn(['resolved', 'dismissed'])
  status: 'resolved' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SuspendCommunityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
