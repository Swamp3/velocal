import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AnalyticsService, AnalyticsOverview, TopPage } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('top-pages')
  getTopPages(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ): Promise<TopPage[]> {
    return this.analyticsService.getTopPages(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('overview')
  getOverview(@Query('days') days?: string): Promise<AnalyticsOverview> {
    return this.analyticsService.getOverview(days ? parseInt(days, 10) : 30);
  }
}
