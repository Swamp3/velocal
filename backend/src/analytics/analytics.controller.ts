import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RecordPageViewDto } from './dto/record-page-view.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Anonymous reach measurement: path, time and a random id that lives only in
   * the visitor's memory for one visit. The account is deliberately not stored.
   */
  @Post('page-view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordPageView(@Body() dto: RecordPageViewDto): Promise<void> {
    await this.analyticsService.recordPageView(dto.path, dto.clientId);
  }
}
