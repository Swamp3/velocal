import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CommunityPollsService,
  PollVoters,
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
    @CurrentUser() user?: { id: string; isAdmin?: boolean },
  ): Promise<SerializedPoll> {
    return this.polls.findOne(
      communitySlug,
      pollId,
      user?.id,
      undefined,
      !!user?.isAdmin,
    );
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId')
  findSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user?: { id: string; isAdmin?: boolean },
  ): Promise<SerializedPoll> {
    return this.polls.findOne(
      communitySlug,
      pollId,
      user?.id,
      subgroupSlug,
      !!user?.isAdmin,
    );
  }

  /** Admins and moderators only: who voted for which option. */
  @Get('communities/:communitySlug/polls/:pollId/voters')
  @UseGuards(JwtAuthGuard)
  votersCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string; isAdmin?: boolean },
  ): Promise<PollVoters> {
    return this.polls.voters(communitySlug, pollId, user.id, !!user.isAdmin);
  }

  @Get(
    'communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId/voters',
  )
  @UseGuards(JwtAuthGuard)
  votersSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string; isAdmin?: boolean },
  ): Promise<PollVoters> {
    return this.polls.voters(
      communitySlug,
      pollId,
      user.id,
      !!user.isAdmin,
      subgroupSlug,
    );
  }
}
