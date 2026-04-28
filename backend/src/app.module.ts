import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import sendgridConfig from './config/sendgrid.config';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DisciplinesModule } from './disciplines/disciplines.module';
import { ImportModule } from './import/import.module';
import { SeriesModule } from './series/series.module';
import { PostsModule } from './posts/posts.module';
import { SeoModule } from './seo/seo.module';
import { UploadsModule } from './uploads/uploads.module';
import { BadWordModule } from './common/bad-words';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      load: [databaseConfig, jwtConfig, sendgridConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow('database'),
    }),
    EventsModule,
    AuthModule,
    UsersModule,
    DisciplinesModule,
    ImportModule,
    SeriesModule,
    PostsModule,
    SeoModule,
    UploadsModule,
    BadWordModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
