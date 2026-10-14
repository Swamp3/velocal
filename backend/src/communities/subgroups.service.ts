import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ImageAccessService } from '../uploads/image-access.service';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';
import {
  CommunityErrorCode,
  communityForbidden,
  communityNotFound,
} from './community-error';
import { pickSlug, RESERVED_SUBGROUP_SLUGS, slugBase } from './community-slug';
import { CreateSubgroupDto } from './dto/create-subgroup.dto';
import { UpdateSubgroupDto } from './dto/update-subgroup.dto';
import { UpdateSubgroupRoleDto } from './dto/update-subgroup-role.dto';
import { CommunityJoinStatus } from './entities/community-join-request.entity';
import {
  CommunityMember,
  CommunityMemberRole,
} from './entities/community-member.entity';
import { Community, CommunityVisibility } from './entities/community.entity';
import { SubgroupJoinRequest } from './entities/subgroup-join-request.entity';
import {
  SubgroupMember,
  SubgroupMemberRole,
} from './entities/subgroup-member.entity';
import { Subgroup, SubgroupVisibility } from './entities/subgroup.entity';

export interface SerializedSubgroup {
  id: string;
  communityId: string;
  communitySlug: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: SubgroupVisibility;
  heroUrl: string | null;
  logoUrl: string | null;
  memberCount: number;
  myRole: SubgroupMemberRole | null;
  myJoinRequest: 'pending' | null;
  viewerIsCommunityAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedSubgroupMember {
  userId: string;
  displayName: string | null;
  role: SubgroupMemberRole;
  joinedAt: Date;
}

export interface SerializedSubgroupJoinRequest {
  id: string;
  userId: string;
  displayName: string | null;
  createdAt: Date;
}

export type JoinSubgroupResult =
  | { outcome: 'joined'; subgroup: SerializedSubgroup }
  | { outcome: 'pending' };

@Injectable()
export class SubgroupsService {
  constructor(
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(SubgroupMember)
    private readonly members: Repository<SubgroupMember>,
    @InjectRepository(SubgroupJoinRequest)
    private readonly joinRequests: Repository<SubgroupJoinRequest>,
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly communityMembers: Repository<CommunityMember>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly uploads: UploadsService,
    private readonly imageAccess: ImageAccessService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    communitySlug: string,
    dto: CreateSubgroupDto,
    userId: string,
  ): Promise<SerializedSubgroup> {
    const community = await this.requireReadableCommunity(
      communitySlug,
      userId,
    );
    await this.assertCommunityAdmin(community.id, userId);
    const slug = await this.generateSlug(community.id, dto.name);
    const saved = await this.subgroups.save(
      this.subgroups.create({
        communityId: community.id,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        visibility: dto.visibility ?? SubgroupVisibility.OPEN,
      }),
    );
    return this.serializeFor(saved, community, userId);
  }

  async list(
    communitySlug: string,
    userId?: string,
  ): Promise<SerializedSubgroup[]> {
    const community = await this.requireReadableCommunity(
      communitySlug,
      userId,
    );
    const isAdmin = await this.isCommunityAdmin(community.id, userId);
    const rows = await this.subgroups.find({
      where: { communityId: community.id },
      order: { name: 'ASC' },
    });

    const visible: Subgroup[] = [];
    for (const row of rows) {
      if (await this.canSee(row, userId, isAdmin)) visible.push(row);
    }

    return Promise.all(
      visible.map((row) => this.serializeFor(row, community, userId)),
    );
  }

  async findBySlug(
    communitySlug: string,
    slug: string,
    userId?: string,
  ): Promise<SerializedSubgroup> {
    const { subgroup, community, isAdmin } = await this.requireVisible(
      communitySlug,
      slug,
      userId,
    );
    if (!isAdmin && !(await this.canSee(subgroup, userId, false))) {
      throw new NotFoundException('Subgroup not found');
    }
    return this.serializeFor(subgroup, community, userId);
  }

