import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';
import { EventsService, SerializedEvent } from '../events/events.service';
import { CreateHostedEventDto } from './dto/create-hosted-event.dto';

@Controller()
export class CommunityEventsController {
  constructor(private readonly events: EventsService) {}

  @Get('communities/:communitySlug/events')
  @UseGuards(OptionalJwtAuthGuard)
  listCommunity(
    @Param('communitySlug') communitySlug: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedEvent[]> {
    return this.events.listHosted(communitySlug, user?.id);
  }

  @Post('communities/:communitySlug/events')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords(
    'name',
    'description',
    'locationName',
    'meetupPlace',
    'meetupNote',
  )
  createCommunity(
    @Param('communitySlug') communitySlug: string,
    @Body() dto: CreateHostedEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedEvent> {
    return this.events.createHosted(communitySlug, user.id, dto);
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/events')
  @UseGuards(OptionalJwtAuthGuard)
  listSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedEvent[]> {
    return this.events.listHosted(communitySlug, user?.id, subgroupSlug);
  }

  @Post('communities/:communitySlug/subgroups/:subgroupSlug/events')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords(
    'name',
    'description',
    'locationName',
    'meetupPlace',
    'meetupNote',
  )
  createSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Body() dto: CreateHostedEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedEvent> {
    return this.events.createHosted(communitySlug, user.id, dto, subgroupSlug);
  }
}
