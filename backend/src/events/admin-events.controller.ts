import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { EventDuplicatesService } from './event-duplicates.service';
import { AdminMissingDataDto } from './dto/admin-missing-data.dto';
import {
  AdminDuplicatesQueryDto,
  IgnoreDuplicatesDto,
} from './dto/admin-duplicates.dto';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminEventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly duplicates: EventDuplicatesService,
  ) {}

  /** Where an imported event came from: sources with check dates, conflicts, edits by hand. */
  @Get(':id/import-info')
  getImportInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getImportInfo(id);
  }

  @Get('missing-data')
  getMissingData(@Query() dto: AdminMissingDataDto) {
    return this.eventsService.findMissingData(dto);
  }

  @Get('missing-data/stats')
  getMissingDataStats() {
    return this.eventsService.getMissingDataStats();
  }

  /** Groups of events that probably describe the same real event. */
  @Get('duplicates')
  findDuplicates(@Query() dto: AdminDuplicatesQueryDto) {
    return this.duplicates.findGroups({
      includePast: dto.includePast ?? false,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    });
  }

  @Post('duplicates/ignore')
  @HttpCode(HttpStatus.NO_CONTENT)
  ignoreDuplicates(
    @Body() dto: IgnoreDuplicatesDto,
    @CurrentUser() admin: { id: string },
  ): Promise<void> {
    return this.duplicates.ignore(dto.eventIds, admin.id);
  }

  /** Upcoming imported events that their source no longer lists. */
  @Get('missing-source')
  findMissingAtSource(@Query() dto: AdminDuplicatesQueryDto) {
    return this.eventsService.findMissingAtSource(
      dto.page ?? 1,
      dto.limit ?? 20,
    );
  }
}
