import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BadWordService } from '../common/bad-words/bad-word.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  CommunityErrorCode,
  communityConflict,
  assertCommunityActive,
  communityForbidden,
} from './community-error';
import { canBePublic, pollPercent } from './poll-access';
import { CreateCommunityPollDto } from './dto/create-community-poll.dto';
import { UpdateCommunityPollDto } from './dto/update-community-poll.dto';
import { CommunityPollOption } from './entities/community-poll-option.entity';
import { CommunityPollVote } from './entities/community-poll-vote.entity';
import {
  CommunityPoll,
  PollResultsVisibility,
  PollVisibility,
} from './entities/community-poll.entity';
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

export interface SerializedPollOption {
  id: string;
  label: string;
  votes: number | null;
  /** Share of the people who voted, whole percent. */
  percent: number | null;
  selected: boolean;
}

export interface SerializedPoll {
  id: string;
  question: string;
  multiple: boolean;
  resultsVisibility: PollResultsVisibility;
  visibility: PollVisibility;
  /** Where the poll lives, for the page header and links. */
  host: {
    communityName: string;
    communitySlug: string;
    subgroupName: string | null;
    subgroupSlug: string | null;
  };
  authorName: string | null;
  /** The host allows public polls (not a private club or an invite-only subgroup). */
  publicAllowed: boolean;
  /** Viewer is a member of the host and the poll is still open. */
  canVote: boolean;
  /** People who voted (counts are hidden together with the results). */
  totalVoters: number | null;
  closesAt: Date | null;
  closed: boolean;
  canSeeResults: boolean;
  canEdit: boolean;
  canDelete: boolean;
  options: SerializedPollOption[];
  createdAt: Date;
}

interface HostAccess {
  community: Community;
  subgroup: Subgroup | null;
  canModerate: boolean;
  /** Member of the host (or club admin); others only read public polls. */
  isMember: boolean;
}

@Injectable()
export class CommunityPollsService {
  constructor(
    @InjectRepository(CommunityPoll)
    private readonly polls: Repository<CommunityPoll>,
    @InjectRepository(CommunityPollOption)
    private readonly options: Repository<CommunityPollOption>,
    @InjectRepository(CommunityPollVote)
    private readonly votes: Repository<CommunityPollVote>,
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly communityMembers: Repository<CommunityMember>,
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(SubgroupMember)
    private readonly subgroupMembers: Repository<SubgroupMember>,
    private readonly dataSource: DataSource,
    private readonly badWords: BadWordService,
  ) {}

