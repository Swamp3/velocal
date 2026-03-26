import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus } from './entities/post.entity';
import { PostTag } from './entities/post-tag.entity';
import { User } from '../users/entities/user.entity';
import { WELCOME_POST_BODY } from './posts.seed';

@Injectable()
export class PostSeeder implements OnModuleInit {
  private readonly logger = new Logger(PostSeeder.name);

  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    const existing = await this.postRepo.findOneBy({ slug: 'willkommen-bei-velocal' });
    if (existing) return;

    const admin = await this.userRepo.findOneBy({ isAdmin: true });
    if (!admin) {
      this.logger.warn('No admin user found — skipping welcome post seed');
      return;
    }

    const post = this.postRepo.create({
      title: 'Willkommen bei VeloCal!',
      slug: 'willkommen-bei-velocal',
      authorId: admin.id,
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      body: WELCOME_POST_BODY,
      tags: [
        { tag: 'news' } as PostTag,
        { tag: 'velocal' } as PostTag,
      ],
    });

    await this.postRepo.save(post);
    this.logger.log('Seeded welcome post');
  }
}
