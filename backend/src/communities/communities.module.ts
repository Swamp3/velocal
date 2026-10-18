import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CommunityEventsController } from './community-events.controller';
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
import { CommunityPollDetailController } from './community-poll-detail.controller';
import { CommunityPollsController } from './community-polls.controller';
import { CommunityPollsService } from './community-polls.service';
import { CommunityPostsController } from './community-posts.controller';
import { CommunityPostsService } from './community-posts.service';
import { AuditModule } from '../audit/audit.module';
import { Report } from './entities/report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AdminReportsController } from './admin-reports.controller';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { CommunityCleanupService } from './community-cleanup.service';
import { AdminCommunitiesController } from './admin-communities.controller';
import { AdminCommunitiesService } from './admin-communities.service';
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
      Report,
      User,
    ]),
    UploadsModule,
    EventsModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [
    CommunitiesController,
    SubgroupsController,
    CommunityPostsController,
    CommunityPollsController,
    CommunityPollDetailController,
    CommunityEventsController,
    AdminCommunitiesController,
    ReportsController,
    AdminReportsController,
    AccountController,
  ],
  providers: [
    CommunitiesService,
    SubgroupsService,
    CommunityPostsService,
    CommunityPollsService,
    CommunityCleanupService,
    AccountDeletionService,
    AdminCommunitiesService,
    ReportsService,
  ],
  exports: [CommunitiesService, SubgroupsService],
})
export class CommunitiesModule {}
