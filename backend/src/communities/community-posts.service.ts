import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CommunityErrorCode, communityForbidden } from './community-error';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { CreateCommunityPostDto } from './dto/create-community-post.dto';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPost } from './entities/community-post.entity';
import {
  CommunityMember,
  CommunityMemberRole,
} from './entities/community-member.entity';
import { Community, CommunityVisibility } from './entities/community.entity';
import {
  SubgroupMember,
  SubgroupMemberRole,
} from './entities/subgroup-member.entity';
import { Subgroup, SubgroupVisibility } from './entities/subgroup.entity';

export interface SerializedCommunityPost {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string | null;
  commentCount: number;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedCommunityComment {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  canDelete: boolean;
  createdAt: Date;
}

interface HostAccess {
  community: Community;
  subgroup: Subgroup | null;
  canModerate: boolean;
}

@Injectable()
export class CommunityPostsService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPostComment)
    private readonly comments: Repository<CommunityPostComment>,
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly communityMembers: Repository<CommunityMember>,
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(SubgroupMember)
    private readonly subgroupMembers: Repository<SubgroupMember>,
  ) {}

  async list(
    communitySlug: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<SerializedCommunityPost[]> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const rows = await this.posts.find({
      where: {
        communityId: host.community.id,
        subgroupId: host.subgroup ? host.subgroup.id : IsNull(),
      },
      relations: { author: true },
      order: { createdAt: 'DESC' },
    });
    const counts = await this.commentCounts(rows.map((row) => row.id));
    return rows.map((row) => this.serializePost(row, userId, host, counts));
  }

  async create(
    communitySlug: string,
    userId: string,
    dto: CreateCommunityPostDto,
    subgroupSlug?: string,
  ): Promise<SerializedCommunityPost> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const saved = await this.posts.save(
      this.posts.create({
        communityId: host.community.id,
        subgroupId: host.subgroup?.id ?? null,
        authorId: userId,
        title: dto.title.trim(),
        body: dto.body.trim(),
      }),
    );
    const loaded = await this.requirePost(saved.id);
    return this.serializePost(loaded, userId, host, new Map());
  }

  async findOne(
    communitySlug: string,
    postId: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<SerializedCommunityPost> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const post = await this.requireHostPost(host, postId);
    const counts = await this.commentCounts([post.id]);
    return this.serializePost(post, userId, host, counts);
  }

  async remove(
    communitySlug: string,
    postId: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<void> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const post = await this.requireHostPost(host, postId);
    if (post.authorId !== userId && !host.canModerate) {
      throw new ForbiddenException('Community admin access required');
    }
    await this.posts.remove(post);
  }

  async listComments(
    communitySlug: string,
    postId: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<SerializedCommunityComment[]> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    await this.requireHostPost(host, postId);
    const rows = await this.comments.find({
      where: { postId },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.serializeComment(row, userId, host));
  }

  async addComment(
    communitySlug: string,
    postId: string,
    userId: string,
    dto: CreateCommunityCommentDto,
    subgroupSlug?: string,
  ): Promise<SerializedCommunityComment> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    await this.requireHostPost(host, postId);
    const saved = await this.comments.save(
      this.comments.create({
        postId,
        authorId: userId,
        body: dto.body.trim(),
      }),
    );
    const loaded = await this.comments.findOne({
      where: { id: saved.id },
      relations: { author: true },
    });
    if (!loaded) throw new NotFoundException('Comment not found');
    return this.serializeComment(loaded, userId, host);
  }

  async removeComment(
    communitySlug: string,
    postId: string,
    commentId: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<void> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    await this.requireHostPost(host, postId);
    const comment = await this.comments.findOne({
      where: { id: commentId, postId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && !host.canModerate) {
      throw new ForbiddenException('Community admin access required');
    }
    await this.comments.remove(comment);
  }

  private async requireHost(
    communitySlug: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<HostAccess> {
    const community = await this.communities.findOne({
      where: { slug: communitySlug },
    });
    if (!community) throw new NotFoundException('Community not found');

    const communityMember = await this.communityMembers.findOne({
      where: { communityId: community.id, userId },
    });
    if (
      community.visibility === CommunityVisibility.PRIVATE &&
      !communityMember
    ) {
      throw new NotFoundException('Community not found');
    }

    const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
    if (!subgroupSlug) {
      if (!communityMember) {
        throw communityForbidden(CommunityErrorCode.membersOnly);
      }
      return { community, subgroup: null, canModerate: isAdmin };
    }

    const subgroup = await this.subgroups.findOne({
      where: { communityId: community.id, slug: subgroupSlug },
    });
    if (!subgroup) throw new NotFoundException('Subgroup not found');

    const subgroupMember = await this.subgroupMembers.findOne({
      where: { subgroupId: subgroup.id, userId },
    });
    if (
      subgroup.visibility === SubgroupVisibility.INVITE &&
      !isAdmin &&
      !subgroupMember
    ) {
      throw new NotFoundException('Subgroup not found');
    }
    if (!subgroupMember && !isAdmin) {
      throw communityForbidden(CommunityErrorCode.membersOnly);
    }

    const canModerate =
      isAdmin || subgroupMember?.role === SubgroupMemberRole.MODERATOR;
    return { community, subgroup, canModerate };
  }

  private async requireHostPost(
    host: HostAccess,
    postId: string,
  ): Promise<CommunityPost> {
    const post = await this.requirePost(postId);
    const sameCommunity = post.communityId === host.community.id;
    const sameHost = host.subgroup
      ? post.subgroupId === host.subgroup.id
      : post.subgroupId === null;
    if (!sameCommunity || !sameHost) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async requirePost(id: string): Promise<CommunityPost> {
    const post = await this.posts.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async commentCounts(postIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (postIds.length === 0) return counts;
    const rows: Array<{ postId: string; count: number }> =
      await this.comments.query(
        `SELECT "post_id" AS "postId", COUNT(*)::int AS "count"
       FROM "community_post_comments"
       WHERE "post_id" = ANY($1::uuid[])
       GROUP BY "post_id"`,
        [postIds],
      );
    for (const row of rows) counts.set(row.postId, Number(row.count));
    return counts;
  }

  private serializePost(
    post: CommunityPost,
    userId: string,
    host: HostAccess,
    counts: Map<string, number>,
  ): SerializedCommunityPost {
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      authorId: post.authorId,
      authorName: post.author?.displayName ?? null,
      commentCount: counts.get(post.id) ?? 0,
      canDelete: post.authorId === userId || host.canModerate,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private serializeComment(
    comment: CommunityPostComment,
    userId: string,
    host: HostAccess,
  ): SerializedCommunityComment {
    return {
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      authorName: comment.author?.displayName ?? null,
      canDelete: comment.authorId === userId || host.canModerate,
      createdAt: comment.createdAt,
    };
  }
}
