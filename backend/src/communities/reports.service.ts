import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityErrorCode, communityForbidden } from './community-error';
import { CreateReportDto } from './dto/report.dto';
import { CommunityMember } from './entities/community-member.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPost } from './entities/community-post.entity';
import { Community, CommunityVisibility } from './entities/community.entity';
import { Report } from './entities/report.entity';

function excerpt(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text || '—';
}

/** Members report content they think a site admin should look at. */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reports: Repository<Report>,
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly members: Repository<CommunityMember>,
    @InjectRepository(CommunityPost)
    private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPostComment)
    private readonly comments: Repository<CommunityPostComment>,
  ) {}

  async create(
    communitySlug: string,
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<{ alreadyReported: boolean }> {
    const community = await this.communities.findOne({
      where: { slug: communitySlug },
    });
    if (!community) throw new NotFoundException('Community not found');
    const membership = await this.members.findOne({
      where: { communityId: community.id, userId: reporterId },
    });
    const hidden =
      community.visibility === CommunityVisibility.PRIVATE ||
      !!community.suspendedAt;
    if (hidden && !membership) {
      throw new NotFoundException('Community not found');
    }

    let targetId = community.id;
    let targetLabel = community.name;
    if (dto.targetType !== 'community') {
      if (!membership) throw communityForbidden(CommunityErrorCode.membersOnly);
      if (!dto.targetId) throw new NotFoundException('Nothing to report');
      if (dto.targetType === 'post') {
        const post = await this.posts.findOne({
          where: { id: dto.targetId, communityId: community.id },
        });
        if (!post) throw new NotFoundException('Post not found');
        targetId = post.id;
        targetLabel = post.title;
      } else {
        const comment = await this.comments.findOne({
          where: { id: dto.targetId },
          relations: { post: true },
        });
        if (!comment || comment.post?.communityId !== community.id) {
          throw new NotFoundException('Comment not found');
        }
        if (comment.authorId === reporterId) {
          throw new ForbiddenException('You cannot report your own comment');
        }
        targetId = comment.id;
        targetLabel = excerpt(comment.body);
      }
    }

    const existing = await this.reports.findOne({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId,
        status: 'open',
      },
    });
    if (existing) return { alreadyReported: true };

    await this.reports.insert({
      reporterId,
      communityId: community.id,
      targetType: dto.targetType,
      targetId,
      targetLabel: targetLabel.slice(0, 300),
      reason: dto.reason,
      note: dto.note?.trim() || null,
    });
    return { alreadyReported: false };
  }
}