  async list(
    communitySlug: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<SerializedPoll[]> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const rows = await this.polls.find({
      where: {
        communityId: host.community.id,
        subgroupId: host.subgroup ? host.subgroup.id : IsNull(),
      },
      relations: { options: true },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(rows.map((poll) => this.serialize(poll, userId, host)));
  }

  /**
   * One poll, for its own page. Members always see it; anyone else only when the poll is public
   * and the club (or subgroup) is publicly visible. Visitors can read the question and options
   * but never see the counts or vote.
   */
  async findOne(
    communitySlug: string,
    pollId: string,
    userId: string | undefined,
    subgroupSlug?: string,
  ): Promise<SerializedPoll> {
    const host = await this.resolveHost(communitySlug, userId, subgroupSlug);
    const poll = await this.requireHostPoll(host, pollId);
    if (!host.isMember) {
      const readable =
        poll.visibility === PollVisibility.PUBLIC &&
        canBePublic(
          host.community.visibility,
          host.subgroup?.visibility ?? null,
        );
      if (!readable) throw communityForbidden(CommunityErrorCode.membersOnly);
    }
    return this.serialize(poll, userId, host);
  }

  async create(
    communitySlug: string,
    userId: string,
    dto: CreateCommunityPollDto,
    subgroupSlug?: string,
  ): Promise<SerializedPoll> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const labels = dto.options.map((option) => option.label).join('\n');
    if (!this.badWords.checkFields({ labels }, ['labels']).clean) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'content_policy_violation',
        message: 'Content contains inappropriate language',
        violations: [{ field: 'options' }],
      });
    }
    this.assertVisibilityAllowed(host, dto.visibility);
    const saved = await this.dataSource.transaction(async (manager) => {
      const poll = await manager.save(
        manager.create(CommunityPoll, {
          communityId: host.community.id,
          subgroupId: host.subgroup?.id ?? null,
          authorId: userId,
          question: dto.question.trim(),
          multiple: dto.multiple ?? false,
          resultsVisibility:
            dto.resultsVisibility ?? PollResultsVisibility.MEMBERS,
          visibility: dto.visibility ?? PollVisibility.MEMBERS,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
        }),
      );
      await manager.save(
        dto.options.map((option, index) =>
          manager.create(CommunityPollOption, {
            pollId: poll.id,
            label: option.label.trim(),
            position: index,
          }),
        ),
      );
      return poll;
    });
    const loaded = await this.requirePoll(saved.id);
    return this.serialize(loaded, userId, host);
  }

  /**
   * Only the author edits a poll. Options that keep their id keep their votes;
   * options left out are removed together with their votes.
   */
  async update(
    communitySlug: string,
    pollId: string,
    userId: string,
    dto: UpdateCommunityPollDto,
    subgroupSlug?: string,
  ): Promise<SerializedPoll> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const poll = await this.requireHostPoll(host, pollId);
    if (poll.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this poll');
    }
    const labels = dto.options.map((option) => option.label).join('\n');
    if (!this.badWords.checkFields({ labels }, ['labels']).clean) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'content_policy_violation',
        message: 'Content contains inappropriate language',
        violations: [{ field: 'options' }],
      });
    }
    const existing = new Set((poll.options ?? []).map((option) => option.id));
    const keptIds = dto.options
      .map((option) => option.id)
      .filter((id): id is string => !!id);
    if (
      keptIds.some((id) => !existing.has(id)) ||
      new Set(keptIds).size !== keptIds.length
    ) {
      throw new BadRequestException('Unknown poll option');
    }

    this.assertVisibilityAllowed(host, dto.visibility);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(CommunityPoll, poll.id, {
        question: dto.question.trim(),
        resultsVisibility: dto.resultsVisibility ?? poll.resultsVisibility,
        visibility: dto.visibility ?? poll.visibility,
        ...(dto.closesAt !== undefined
          ? { closesAt: dto.closesAt ? new Date(dto.closesAt) : null }
          : {}),
      });
      const removed = [...existing].filter((id) => !keptIds.includes(id));
      if (removed.length > 0) {
        await manager.delete(CommunityPollOption, removed);
      }
      for (const [position, option] of dto.options.entries()) {
        if (option.id) {
          await manager.update(CommunityPollOption, option.id, {
            label: option.label.trim(),
            position,
          });
        } else {
          await manager.save(
            manager.create(CommunityPollOption, {
              pollId: poll.id,
              label: option.label.trim(),
              position,
            }),
          );
        }
      }
    });
    const loaded = await this.requirePoll(pollId);
    return this.serialize(loaded, userId, host);
  }

  async vote(
    communitySlug: string,
    pollId: string,
    userId: string,
    optionIds: string[],
    subgroupSlug?: string,
  ): Promise<SerializedPoll> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const uniqueIds = [...new Set(optionIds)];
    await this.dataSource.transaction(async (manager) => {
      const locked: Array<{ closesAt: Date | null; multiple: boolean }> =
        await manager.query(
          `SELECT "closesAt", "multiple" FROM "community_polls" WHERE "id" = $1 FOR UPDATE`,
          [pollId],
        );
      const poll = locked[0];
      if (!poll) throw new NotFoundException('Poll not found');
      await this.assertSameHost(host, pollId);
      if (this.isClosed(poll.closesAt)) {
        throw communityConflict(CommunityErrorCode.pollClosed);
      }
      if (!poll.multiple && uniqueIds.length !== 1) {
        throw new BadRequestException('This poll accepts one choice');
      }
      const options = await manager.find(CommunityPollOption, {
        where: { pollId },
      });
      const allowed = new Set(options.map((option) => option.id));
      if (uniqueIds.some((id) => !allowed.has(id))) {
        throw new BadRequestException('Unknown poll option');
      }
      await manager.query(
        `DELETE FROM "community_poll_votes" AS vote
         USING "community_poll_options" AS option
         WHERE vote."option_id" = option."id"
           AND option."poll_id" = $1
           AND vote."user_id" = $2`,
        [pollId, userId],
      );
      for (const optionId of uniqueIds) {
        await manager.query(
          `INSERT INTO "community_poll_votes" ("option_id", "user_id")
           VALUES ($1, $2)`,
          [optionId, userId],
        );
      }
    });
    const loaded = await this.requirePoll(pollId);
    return this.serialize(loaded, userId, host);
  }

  async remove(
    communitySlug: string,
    pollId: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<void> {
    const host = await this.requireHost(communitySlug, userId, subgroupSlug);
    const poll = await this.requireHostPoll(host, pollId);
    if (poll.authorId !== userId && !host.canModerate) {
      throw new ForbiddenException('Community admin access required');
    }
    await this.polls.remove(poll);
  }

  private async serialize(
    poll: CommunityPoll,
    userId: string | undefined,
    host: HostAccess,
  ): Promise<SerializedPoll> {
    const options = [...(poll.options ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const optionIds = options.map((option) => option.id);
    const canSeeResults =
      host.isMember &&
      (poll.resultsVisibility === PollResultsVisibility.MEMBERS ||
        host.canModerate);
    const [counts, totalVoters] = canSeeResults
      ? await Promise.all([
          this.voteCounts(optionIds),
          this.voterCount(optionIds),
        ])
      : [new Map<string, number>(), null];
    const selected = new Set(
      userId ? await this.myVotes(userId, optionIds) : [],
    );
    const closed = this.isClosed(poll.closesAt);
    return {
      id: poll.id,
      question: poll.question,
      multiple: poll.multiple,
      resultsVisibility: poll.resultsVisibility,
      visibility: poll.visibility,
      host: {
        communityName: host.community.name,
        communitySlug: host.community.slug,
        subgroupName: host.subgroup?.name ?? null,
        subgroupSlug: host.subgroup?.slug ?? null,
      },
      authorName: poll.author?.displayName ?? null,
      publicAllowed: canBePublic(
        host.community.visibility,
        host.subgroup?.visibility ?? null,
      ),
      canVote: host.isMember && !closed,
      totalVoters,
      closesAt: poll.closesAt,
      closed,
      canSeeResults,
      canEdit: !!userId && poll.authorId === userId,
      canDelete: !!userId && (poll.authorId === userId || host.canModerate),
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        votes: canSeeResults ? (counts.get(option.id) ?? 0) : null,
        percent: canSeeResults
          ? pollPercent(counts.get(option.id) ?? 0, totalVoters ?? 0)
          : null,
        selected: selected.has(option.id),
      })),
      createdAt: poll.createdAt,
    };
  }

  private async voterCount(optionIds: string[]): Promise<number> {
    if (optionIds.length === 0) return 0;
    const rows: Array<{ count: number }> = await this.votes.query(
      `SELECT COUNT(DISTINCT "user_id")::int AS "count"
       FROM "community_poll_votes"
       WHERE "option_id" = ANY($1::uuid[])`,
      [optionIds],
    );
    return rows[0]?.count ?? 0;
  }

  /** Public polls only where the club (or subgroup) is itself publicly visible. */
  private assertVisibilityAllowed(
    host: HostAccess,
    visibility: PollVisibility | undefined,
  ): void {
    if (
      visibility === PollVisibility.PUBLIC &&
      !canBePublic(host.community.visibility, host.subgroup?.visibility ?? null)
    ) {
      throw new BadRequestException(
        'Public polls are not available in a private club or an invite-only subgroup',
      );
    }
  }

  private isClosed(closesAt: Date | string | null): boolean {
    if (!closesAt) return false;
    return new Date(closesAt).getTime() <= Date.now();
  }

  private async voteCounts(optionIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (optionIds.length === 0) return counts;
    const rows: Array<{ optionId: string; count: number }> =
      await this.votes.query(
        `SELECT "option_id" AS "optionId", COUNT(*)::int AS "count"
       FROM "community_poll_votes"
       WHERE "option_id" = ANY($1::uuid[])
       GROUP BY "option_id"`,
        [optionIds],
      );
    for (const row of rows) counts.set(row.optionId, Number(row.count));
    return counts;
  }

  private async myVotes(
    userId: string,
    optionIds: string[],
  ): Promise<string[]> {
    if (optionIds.length === 0) return [];
    const rows: Array<{ optionId: string }> = await this.votes.query(
      `SELECT "option_id" AS "optionId"
       FROM "community_poll_votes"
       WHERE "user_id" = $1 AND "option_id" = ANY($2::uuid[])`,
      [userId, optionIds],
    );
    return rows.map((row) => row.optionId);
  }

  private async requirePoll(id: string): Promise<CommunityPoll> {
    const poll = await this.polls.findOne({
      where: { id },
      relations: { options: true, author: true },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    return poll;
  }

  private async requireHostPoll(
    host: HostAccess,
    pollId: string,
  ): Promise<CommunityPoll> {
    const poll = await this.requirePoll(pollId);
    await this.assertSameHost(host, pollId, poll);
    return poll;
  }

  private async assertSameHost(
    host: HostAccess,
    pollId: string,
    loaded?: CommunityPoll,
  ): Promise<void> {
    const poll =
      loaded ?? (await this.polls.findOne({ where: { id: pollId } }));
    if (!poll) throw new NotFoundException('Poll not found');
    const sameCommunity = poll.communityId === host.community.id;
    const sameHost = host.subgroup
      ? poll.subgroupId === host.subgroup.id
      : poll.subgroupId === null;
    if (!sameCommunity || !sameHost)
      throw new NotFoundException('Poll not found');
  }

  private async requireHost(
    communitySlug: string,
    userId: string,
    subgroupSlug?: string,
  ): Promise<HostAccess> {
    const host = await this.resolveHost(communitySlug, userId, subgroupSlug);
    if (!host.isMember)
      throw communityForbidden(CommunityErrorCode.membersOnly);
    return host;
  }

  /** The host and what the viewer is to it; `userId` is missing for visitors who are not signed in. */
  private async resolveHost(
    communitySlug: string,
    userId: string | undefined,
    subgroupSlug?: string,
  ): Promise<HostAccess> {
    const community = await this.communities.findOne({
      where: { slug: communitySlug },
    });
    if (!community) throw new NotFoundException('Community not found');
    const communityMember = userId
      ? await this.communityMembers.findOne({
          where: { communityId: community.id, userId },
        })
      : null;
    if (
      community.visibility === CommunityVisibility.PRIVATE &&
      !communityMember
    ) {
      throw new NotFoundException('Community not found');
    }
    assertCommunityActive(community);
    const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
    if (!subgroupSlug) {
      return {
        community,
        subgroup: null,
        canModerate: isAdmin,
        isMember: !!communityMember,
      };
    }
    const subgroup = await this.subgroups.findOne({
      where: { communityId: community.id, slug: subgroupSlug },
    });
    if (!subgroup) throw new NotFoundException('Subgroup not found');
    const subgroupMember = userId
      ? await this.subgroupMembers.findOne({
          where: { subgroupId: subgroup.id, userId },
        })
      : null;
    if (
      subgroup.visibility === SubgroupVisibility.INVITE &&
      !isAdmin &&
      !subgroupMember
    ) {
      throw new NotFoundException('Subgroup not found');
    }
    return {
      community,
      subgroup,
      canModerate:
        isAdmin || subgroupMember?.role === SubgroupMemberRole.MODERATOR,
      isMember: isAdmin || !!subgroupMember,
    };
  }
}
