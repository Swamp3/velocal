import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SeriesService, PaginatedSeries, SerializedSeries } from './series.service';
import { SeriesSearchDto } from './dto/series-search.dto';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { AddSeriesEventDto } from './dto/add-series-event.dto';
import { UpdateSeriesEventDto } from './dto/update-series-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  findAll(@Query() query: SeriesSearchDto): Promise<PaginatedSeries> {
    return this.seriesService.findAll(query);
  }

  @Get('by-event/:eventId')
  findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<SerializedSeries[]> {
    return this.seriesService.findByEventId(eventId);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string): Promise<Record<string, unknown>> {
    return this.seriesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateSeriesDto,
    @Req() req: any,
  ): Promise<SerializedSeries> {
    return this.seriesService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSeriesDto,
  ): Promise<SerializedSeries> {
    return this.seriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.seriesService.remove(id);
  }

  @Post(':id/events')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  addEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSeriesEventDto,
  ): Promise<void> {
    return this.seriesService.addEvent(id, dto);
  }

  @Patch(':id/events/:eventId')
  @UseGuards(JwtAuthGuard)
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateSeriesEventDto,
  ): Promise<void> {
    return this.seriesService.updateEvent(id, eventId, dto);
  }

  @Delete(':id/events/:eventId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    return this.seriesService.removeEvent(id, eventId);
  }
}
