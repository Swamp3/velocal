import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';
import {
  CommunityPollsService,
  SerializedPoll,
} from './community-polls.service';
import { CreateCommunityPollDto } from './dto/create-community-poll.dto';
import { UpdateCommunityPollDto } from './dto/update-community-poll.dto';
import { VoteCommunityPollDto } from './dto/vote-community-poll.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityPollsController {
  constructor(private readonly polls: CommunityPollsService) {}

  @Get('communities/:communitySlug/polls')
  listCommunity(
    @Param('communitySlug') communitySlug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll[]> {
    return this.polls.list(communitySlug, user.id);
  }

  @Post('communities/:communitySlug/polls')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('question')
  createCommunity(
    @Param('communitySlug') communitySlug: string,
    @Body() dto: CreateCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.create(communitySlug, user.id, dto);
  }

  @Post('communities/:communitySlug/polls/:pollId/votes')
  voteCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() dto: VoteCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.vote(communitySlug, pollId, user.id, dto.optionIds);
  }

  @Patch('communities/:communitySlug/polls/:pollId')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('question')
  updateCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() dto: UpdateCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.update(communitySlug, pollId, user.id, dto);
  }

  @Delete('communities/:communitySlug/polls/:pollId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.polls.remove(communitySlug, pollId, user.id);
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/polls')
  listSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll[]> {
    return this.polls.list(communitySlug, user.id, subgroupSlug);
  }

  @Post('communities/:communitySlug/subgroups/:subgroupSlug/polls')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('question')
  createSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Body() dto: CreateCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.create(communitySlug, user.id, dto, subgroupSlug);
  }

  @Post(
    'communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId/votes',
  )
  voteSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() dto: VoteCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.vote(
      communitySlug,
      pollId,
      user.id,
      dto.optionIds,
      subgroupSlug,
    );
  }

  @Delete('communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.polls.remove(communitySlug, pollId, user.id, subgroupSlug);
  }

  @Patch('communities/:communitySlug/subgroups/:subgroupSlug/polls/:pollId')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('question')
  updateSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() dto: UpdateCommunityPollDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPoll> {
    return this.polls.update(communitySlug, pollId, user.id, dto, subgroupSlug);
  }
}
