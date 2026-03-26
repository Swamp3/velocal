import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus } from './entities/post.entity';
import { PostTag } from './entities/post-tag.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostSearchDto } from './dto/post-search.dto';

export interface SerializedPost {
  id: string;
  title: string;
  body: string;
  slug: string;
  author: { id: string; displayName: string };
  event?: { id: string; name: string; startDate: string };
  status: PostStatus;
  isPinned: boolean;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedPostListItem extends Omit<SerializedPost, 'body'> {
  excerpt: string;
}

export interface PaginatedPosts {
  data: SerializedPostListItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
    @InjectRepository(PostTag)
    private readonly tagRepo: Repository<PostTag>,
  ) {}

  async findAll(params: PostSearchDto, isAdmin = false): Promise<PaginatedPosts> {
    const qb = this.repo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.event', 'event')
      .leftJoinAndSelect('post.tags', 'tags');

    const status = params.status ?? (isAdmin ? undefined : PostStatus.PUBLISHED);
    if (status) {
      qb.andWhere('post.status = :status', { status });
    }

    if (params.q) {
      qb.andWhere('(post.title ILIKE :q OR post.body ILIKE :q)', { q: `%${params.q}%` });
    }

    if (params.tag) {
      qb.andWhere((sub) => {
        const subQuery = sub
          .subQuery()
          .select('pt.post_id')
          .from(PostTag, 'pt')
          .where('pt.tag = :tag')
          .getQuery();
        return `post.id IN ${subQuery}`;
      }).setParameter('tag', params.tag);
    }

    if (params.eventId) {
      qb.andWhere('post.eventId = :eventId', { eventId: params.eventId });
    }

    qb.orderBy('post.isPinned', 'DESC')
      .addOrderBy('post.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('post.createdAt', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    const [posts, total] = await qb.getManyAndCount();

    return {
      data: posts.map((p) => this.serializeListItem(p)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findBySlug(slug: string): Promise<SerializedPost> {
    const post = await this.repo.findOne({
      where: { slug },
      relations: ['author', 'event', 'tags'],
    });
    if (!post) throw new NotFoundException(`Post not found`);
    return this.serialize(post);
  }

  async create(dto: CreatePostDto, authorId: string): Promise<SerializedPost> {
    const slug = await this.generateUniqueSlug(dto.title);

    const post = this.repo.create({
      title: dto.title,
      body: dto.body,
      slug,
      authorId,
      eventId: dto.eventId,
      status: dto.status ?? PostStatus.PUBLISHED,
      isPinned: dto.isPinned ?? false,
      publishedAt: (dto.status ?? PostStatus.PUBLISHED) === PostStatus.PUBLISHED ? new Date() : undefined,
      tags: dto.tags?.map((tag) => ({ tag: tag.trim().toLowerCase() }) as PostTag) ?? [],
    });

    const saved = await this.repo.save(post);
    return this.findBySlug(saved.slug);
  }

  async update(id: string, dto: UpdatePostDto): Promise<SerializedPost> {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.body !== undefined) post.body = dto.body;
    if (dto.eventId !== undefined) post.eventId = dto.eventId;
    if (dto.isPinned !== undefined) post.isPinned = dto.isPinned;

    if (dto.status !== undefined) {
      if (dto.status === PostStatus.PUBLISHED && post.status !== PostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
      post.status = dto.status;
    }

    if (dto.tags !== undefined) {
      await this.tagRepo.delete({ postId: id });
      post.tags = dto.tags.map((tag) => {
        const t = new PostTag();
        t.postId = id;
        t.tag = tag.trim().toLowerCase();
        return t;
      });
    }

    await this.repo.save(post);
    return this.findBySlug(post.slug);
  }

  async remove(id: string): Promise<void> {
    const post = await this.repo.findOneBy({ id });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    await this.repo.remove(post);
  }

  async getAllTags(): Promise<string[]> {
    const result = await this.tagRepo
      .createQueryBuilder('pt')
      .select('DISTINCT pt.tag', 'tag')
      .orderBy('pt.tag', 'ASC')
      .getRawMany();
    return result.map((r) => r.tag);
  }

  private serialize(post: Post): SerializedPost {
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      slug: post.slug,
      author: {
        id: post.author?.id,
        displayName: post.author?.displayName ?? 'Unknown',
      },
      event: post.event
        ? { id: post.event.id, name: post.event.name, startDate: post.event.startDate?.toISOString() }
        : undefined,
      status: post.status,
      isPinned: post.isPinned,
      tags: post.tags?.map((t) => t.tag) ?? [],
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  private serializeListItem(post: Post): SerializedPostListItem {
    const full = this.serialize(post);
    const { body: _, ...rest } = full;
    const plain = post.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return {
      ...rest,
      excerpt: plain.length > 200 ? plain.slice(0, 200) + '…' : plain,
    };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = this.generateSlug(title);
    let slug = base;
    let counter = 2;

    while (await this.repo.findOneBy({ slug })) {
      slug = `${base}-${counter}`;
      counter++;
    }

    return slug;
  }
}
