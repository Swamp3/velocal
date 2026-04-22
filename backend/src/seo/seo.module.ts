import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Event } from '../events/entities/event.entity';
import { Post } from '../posts/entities/post.entity';
import { RaceSeries } from '../series/entities/race-series.entity';
import { SitemapController } from './sitemap.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Post, RaceSeries])],
  controllers: [SitemapController],
})
export class SeoModule {}
