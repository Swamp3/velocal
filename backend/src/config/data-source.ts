// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '../.env' });
import { DataSource } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Discipline } from '../disciplines/entities/discipline.entity';
import { User } from '../users/entities/user.entity';
import { UserFavorite } from '../users/entities/user-favorite.entity';
import { UserDisciplinePref } from '../users/entities/user-discipline-pref.entity';
import { RaceSeries } from '../series/entities/race-series.entity';
import { RaceSeriesEvent } from '../series/entities/race-series-event.entity';
import { Community } from '../communities/entities/community.entity';
import { CommunityMember } from '../communities/entities/community-member.entity';
import { CommunityJoinRequest } from '../communities/entities/community-join-request.entity';
import { Subgroup } from '../communities/entities/subgroup.entity';
import { SubgroupMember } from '../communities/entities/subgroup-member.entity';
import { SubgroupJoinRequest } from '../communities/entities/subgroup-join-request.entity';
import { CommunityPost } from '../communities/entities/community-post.entity';
import { CommunityPostComment } from '../communities/entities/community-post-comment.entity';
import { CommunityPoll } from '../communities/entities/community-poll.entity';
import { CommunityPollOption } from '../communities/entities/community-poll-option.entity';
import { CommunityPollVote } from '../communities/entities/community-poll-vote.entity';
import { Post } from '../posts/entities/post.entity';
import { PostTag } from '../posts/entities/post-tag.entity';
import { ImportRun } from '../import/entities/import-run.entity';
import { OtpToken } from '../auth/entities/otp-token.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER || 'velocal',
  password: process.env.DB_PASSWORD || 'velocal',
  database: process.env.DB_NAME || 'velocal',
  entities: [
    Event,
    Discipline,
    User,
    UserFavorite,
    UserDisciplinePref,
    RaceSeries,
    RaceSeriesEvent,
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
    Post,
    PostTag,
    OtpToken,
    PasswordResetToken,
    ImportRun,
  ],
  migrations: ['src/migrations/*.ts'],
});
