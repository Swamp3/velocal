import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ImageAccessService } from '../uploads/image-access.service';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';
import { isLastAdminRemoval } from './community-admin.policy';
import { pickSlug, RESERVED_COMMUNITY_SLUGS, slugBase } from './community-slug';
import {
  CommunityErrorCode,
  communityConflict,
  communityNotFound,
} from './community-error';
import { CommunitySearchDto } from './dto/community-search.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Community, CommunityVisibility } from './entities/community.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPoll } from './entities/community-poll.entity';
import { Subgroup } from './entities/subgroup.entity';
import {
  CommunityJoinRequest,
  CommunityJoinStatus,
} from './entities/community-join-request.entity';
import {
  CommunityMember,
  CommunityMemberRole,
} from './entities/community-member.entity';

export interface SerializedCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  stravaUrl: string | null;
  visibility: 'public' | 'request' | 'private';
  heroUrl: string | null;
  logoUrl: string | null;
  memberCount: number;
  subgroupCount?: number;
  pollCount?: number;
  postCount?: number;
  myRole: 'member' | 'admin' | null;
  myJoinRequest: 'pending' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCommunities {
  data: SerializedCommunity[];
  total: number;
  page: number;
  limit: number;
}

export interface SerializedMember {
  userId: string;
  displayName: string | null;
  role: 'member' | 'admin';
  joinedAt: Date;
}

export interface SerializedJoinRequest {
  id: string;
  userId: string;
  displayName: string | null;
  createdAt: Date;
}

export type JoinCommunityResult =
  | { outcome: 'joined'; community: SerializedCommunity }
  | { outcome: 'pending' };