  async update(
    communitySlug: string,
    slug: string,
    dto: UpdateSubgroupDto,
    userId: string,
  ): Promise<SerializedSubgroup> {
    const { subgroup, community, isAdmin } = await this.requireManageable(
      communitySlug,
      slug,
      userId,
    );
    if (dto.name !== undefined) subgroup.name = dto.name;
    if (dto.description !== undefined) subgroup.description = dto.description;
    const opening =
      isAdmin &&
      dto.visibility === SubgroupVisibility.OPEN &&
      subgroup.visibility !== SubgroupVisibility.OPEN;
    if (isAdmin && dto.visibility !== undefined) {
      subgroup.visibility = dto.visibility;
    }
    let admitted: string[] = [];
    const saved = await this.dataSource.transaction(async (manager) => {
      const row = await manager.save(subgroup);
      if (opening)
        admitted = await this.admitPendingMembers(manager, subgroup.id);
      return row;
    });
    if (admitted.length > 0) {
      await Promise.all(
        admitted.map((memberId) =>
          this.notifications.joinDecision(memberId, {
            communityName: community.name,
            communitySlug: community.slug,
            subgroupName: saved.name,
            subgroupSlug: saved.slug,
            decision: 'approved',
          }),
        ),
      );
    }
    return this.serializeFor(saved, community, userId);
  }

