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
import {
  EventsService,
  PaginatedEvents,
  SerializedEvent,
} from './events.service';
import { EventSearchDto } from './dto/event-search.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query() query: EventSearchDto): Promise<PaginatedEvents> {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SerializedEvent> {
    return this.eventsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedEvent> {
    const event = await this.eventsService.create(dto, user.id);
    return this.eventsService.findOne(event.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    return this.eventsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<void> {
    return this.eventsService.remove(id, user);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    return this.eventsService.setImage(id, file, user);
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard)
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    return this.eventsService.removeImage(id, user);
  }
}
