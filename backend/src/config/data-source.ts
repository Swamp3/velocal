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
import { Post } from '../posts/entities/post.entity';
import { PostTag } from '../posts/entities/post-tag.entity';
import { OtpToken } from '../auth/entities/otp-token.entity';

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
    Post,
    PostTag,
    OtpToken,
  ],
  migrations: ['src/migrations/*.ts'],
});