interface ViewerState {
  memberCount: number;
  subgroupCount?: number;
  pollCount?: number;
  postCount?: number;
  myRole: 'member' | 'admin' | null;
  myJoinRequest: 'pending' | null;
}

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly members: Repository<CommunityMember>,
    @InjectRepository(CommunityJoinRequest)
    private readonly joinRequests: Repository<CommunityJoinRequest>,
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(CommunityPost)
    private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPoll)
    private readonly polls: Repository<CommunityPoll>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly uploads: UploadsService,
    private readonly imageAccess: ImageAccessService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateCommunityDto,
    userId: string,
  ): Promise<SerializedCommunity> {
    const slug = await this.generateSlug(dto.name);

    return this.dataSource.transaction(async (manager) => {
      const community = manager.create(Community, {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        location: dto.location?.trim() || null,
        stravaUrl: dto.stravaUrl?.trim() || null,
        visibility: dto.visibility ?? CommunityVisibility.PUBLIC,
        createdById: userId,
      });
      const saved = await manager.save(community);
      await manager.save(
        manager.create(CommunityMember, {
          communityId: saved.id,
          userId,
          role: CommunityMemberRole.ADMIN,
        }),
      );

      return this.serialize(saved, {
        memberCount: 1,
        myRole: CommunityMemberRole.ADMIN,
        myJoinRequest: null,
      });
    });
  }

  async findAll(
    params: CommunitySearchDto,
    userId?: string,
  ): Promise<PaginatedCommunities> {
    const page = params.page;
    const limit = params.limit;

    const qb = this.communities
      .createQueryBuilder('community')
      .where('community.visibility IN (:...visibilities)', {
        visibilities: [CommunityVisibility.PUBLIC, CommunityVisibility.REQUEST],
      });

    if (params.q) {
      qb.andWhere('community.name ILIKE :q', { q: `%${params.q}%` });
    }

    qb.orderBy('community.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    await this.attachMemberCounts(rows);
    const states = await this.viewerStates(rows, userId);

    return {
      data: rows.map((community) =>
        this.serialize(community, this.viewerStateFor(community, states)),
      ),
      total,
      page,
      limit,
    };
  }

  async findMine(userId: string): Promise<SerializedCommunity[]> {
    const memberships = await this.members.find({ where: { userId } });
    if (memberships.length === 0) return [];

    const rows = await this.communities
      .createQueryBuilder('community')
      .where('community.id IN (:...ids)', {
        ids: memberships.map((membership) => membership.communityId),
      })
      .orderBy('community.name', 'ASC')
      .getMany();
    await this.attachMemberCounts(rows);

    const roleByCommunity = new Map(
      memberships.map((membership) => [
        membership.communityId,
        membership.role,
      ]),
    );

    return rows.map((community) =>
      this.serialize(community, {
        memberCount: this.readMemberCount(community),
        myRole: roleByCommunity.get(community.id) ?? null,
        myJoinRequest: null,
      }),
    );
  }

  async findBySlug(
    slug: string,
    userId?: string,
  ): Promise<SerializedCommunity> {
    const community = await this.communities.findOne({ where: { slug } });
    if (!community) {
      throw new NotFoundException(`Community "${slug}" not found`);
    }

    if (community.visibility === CommunityVisibility.PRIVATE) {
      const membership = userId
        ? await this.members.findOne({
            where: { communityId: community.id, userId },
          })
        : null;
      if (!membership) {
        throw new NotFoundException(`Community "${slug}" not found`);
      }
    }

    return this.serializeFor(community, userId);
  }

  async update(
    id: string,
    dto: UpdateCommunityDto,
    userId: string,
  ): Promise<SerializedCommunity> {
    const community = await this.findCommunity(id);
    await this.assertAdmin(id, userId);

    if (dto.name !== undefined) {
      community.name = dto.name;
    }
    if (dto.description !== undefined) {
      community.description = dto.description;
    }
    if (dto.location !== undefined) {
      community.location = dto.location?.trim() || null;
    }
    if (dto.stravaUrl !== undefined) {
      community.stravaUrl = dto.stravaUrl?.trim() || null;
    }
    const opening =
      dto.visibility === CommunityVisibility.PUBLIC &&
      community.visibility !== CommunityVisibility.PUBLIC;
    if (dto.visibility !== undefined) {
      community.visibility = dto.visibility;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const row = await manager.save(community);
      if (opening) {
        const admitted = await this.admitPendingMembers(manager, id);
        for (const memberId of admitted) {
          await this.notifications.joinDecision(
            memberId,
            {
              communityName: row.name,
              communitySlug: row.slug,
              decision: 'approved',
            },
            manager,
          );
        }
      }
      return row;
    });
    return this.serializeFor(saved, userId);
  }

  async setHero(
    id: string,
    file: UploadedFile,
    userId: string,
  ): Promise<SerializedCommunity> {
    return this.writeImage(id, userId, 'community-heroes', 'heroUrl', file);
  }

  async removeHero(id: string, userId: string): Promise<SerializedCommunity> {
    return this.writeImage(id, userId, 'community-heroes', 'heroUrl', null);
  }

  async setLogo(
    id: string,
    file: UploadedFile,
    userId: string,
  ): Promise<SerializedCommunity> {
    return this.writeImage(id, userId, 'community-logos', 'logoUrl', file);
  }

  async removeLogo(id: string, userId: string): Promise<SerializedCommunity> {
    return this.writeImage(id, userId, 'community-logos', 'logoUrl', null);
  }

  async join(id: string, userId: string): Promise<JoinCommunityResult> {
    const community = await this.findCommunity(id);
    const membership = await this.members.findOne({
      where: { communityId: id, userId },
    });
    if (membership) {
      return {
        outcome: 'joined',
        community: await this.serializeFor(community, userId),
      };
    }

    if (community.visibility === CommunityVisibility.PRIVATE) {
      throw new NotFoundException(`Community ${id} not found`);
    }

    if (community.visibility === CommunityVisibility.PUBLIC) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO "community_members" ("community_id", "user_id", "role")
           VALUES ($1, $2, 'member')
           ON CONFLICT ("community_id", "user_id") DO NOTHING`,
          [id, userId],
        );
        await this.approvePendingRequest(manager, id, userId);
      });
      return {
        outcome: 'joined',
        community: await this.serializeFor(community, userId),
      };
    }

    const pending = await this.joinRequests.findOne({
      where: {
        communityId: id,
        userId,
        status: CommunityJoinStatus.PENDING,
      },
    });
    if (pending) {
      return { outcome: 'pending' };
    }

    const requester = await this.users.findOne({ where: { id: userId } });
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "community_join_requests" ("community_id", "user_id", "status", "createdAt", "updatedAt")
         VALUES ($1, $2, 'pending', now(), now())
         ON CONFLICT ("community_id", "user_id")
         DO UPDATE SET "status" = 'pending', "createdAt" = now(), "updatedAt" = now()`,
        [id, userId],
      );
      await this.notifications.joinRequest(
        {
          requesterId: userId,
          communityId: community.id,
          payload: {
            communityName: community.name,
            communitySlug: community.slug,
            actorName: requester?.displayName ?? undefined,
          },
        },
        manager,
      );
    });

    return { outcome: 'pending' };
  }

  async leave(id: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, id);
      const membership = await manager.findOne(CommunityMember, {
        where: { communityId: id, userId },
      });
      if (!membership) {
        const community = await manager.findOne(Community, { where: { id } });
        if (community?.visibility === CommunityVisibility.PRIVATE) {
          throw new NotFoundException(`Community ${id} not found`);
        }
        throw new ForbiddenException('You are not a member of this community');
      }
      await this.assertNotLastAdminRemoval(
        manager,
        id,
        membership.role,
        CommunityErrorCode.lastAdminRemoval,
      );
      await this.dropSubgroupAccess(manager, id, userId);
      await manager.remove(membership);
    });
  }

  async listMembers(id: string, userId: string): Promise<SerializedMember[]> {
    await this.findCommunity(id);
    await this.assertMember(id, userId);

    const rows = await this.members.find({
      where: { communityId: id },
      relations: { user: true },
    });

    rows.sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === CommunityMemberRole.ADMIN ? -1 : 1;
      }
      return this.compareDisplayName(
        left.user?.displayName,
        right.user?.displayName,
      );
    });

    return rows.map((member) => this.serializeMember(member));
  }

  async updateMemberRole(
    communityId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    actorId: string,
  ): Promise<SerializedMember> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, communityId);
      await this.assertAdminTx(manager, communityId, actorId);

      const membership = await manager.findOne(CommunityMember, {
        where: { communityId, userId: targetUserId },
        relations: { user: true },
      });
      if (!membership) {
        throw new NotFoundException('Member not found');
      }

      if (dto.role === CommunityMemberRole.MEMBER) {
        await this.assertNotLastAdminRemoval(
          manager,
          communityId,
          membership.role,
          CommunityErrorCode.lastAdminDemotion,
        );
      }

      membership.role = dto.role;
      const saved = await manager.save(membership);
      return this.serializeMember(saved);
    });
  }

  async removeMember(
    communityId: string,
    targetUserId: string,
    actorId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, communityId);
      await this.assertAdminTx(manager, communityId, actorId);

      const membership = await manager.findOne(CommunityMember, {
        where: { communityId, userId: targetUserId },
      });
      if (!membership) {
        throw new NotFoundException('Member not found');
      }

      await this.assertNotLastAdminRemoval(
        manager,
        communityId,
        membership.role,
        CommunityErrorCode.lastAdminRemoval,
      );
      await this.dropSubgroupAccess(manager, communityId, targetUserId);
      await manager.remove(membership);
    });
  }

  async invite(
    communityId: string,
    email: string,
    actorId: string,
  ): Promise<SerializedCommunity> {
    const community = await this.findCommunity(communityId);
    await this.assertAdmin(communityId, actorId);
    const trimmed = email.trim();
    const user = await this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: trimmed })
      .getOne();
    if (!user) throw communityNotFound(CommunityErrorCode.userNotFound);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "community_members" ("community_id", "user_id", "role")
         VALUES ($1, $2, 'member')
         ON CONFLICT ("community_id", "user_id") DO NOTHING`,
        [communityId, user.id],
      );
      await manager.query(
        `UPDATE "community_join_requests"
         SET "status" = 'approved', "updatedAt" = now()
         WHERE "community_id" = $1 AND "user_id" = $2 AND "status" = 'pending'`,
        [communityId, user.id],
      );
    });

    return this.serializeFor(community, actorId);
  }

  async listJoinRequests(
    communityId: string,
    actorId: string,
  ): Promise<SerializedJoinRequest[]> {
    await this.findCommunity(communityId);
    await this.assertAdmin(communityId, actorId);

    const requests = await this.joinRequests.find({
      where: { communityId, status: CommunityJoinStatus.PENDING },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return requests.map((request) => ({
      id: request.id,
      userId: request.userId,
      displayName: request.user?.displayName ?? null,
      createdAt: request.createdAt,
    }));
  }

  async approveJoinRequest(
    communityId: string,
    requestId: string,
    actorId: string,
  ): Promise<{ status: 'approved' }> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, communityId);
      const community = await manager.findOne(Community, {
        where: { id: communityId },
      });
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      await this.assertAdminTx(manager, communityId, actorId);

      const request = await manager.findOne(CommunityJoinRequest, {
        where: { id: requestId, communityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request || request.status !== CommunityJoinStatus.PENDING) {
        throw new NotFoundException('Join request not found');
      }

      request.status = CommunityJoinStatus.APPROVED;
      await manager.save(request);
      await manager.query(
        `INSERT INTO "community_members" ("community_id", "user_id", "role")
         VALUES ($1, $2, 'member')
         ON CONFLICT ("community_id", "user_id") DO NOTHING`,
        [communityId, request.userId],
      );
      await this.notifications.joinDecision(
        request.userId,
        {
          communityName: community.name,
          communitySlug: community.slug,
          decision: 'approved',
        },
        manager,
      );
    });
    return { status: 'approved' };
  }

  async rejectJoinRequest(
    communityId: string,
    requestId: string,
    actorId: string,
  ): Promise<{ status: 'rejected' }> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, communityId);
      const community = await manager.findOne(Community, {
        where: { id: communityId },
      });
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      await this.assertAdminTx(manager, communityId, actorId);

      const request = await manager.findOne(CommunityJoinRequest, {
        where: { id: requestId, communityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request || request.status !== CommunityJoinStatus.PENDING) {
        throw new NotFoundException('Join request not found');
      }

      request.status = CommunityJoinStatus.REJECTED;
      await manager.save(request);
      await this.notifications.joinDecision(
        request.userId,
        {
          communityName: community.name,
          communitySlug: community.slug,
          decision: 'rejected',
        },
        manager,
      );
    });
    return { status: 'rejected' };
  }

  private async writeImage(
    id: string,
    userId: string,
    subject: 'community-heroes' | 'community-logos',
    field: 'heroUrl' | 'logoUrl',
    file: UploadedFile | null,
  ): Promise<SerializedCommunity> {
    const community = await this.findCommunity(id);
    await this.assertAdmin(community.id, userId);

    if (file) {
      community[field] = await this.uploads.save(subject, community.id, file);
    } else {
      await this.uploads.remove(subject, community.id);
      community[field] = null;
    }

    const saved = await this.communities.save(community);
    return this.serializeFor(saved, userId);
  }

  private async findCommunity(id: string): Promise<Community> {
    const community = await this.communities.findOne({ where: { id } });
    if (!community) {
      throw new NotFoundException(`Community ${id} not found`);
    }
    return community;
  }

  /** Locks the community row so concurrent admin removals cannot both succeed. */
  private async lockCommunity(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const locked = await manager.query(
      `SELECT "id" FROM "communities" WHERE "id" = $1 FOR UPDATE`,
      [id],
    );
    if (!Array.isArray(locked) || locked.length === 0) {
      throw new NotFoundException(`Community ${id} not found`);
    }
  }

  /** People who asked to join become members once the community is public. */
  private async admitPendingMembers(
    manager: EntityManager,
    communityId: string,
  ): Promise<string[]> {
    const pending: { user_id: string }[] = await manager.query(
      `SELECT "user_id" FROM "community_join_requests"
       WHERE "community_id" = $1 AND "status" = 'pending'`,
      [communityId],
    );
    await manager.query(
      `INSERT INTO "community_members" ("community_id", "user_id", "role")
       SELECT "community_id", "user_id", 'member'
       FROM "community_join_requests"
       WHERE "community_id" = $1 AND "status" = 'pending'
       ON CONFLICT ("community_id", "user_id") DO NOTHING`,
      [communityId],
    );
    await manager.query(
      `UPDATE "community_join_requests"
       SET "status" = 'approved', "updatedAt" = now()
       WHERE "community_id" = $1 AND "status" = 'pending'`,
      [communityId],
    );
    return pending.map((row) => row.user_id);
  }

  private async approvePendingRequest(
    manager: EntityManager,
    communityId: string,
    userId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE "community_join_requests"
       SET "status" = 'approved', "updatedAt" = now()
       WHERE "community_id" = $1 AND "user_id" = $2 AND "status" = 'pending'`,
      [communityId, userId],
    );
  }

  private async assertMember(
    communityId: string,
    userId: string,
  ): Promise<CommunityMember> {
    const community = await this.findCommunity(communityId);
    const membership = await this.members.findOne({
      where: { communityId, userId },
    });
    if (!membership) {
      if (community.visibility === CommunityVisibility.PRIVATE) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      throw new ForbiddenException('You are not a member of this community');
    }
    return membership;
  }

  private async assertAdmin(
    communityId: string,
    userId: string,
  ): Promise<void> {
    const community = await this.findCommunity(communityId);
    const membership = await this.members.findOne({
      where: { communityId, userId },
    });
    if (!membership && community.visibility === CommunityVisibility.PRIVATE) {
      throw new NotFoundException(`Community ${communityId} not found`);
    }
    if (membership?.role !== CommunityMemberRole.ADMIN) {
      throw new ForbiddenException('Community admin access required');
    }
  }

  private async assertAdminTx(
    manager: EntityManager,
    communityId: string,
    userId: string,
  ): Promise<void> {
    const community = await manager.findOne(Community, {
      where: { id: communityId },
    });
    if (!community) {
      throw new NotFoundException(`Community ${communityId} not found`);
    }
    const membership = await manager.findOne(CommunityMember, {
      where: { communityId, userId },
    });
    if (!membership && community.visibility === CommunityVisibility.PRIVATE) {
      throw new NotFoundException(`Community ${communityId} not found`);
    }
    if (membership?.role !== CommunityMemberRole.ADMIN) {
      throw new ForbiddenException('Community admin access required');
    }
  }

  /** Subgroup rows are not FK'd to community_members, so drop them here. */
  private async dropSubgroupAccess(
    manager: EntityManager,
    communityId: string,
    userId: string,
  ): Promise<void> {
    await manager.query(
      `DELETE FROM "subgroup_members" AS member
       USING "subgroups" AS subgroup
       WHERE member."subgroup_id" = subgroup."id"
         AND subgroup."community_id" = $1
         AND member."user_id" = $2`,
      [communityId, userId],
    );
    await manager.query(
      `DELETE FROM "subgroup_join_requests" AS request
       USING "subgroups" AS subgroup
       WHERE request."subgroup_id" = subgroup."id"
         AND subgroup."community_id" = $1
         AND request."user_id" = $2`,
      [communityId, userId],
    );
  }

  /** Caller must already hold the community row lock. */
  private async assertNotLastAdminRemoval(
    manager: EntityManager,
    communityId: string,
    role: CommunityMemberRole,
    code: CommunityErrorCode,
  ): Promise<void> {
    const adminCount = await manager.count(CommunityMember, {
      where: { communityId, role: CommunityMemberRole.ADMIN },
    });
    if (isLastAdminRemoval(role, adminCount)) {
      throw communityConflict(code);
    }
  }

  private async serializeFor(
    community: Community,
    userId?: string,
  ): Promise<SerializedCommunity> {
    const memberCount = await this.members.count({
      where: { communityId: community.id },
    });
    let myRole: ViewerState['myRole'] = null;
    let myJoinRequest: ViewerState['myJoinRequest'] = null;

    if (userId) {
      const membership = await this.members.findOne({
        where: { communityId: community.id, userId },
      });
      if (membership) {
        myRole = membership.role;
      } else {
        const pending = await this.joinRequests.findOne({
          where: {
            communityId: community.id,
            userId,
            status: CommunityJoinStatus.PENDING,
          },
        });
        if (pending) myJoinRequest = 'pending';
      }
    }

    const [subgroupCount, pollCount, postCount] = await Promise.all([
      this.subgroups.count({ where: { communityId: community.id } }),
      this.polls.count({
        where: { communityId: community.id, subgroupId: IsNull() },
      }),
      this.posts.count({
        where: { communityId: community.id, subgroupId: IsNull() },
      }),
    ]);

    return this.serialize(community, {
      memberCount,
      subgroupCount,
      pollCount,
      postCount,
      myRole,
      myJoinRequest,
    });
  }

  private async viewerStates(
    rows: Community[],
    userId?: string,
  ): Promise<Map<string, ViewerState>> {
    const roles = new Map<string, CommunityMemberRole>();
    const pending = new Set<string>();
    const ids = rows.map((community) => community.id);

    if (userId && ids.length > 0) {
      const memberships = await this.members.find({
        where: { userId, communityId: In(ids) },
      });
      for (const membership of memberships) {
        roles.set(membership.communityId, membership.role);
      }

      const requests = await this.joinRequests.find({
        where: {
          userId,
          communityId: In(ids),
          status: CommunityJoinStatus.PENDING,
        },
      });
      for (const request of requests) {
        pending.add(request.communityId);
      }
    }

    const states = new Map<string, ViewerState>();
    for (const community of rows) {
      const myRole = roles.get(community.id) ?? null;
      states.set(community.id, {
        memberCount: this.readMemberCount(community),
        myRole,
        myJoinRequest: !myRole && pending.has(community.id) ? 'pending' : null,
      });
    }
    return states;
  }

  private viewerStateFor(
    community: Community,
    states: Map<string, ViewerState>,
  ): ViewerState {
    return (
      states.get(community.id) ?? {
        memberCount: this.readMemberCount(community),
        myRole: null,
        myJoinRequest: null,
      }
    );
  }

  /** Sets `memberCount` on each community with one grouped query. */
  private async attachMemberCounts(rows: Community[]): Promise<void> {
    if (rows.length === 0) return;
    const counts = await this.members
      .createQueryBuilder('member')
      .select('member.communityId', 'communityId')
      .addSelect('COUNT(*)', 'count')
      .where('member.communityId IN (:...ids)', { ids: rows.map((c) => c.id) })
      .groupBy('member.communityId')
      .getRawMany<{ communityId: string; count: string }>();
    const byId = new Map(counts.map((r) => [r.communityId, Number(r.count)]));
    for (const row of rows) {
      (row as Community & { memberCount?: number }).memberCount =
        byId.get(row.id) ?? 0;
    }
  }

  private readMemberCount(community: Community): number {
    const counted = community as Community & { memberCount?: number | string };
    const value = counted.memberCount;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (
      typeof value === 'string' &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
    return 0;
  }

  private serialize(
    community: Community,
    viewer: ViewerState,
  ): SerializedCommunity {
    return {
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description ?? null,
      location: community.location ?? null,
      stravaUrl: community.stravaUrl ?? null,
      visibility: community.visibility,
      heroUrl: this.imageAccess.sign(
        community.heroUrl ?? null,
        community.visibility === CommunityVisibility.PRIVATE,
      ),
      logoUrl: this.imageAccess.sign(
        community.logoUrl ?? null,
        community.visibility === CommunityVisibility.PRIVATE,
      ),
      memberCount: viewer.memberCount,
      subgroupCount: viewer.subgroupCount,
      pollCount: viewer.pollCount,
      postCount: viewer.postCount,
      myRole: viewer.myRole,
      myJoinRequest: viewer.myJoinRequest,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
    };
  }

  private serializeMember(member: CommunityMember): SerializedMember {
    return {
      userId: member.userId,
      displayName: member.user?.displayName ?? null,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }

  private compareDisplayName(
    left: string | null | undefined,
    right: string | null | undefined,
  ): number {
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right, 'de', { sensitivity: 'base' });
  }

  private async generateSlug(name: string): Promise<string> {
    const base = slugBase(name, 'community');
    const taken = new Set<string>();
    let slug = pickSlug(base, RESERVED_COMMUNITY_SLUGS, taken);
    while (await this.communities.findOne({ where: { slug } })) {
      taken.add(slug);
      slug = pickSlug(base, RESERVED_COMMUNITY_SLUGS, taken);
    }
    return slug;
  }
}
