import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@Controller('communities/:communitySlug/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(
    @Param('communitySlug') communitySlug: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ alreadyReported: boolean }> {
    return this.reports.create(communitySlug, user.id, dto);
  }
}
