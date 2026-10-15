import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { ResolveReportDto } from './dto/report.dto';

class ReportQueryDto {
  @IsOptional()
  @IsIn(['open', 'resolved', 'dismissed'])
  status?: 'open' | 'resolved' | 'dismissed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** The report queue for site admins. */
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminReportsController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  @Get('open-count')
  async openCount(): Promise<{ count: number }> {
    const [row] = await this.dataSource.query<{ count: number }[]>(
      `SELECT COUNT(*)::int AS "count" FROM "reports" WHERE "status" = 'open'`,
    );
    return { count: row.count };
  }

  @Get()
  async list(@Query() dto: ReportQueryDto) {
    const status = dto.status ?? 'open';
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const [{ total }] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*) AS "total" FROM "reports" WHERE "status" = $1`,
      [status],
    );
    const data = await this.dataSource.query(
      `SELECT r."id", r."status", r."target_type" AS "targetType", r."target_id" AS "targetId",
              r."target_label" AS "targetLabel", r."reason", r."note", r."createdAt",
              r."resolved_at" AS "resolvedAt", r."resolution_note" AS "resolutionNote",
              r."community_id" AS "communityId",
              u."displayName" AS "reporterName", u."email" AS "reporterEmail",
              c."name" AS "communityName", c."slug" AS "communitySlug",
              (SELECT COUNT(*)::int FROM "reports" o
                 WHERE o."target_id" = r."target_id" AND o."target_type" = r."target_type"
                   AND o."status" = 'open') AS "reportsOnTarget"
       FROM "reports" r
       LEFT JOIN "users" u ON u."id" = r."reporter_id"
       LEFT JOIN "communities" c ON c."id" = r."community_id"
       WHERE r."status" = $1
       ORDER BY r."createdAt" ${status === 'open' ? 'ASC' : 'DESC'}
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      [status],
    );
    return { data, total: Number(total), page, limit };
  }

  @Patch(':id')
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ status: string }> {
    const rows = await this.dataSource.query<
      [
        {
          id: string;
          target_type: string;
          target_id: string;
          target_label: string;
          community_id: string | null;
        }[],
        number,
      ]
    >(
      `UPDATE "reports"
       SET "status" = $2, "resolved_by_id" = $3, "resolved_at" = now(), "resolution_note" = $4
       WHERE "id" = $1 AND "status" = 'open'
       RETURNING "id", "target_type", "target_id", "target_label", "community_id"`,
      [id, dto.status, user.id, dto.note?.trim() || null],
    );
    const updated = Array.isArray(rows[0]) ? rows[0][0] : (rows as never)[0];
    if (!updated) throw new NotFoundException('Open report not found');
    await this.audit.record({
      actorId: user.id,
      action: dto.status === 'resolved' ? 'report.resolve' : 'report.dismiss',
      targetType: updated.target_type,
      targetId: updated.target_id,
      targetLabel: updated.target_label,
      communityId: updated.community_id ?? undefined,
      details: dto.note ? { note: dto.note } : undefined,
    });
    return { status: dto.status };
  }
}
