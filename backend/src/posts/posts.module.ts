import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostSeeder } from './posts.seeder';
import { Post } from './entities/post.entity';
import { PostTag } from './entities/post-tag.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostTag, User])],
  controllers: [PostsController],
  providers: [PostsService, PostSeeder],
  exports: [PostsService],
})
export class PostsModule {}
