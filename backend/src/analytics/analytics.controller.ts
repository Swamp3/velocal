import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { RecordPageViewDto } from './dto/record-page-view.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('page-view')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordPageView(
    @Body() dto: RecordPageViewDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<void> {
    await this.analyticsService.recordPageView(dto.path, user?.id, dto.clientId);
  }
}
