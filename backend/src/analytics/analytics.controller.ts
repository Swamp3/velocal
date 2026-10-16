import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
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
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 1200, windowMs: 60 * 1000, global: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordPageView(@Body() dto: RecordPageViewDto): Promise<void> {
    await this.analyticsService.recordPageView(dto.path, dto.clientId);
  }
}
