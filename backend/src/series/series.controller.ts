import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { SeriesService, PaginatedSeries, SerializedSeries } from './series.service';
import { SeriesSearchDto } from './dto/series-search.dto';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { AddSeriesEventDto } from './dto/add-series-event.dto';
import { UpdateSeriesEventDto } from './dto/update-series-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

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
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  create(
    @Body() dto: CreateSeriesDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSeries> {
    return this.seriesService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSeriesDto,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    return this.seriesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<void> {
    return this.seriesService.remove(id, user);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    return this.seriesService.setImage(id, file, user);
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard)
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    return this.seriesService.removeImage(id, user);
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
