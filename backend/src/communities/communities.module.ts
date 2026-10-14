import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UploadsModule } from '../uploads/uploads.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityJoinRequest } from './entities/community-join-request.entity';
import { CommunityMember } from './entities/community-member.entity';
import { Community } from './entities/community.entity';
import { SubgroupJoinRequest } from './entities/subgroup-join-request.entity';
import { SubgroupMember } from './entities/subgroup-member.entity';
import { Subgroup } from './entities/subgroup.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPollOption } from './entities/community-poll-option.entity';
import { CommunityPollVote } from './entities/community-poll-vote.entity';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityPollsController } from './community-polls.controller';
import { CommunityPollsService } from './community-polls.service';
import { CommunityPostsController } from './community-posts.controller';
import { CommunityPostsService } from './community-posts.service';
import { SubgroupsController } from './subgroups.controller';
import { SubgroupsService } from './subgroups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Community,
      CommunityMember,
      CommunityJoinRequest,
      Subgroup,
      SubgroupMember,
      SubgroupJoinRequest,
      CommunityPost,
      CommunityPostComment,
      CommunityPoll,
      CommunityPollOption,
      CommunityPollVote,
      User,
    ]),
    UploadsModule,
  ],
  controllers: [
    CommunitiesController,
    SubgroupsController,
    CommunityPostsController,
    CommunityPollsController,
  ],
  providers: [
    CommunitiesService,
    SubgroupsService,
    CommunityPostsService,
    CommunityPollsService,
  ],
  exports: [CommunitiesService, SubgroupsService],
})
export class CommunitiesModule {}
