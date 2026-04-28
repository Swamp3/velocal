import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EventsService } from './events.service';
import { AdminMissingDataDto } from './dto/admin-missing-data.dto';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('missing-data')
  getMissingData(@Query() dto: AdminMissingDataDto) {
    return this.eventsService.findMissingData(dto);
  }

  @Get('missing-data/stats')
  getMissingDataStats() {
    return this.eventsService.getMissingDataStats();
  }
}
