import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CommunityPollsService,
  SerializedPoll,
} from './community-polls.service';

/**
 * One poll for its own page. Signed-out visitors may call these too: whether they see anything is
 * decided by the poll's visibility (`CommunityPollsService.findOne`).
 */
@Controller()
@UseGuards(OptionalJwtAuthGuard)
export class CommunityPollDetailController {
  constructor(private readonly polls: CommunityPollsService) {}

  @Get('communities/:communitySlug/polls/:pollId')
  findCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.findOne(communitySlug, pollId, user?.id);
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId')
  findSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.findOne(communitySlug, pollId, user?.id, subgroupSlug);
  }
}
