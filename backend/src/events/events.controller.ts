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
import { CreateEventCommentDto } from './dto/create-event-comment.dto';
import { InviteEventDto } from './dto/invite-event.dto';
import { SetEventRsvpDto } from './dto/set-event-rsvp.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: EventSearchDto,
    @CurrentUser() user?: { id: string },
  ): Promise<PaginatedEvents> {
    return this.eventsService.findAll(query, user?.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedEvent> {
    return this.eventsService.findOne(id, user?.id);
  }

  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteEventDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.invite(id, user.id, dto.email);
  }

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  setRsvp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetEventRsvpDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedEvent> {
    return this.eventsService.setRsvp(id, user.id, dto.status);
  }

  @Get(':id/rsvps')
  @UseGuards(JwtAuthGuard)
  listRsvps(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.listRsvps(id, user.id);
  }

  @Get(':id/comments')
  @UseGuards(JwtAuthGuard)
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.listComments(id, user.id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('body')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEventCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.addComment(id, user.id, dto.body);
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.eventsService.deleteComment(id, commentId, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description', 'locationName')
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedEvent> {
    const event = await this.eventsService.create(dto, user.id);
    return this.eventsService.findOne(event.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords(
    'name',
    'description',
    'locationName',
    'meetupPlace',
    'meetupNote',
  )
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
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
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