  async remove(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<void> {
    const { subgroup, community } = await this.requireVisible(
      communitySlug,
      slug,
      userId,
    );
    await this.assertCommunityAdmin(community.id, userId);
    await this.uploads.remove('community-heroes', subgroup.id);
    await this.uploads.remove('community-logos', subgroup.id);
    await this.subgroups.remove(subgroup);
  }

  async setHero(
    communitySlug: string,
    slug: string,
    file: UploadedFile,
    userId: string,
  ): Promise<SerializedSubgroup> {
    return this.writeImage(communitySlug, slug, userId, 'heroUrl', file);
  }

  async removeHero(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<SerializedSubgroup> {
    return this.writeImage(communitySlug, slug, userId, 'heroUrl', null);
  }

  async setLogo(
    communitySlug: string,
    slug: string,
    file: UploadedFile,
    userId: string,
  ): Promise<SerializedSubgroup> {
    return this.writeImage(communitySlug, slug, userId, 'logoUrl', file);
  }

  async removeLogo(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<SerializedSubgroup> {
    return this.writeImage(communitySlug, slug, userId, 'logoUrl', null);
  }

  async join(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<JoinSubgroupResult> {
    const { subgroup, community } = await this.requireVisible(
      communitySlug,
      slug,
      userId,
    );
    const communityMember = await this.communityMembers.findOne({
      where: { communityId: community.id, userId },
    });
    if (!communityMember) {
      throw communityForbidden(CommunityErrorCode.notCommunityMember);
    }

    const existing = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId },
    });
    if (existing) {
      return {
        outcome: 'joined',
        subgroup: await this.serializeFor(subgroup, community, userId),
      };
    }

    if (subgroup.visibility === SubgroupVisibility.INVITE) {
      throw communityForbidden(CommunityErrorCode.inviteOnly);
    }

    if (subgroup.visibility === SubgroupVisibility.OPEN) {
      await this.dataSource.transaction(async (manager) => {
        await this.lockCommunity(manager, community.id);
        const inserted = await this.insertMemberIfCommunityMember(
          manager,
          subgroup.id,
          community.id,
          userId,
        );
        if (!inserted) {
          throw communityForbidden(CommunityErrorCode.notCommunityMember);
        }
        await this.approvePendingRequest(manager, subgroup.id, userId);
      });
      return {
        outcome: 'joined',
        subgroup: await this.serializeFor(subgroup, community, userId),
      };
    }

    const alreadyPending = await this.joinRequests.findOne({
      where: {
        subgroupId: subgroup.id,
        userId,
        status: CommunityJoinStatus.PENDING,
      },
    });
    if (alreadyPending) return { outcome: 'pending' };

    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, community.id);
      const member = await manager.findOne(CommunityMember, {
        where: { communityId: community.id, userId },
      });
      if (!member) {
        throw communityForbidden(CommunityErrorCode.notCommunityMember);
      }
      await manager.query(
        `INSERT INTO "subgroup_join_requests" ("subgroup_id", "user_id", "status", "createdAt", "updatedAt")
         VALUES ($1, $2, 'pending', now(), now())
         ON CONFLICT ("subgroup_id", "user_id")
         DO UPDATE SET "status" = 'pending', "createdAt" = now(), "updatedAt" = now()`,
        [subgroup.id, userId],
      );
    });
    const requester = await this.users.findOne({ where: { id: userId } });
    await this.notifications.joinRequest({
      requesterId: userId,
      communityId: community.id,
      subgroupId: subgroup.id,
      payload: {
        communityName: community.name,
        communitySlug: community.slug,
        subgroupName: subgroup.name,
        subgroupSlug: subgroup.slug,
        actorName: requester?.displayName ?? undefined,
      },
    });
    return { outcome: 'pending' };
  }

  async leave(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<void> {
    const { subgroup } = await this.requireVisible(communitySlug, slug, userId);
    const membership = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this subgroup');
    }
    await this.members.remove(membership);
  }

  async listMembers(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<SerializedSubgroupMember[]> {
    const { subgroup, isAdmin } = await this.requireVisible(
      communitySlug,
      slug,
      userId,
    );
    const mine = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId },
    });
    if (!isAdmin && !mine) {
      throw new ForbiddenException('Subgroup members only');
    }

    const rows = await this.members.find({
      where: { subgroupId: subgroup.id },
      relations: { user: true },
    });
    rows.sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === SubgroupMemberRole.MODERATOR ? -1 : 1;
      }
      return (left.user?.displayName ?? '').localeCompare(
        right.user?.displayName ?? '',
      );
    });
    return rows.map((member) => ({
      userId: member.userId,
      displayName: member.user?.displayName ?? null,
      role: member.role,
      joinedAt: member.createdAt,
    }));
  }

  async updateMemberRole(
    communitySlug: string,
    slug: string,
    targetUserId: string,
    dto: UpdateSubgroupRoleDto,
    actorId: string,
  ): Promise<SerializedSubgroupMember> {
    const { subgroup, community } = await this.requireVisible(
      communitySlug,
      slug,
      actorId,
    );
    await this.assertCommunityAdmin(community.id, actorId);
    const membership = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId: targetUserId },
      relations: { user: true },
    });
    if (!membership) throw new NotFoundException('Member not found');
    membership.role = dto.role;
    const saved = await this.members.save(membership);
    return {
      userId: saved.userId,
      displayName: saved.user?.displayName ?? null,
      role: saved.role,
      joinedAt: saved.createdAt,
    };
  }

  async removeMember(
    communitySlug: string,
    slug: string,
    targetUserId: string,
    actorId: string,
  ): Promise<void> {
    const { subgroup, isAdmin } = await this.requireManageable(
      communitySlug,
      slug,
      actorId,
    );
    const membership = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId: targetUserId },
    });
    if (!membership) throw new NotFoundException('Member not found');
    if (!isAdmin) {
      throw new ForbiddenException('Community admin access required');
    }
    await this.members.remove(membership);
  }

  async listJoinRequests(
    communitySlug: string,
    slug: string,
    actorId: string,
  ): Promise<SerializedSubgroupJoinRequest[]> {
    const { subgroup } = await this.requireManageable(
      communitySlug,
      slug,
      actorId,
    );
    const requests = await this.joinRequests.find({
      where: { subgroupId: subgroup.id, status: CommunityJoinStatus.PENDING },
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
    communitySlug: string,
    slug: string,
    requestId: string,
    actorId: string,
  ): Promise<{ status: 'approved' }> {
    const { subgroup, community } = await this.requireManageable(
      communitySlug,
      slug,
      actorId,
    );
    const requesterId = await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, community.id);
      const request = await manager.findOne(SubgroupJoinRequest, {
        where: { id: requestId, subgroupId: subgroup.id },
      });
      if (!request || request.status !== CommunityJoinStatus.PENDING) {
        throw new NotFoundException('Join request not found');
      }
      request.status = CommunityJoinStatus.APPROVED;
      await manager.save(request);
      const inserted = await this.insertMemberIfCommunityMember(
        manager,
        subgroup.id,
        community.id,
        request.userId,
      );
      if (!inserted) {
        throw communityForbidden(CommunityErrorCode.notCommunityMember);
      }
      return request.userId;
    });
    await this.notifications.joinDecision(requesterId, {
      communityName: community.name,
      communitySlug: community.slug,
      subgroupName: subgroup.name,
      subgroupSlug: subgroup.slug,
      decision: 'approved',
    });
    return { status: 'approved' };
  }

  async rejectJoinRequest(
    communitySlug: string,
    slug: string,
    requestId: string,
    actorId: string,
  ): Promise<{ status: 'rejected' }> {
    const { subgroup, community } = await this.requireManageable(
      communitySlug,
      slug,
      actorId,
    );
    const request = await this.requirePending(subgroup.id, requestId);
    request.status = CommunityJoinStatus.REJECTED;
    await this.joinRequests.save(request);
    await this.notifications.joinDecision(request.userId, {
      communityName: community.name,
      communitySlug: community.slug,
      subgroupName: subgroup.name,
      subgroupSlug: subgroup.slug,
      decision: 'rejected',
    });
    return { status: 'rejected' };
  }

  async invite(
    communitySlug: string,
    slug: string,
    email: string,
    actorId: string,
  ): Promise<SerializedSubgroup> {
    const { subgroup, community } = await this.requireManageable(
      communitySlug,
      slug,
      actorId,
    );
    const user = await this.findUserByEmail(email);
    if (!user) throw communityNotFound(CommunityErrorCode.userNotFound);
    const communityMember = await this.communityMembers.findOne({
      where: { communityId: community.id, userId: user.id },
    });
    if (!communityMember) {
      throw communityNotFound(CommunityErrorCode.notCommunityMember);
    }

    await this.dataSource.transaction(async (manager) => {
      await this.lockCommunity(manager, community.id);
      const inserted = await this.insertMemberIfCommunityMember(
        manager,
        subgroup.id,
        community.id,
        user.id,
      );
      if (!inserted) {
        throw communityNotFound(CommunityErrorCode.notCommunityMember);
      }
      await this.approvePendingRequest(manager, subgroup.id, user.id);
    });

    return this.serializeFor(subgroup, community, actorId);
  }

  private async writeImage(
    communitySlug: string,
    slug: string,
    userId: string,
    field: 'heroUrl' | 'logoUrl',
    file: UploadedFile | null,
  ): Promise<SerializedSubgroup> {
    const { subgroup, community } = await this.requireManageable(
      communitySlug,
      slug,
      userId,
    );
    const subject =
      field === 'heroUrl' ? 'community-heroes' : 'community-logos';
    if (file) {
      subgroup[field] = await this.uploads.save(subject, subgroup.id, file);
    } else {
      await this.uploads.remove(subject, subgroup.id);
      subgroup[field] = null;
    }
    const saved = await this.subgroups.save(subgroup);
    return this.serializeFor(saved, community, userId);
  }

  private async requirePending(
    subgroupId: string,
    requestId: string,
  ): Promise<SubgroupJoinRequest> {
    const request = await this.joinRequests.findOne({
      where: { id: requestId, subgroupId },
    });
    if (!request || request.status !== CommunityJoinStatus.PENDING) {
      throw new NotFoundException('Join request not found');
    }
    return request;
  }

  private async requireReadableCommunity(
    slug: string,
    userId?: string,
  ): Promise<Community> {
    const community = await this.communities.findOne({ where: { slug } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.visibility === CommunityVisibility.PRIVATE) {
      const membership = userId
        ? await this.communityMembers.findOne({
            where: { communityId: community.id, userId },
          })
        : null;
      if (!membership) throw new NotFoundException('Community not found');
    }
    return community;
  }

  private async requireVisible(
    communitySlug: string,
    slug: string,
    userId?: string,
  ): Promise<{ subgroup: Subgroup; community: Community; isAdmin: boolean }> {
    const community = await this.requireReadableCommunity(
      communitySlug,
      userId,
    );
    const subgroup = await this.subgroups.findOne({
      where: { communityId: community.id, slug },
    });
    if (!subgroup) throw new NotFoundException('Subgroup not found');
    const isAdmin = await this.isCommunityAdmin(community.id, userId);
    if (subgroup.visibility === SubgroupVisibility.INVITE && !isAdmin) {
      const membership = userId
        ? await this.members.findOne({
            where: { subgroupId: subgroup.id, userId },
          })
        : null;
      if (!membership) throw new NotFoundException('Subgroup not found');
    }
    return { subgroup, community, isAdmin };
  }

  private async requireManageable(
    communitySlug: string,
    slug: string,
    userId: string,
  ): Promise<{ subgroup: Subgroup; community: Community; isAdmin: boolean }> {
    const loaded = await this.requireVisible(communitySlug, slug, userId);
    if (loaded.isAdmin) return loaded;
    const membership = await this.members.findOne({
      where: { subgroupId: loaded.subgroup.id, userId },
    });
    if (membership?.role !== SubgroupMemberRole.MODERATOR) {
      throw new ForbiddenException('Subgroup moderator access required');
    }
    return loaded;
  }

  private async canSee(
    subgroup: Subgroup,
    userId: string | undefined,
    isAdmin: boolean,
  ): Promise<boolean> {
    if (isAdmin) return true;
    if (subgroup.visibility !== SubgroupVisibility.INVITE) return true;
    if (!userId) return false;
    const membership = await this.members.findOne({
      where: { subgroupId: subgroup.id, userId },
    });
    return !!membership;
  }

  private async isCommunityAdmin(
    communityId: string,
    userId?: string,
  ): Promise<boolean> {
    if (!userId) return false;
    const membership = await this.communityMembers.findOne({
      where: { communityId, userId },
    });
    return membership?.role === CommunityMemberRole.ADMIN;
  }

  private async assertCommunityAdmin(
    communityId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.isCommunityAdmin(communityId, userId))) {
      throw new ForbiddenException('Community admin access required');
    }
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    const trimmed = email.trim();
    if (!trimmed) return null;
    return this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: trimmed })
      .getOne();
  }

  private async generateSlug(
    communityId: string,
    name: string,
  ): Promise<string> {
    const base = slugBase(name, 'group');
    const taken = new Set<string>();
    let slug = pickSlug(base, RESERVED_SUBGROUP_SLUGS, taken);
    while (await this.subgroups.findOne({ where: { communityId, slug } })) {
      taken.add(slug);
      slug = pickSlug(base, RESERVED_SUBGROUP_SLUGS, taken);
    }
    return slug;
  }

  private async lockCommunity(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const locked = await manager.query(
      `SELECT "id" FROM "communities" WHERE "id" = $1 FOR UPDATE`,
      [id],
    );
    if (!Array.isArray(locked) || locked.length === 0) {
      throw new NotFoundException('Community not found');
    }
  }

  /**
   * Inserts a subgroup member only while the community membership row exists.
   * The caller holds the community row lock, which `leave` also takes.
   */
  private async insertMemberIfCommunityMember(
    manager: EntityManager,
    subgroupId: string,
    communityId: string,
    userId: string,
  ): Promise<boolean> {
    const inserted: Array<{ user_id: string }> = await manager.query(
      `INSERT INTO "subgroup_members" ("subgroup_id", "user_id", "role")
       SELECT $1, member."user_id", 'member'
       FROM "community_members" member
       WHERE member."community_id" = $2 AND member."user_id" = $3
       ON CONFLICT ("subgroup_id", "user_id") DO NOTHING
       RETURNING "user_id"`,
      [subgroupId, communityId, userId],
    );
    if (inserted.length > 0) return true;
    const existing = await manager.findOne(SubgroupMember, {
      where: { subgroupId, userId },
    });
    return !!existing;
  }

  private async admitPendingMembers(
    manager: EntityManager,
    subgroupId: string,
  ): Promise<string[]> {
    const pending: { user_id: string }[] = await manager.query(
      `SELECT request."user_id"
       FROM "subgroup_join_requests" request
       INNER JOIN "subgroups" subgroup ON subgroup."id" = request."subgroup_id"
       INNER JOIN "community_members" member
         ON member."community_id" = subgroup."community_id"
        AND member."user_id" = request."user_id"
       WHERE request."subgroup_id" = $1 AND request."status" = 'pending'`,
      [subgroupId],
    );
    await manager.query(
      `INSERT INTO "subgroup_members" ("subgroup_id", "user_id", "role")
       SELECT request."subgroup_id", request."user_id", 'member'
       FROM "subgroup_join_requests" request
       INNER JOIN "subgroups" subgroup ON subgroup."id" = request."subgroup_id"
       INNER JOIN "community_members" member
         ON member."community_id" = subgroup."community_id"
        AND member."user_id" = request."user_id"
       WHERE request."subgroup_id" = $1 AND request."status" = 'pending'
       ON CONFLICT ("subgroup_id", "user_id") DO NOTHING`,
      [subgroupId],
    );
    await manager.query(
      `UPDATE "subgroup_join_requests" AS request
       SET "status" = 'approved', "updatedAt" = now()
       WHERE request."subgroup_id" = $1
         AND request."status" = 'pending'
         AND EXISTS (
           SELECT 1
           FROM "community_members" AS member
           INNER JOIN "subgroups" AS subgroup ON subgroup."id" = request."subgroup_id"
           WHERE member."community_id" = subgroup."community_id"
             AND member."user_id" = request."user_id"
         )`,
      [subgroupId],
    );
    return pending.map((row) => row.user_id);
  }

  private async approvePendingRequest(
    manager: EntityManager,
    subgroupId: string,
    userId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE "subgroup_join_requests"
       SET "status" = 'approved', "updatedAt" = now()
       WHERE "subgroup_id" = $1 AND "user_id" = $2 AND "status" = 'pending'`,
      [subgroupId, userId],
    );
  }

  private imagesRestricted(subgroup: Subgroup, community: Community): boolean {
    return (
      community.visibility === CommunityVisibility.PRIVATE ||
      subgroup.visibility === SubgroupVisibility.INVITE
    );
  }

  private async serializeFor(
    subgroup: Subgroup,
    community: Community,
    userId?: string,
  ): Promise<SerializedSubgroup> {
    const memberCount = await this.members.count({
      where: { subgroupId: subgroup.id },
    });
    const membership = userId
      ? await this.members.findOne({
          where: { subgroupId: subgroup.id, userId },
        })
      : null;
    const pending = userId
      ? await this.joinRequests.findOne({
          where: {
            subgroupId: subgroup.id,
            userId,
            status: CommunityJoinStatus.PENDING,
          },
        })
      : null;
    const viewerIsCommunityAdmin = await this.isCommunityAdmin(
      subgroup.communityId,
      userId,
    );
    return {
      id: subgroup.id,
      communityId: subgroup.communityId,
      communitySlug: community.slug,
      slug: subgroup.slug,
      name: subgroup.name,
      description: subgroup.description ?? null,
      visibility: subgroup.visibility,
      heroUrl: this.imageAccess.sign(
        subgroup.heroUrl ?? null,
        this.imagesRestricted(subgroup, community),
      ),
      logoUrl: this.imageAccess.sign(
        subgroup.logoUrl ?? null,
        this.imagesRestricted(subgroup, community),
      ),
      memberCount,
      myRole: membership?.role ?? null,
      myJoinRequest: pending ? 'pending' : null,
      viewerIsCommunityAdmin,
      createdAt: subgroup.createdAt,
      updatedAt: subgroup.updatedAt,
    };
  }
}
