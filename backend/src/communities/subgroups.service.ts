import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';
import {
  CommunityErrorCode,
  communityForbidden,
  communityNotFound,
} from './community-error';
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
    private readonly dataSource: DataSource,
  ) {}

  async create(
    communitySlug: string,
    dto: CreateSubgroupDto,
    userId: string,
  ): Promise<SerializedSubgroup> {
    const community = await this.requireReadableCommunity(communitySlug, userId);
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
    return this.serializeFor(saved, community.slug, userId);
  }

  async list(
    communitySlug: string,
    userId?: string,
  ): Promise<SerializedSubgroup[]> {
    const community = await this.requireReadableCommunity(communitySlug, userId);
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
      visible.map((row) => this.serializeFor(row, community.slug, userId)),
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
    return this.serializeFor(subgroup, community.slug, userId);
  }

  async update(
    communitySlug: string,
    slug: string,
    dto: UpdateSubgroupDto,
    userId: string,
  ): Promise<SerializedSubgroup> {
    const { subgroup, community } = await this.requireManageable(
      communitySlug,
      slug,
      userId,
    );
    if (dto.name !== undefined) subgroup.name = dto.name;
    if (dto.description !== undefined) subgroup.description = dto.description;
    if (dto.visibility !== undefined) subgroup.visibility = dto.visibility;
    const saved = await this.subgroups.save(subgroup);
    return this.serializeFor(saved, community.slug, userId);
  }

  async remove(communitySlug: string, slug: string, userId: string): Promise<void> {
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
        subgroup: await this.serializeFor(subgroup, community.slug, userId),
      };
    }

    if (subgroup.visibility === SubgroupVisibility.INVITE) {
      throw communityForbidden(CommunityErrorCode.inviteOnly);
    }

    if (subgroup.visibility === SubgroupVisibility.OPEN) {
      await this.dataSource.query(
        `INSERT INTO "subgroup_members" ("subgroup_id", "user_id", "role")
         VALUES ($1, $2, 'member')
         ON CONFLICT ("subgroup_id", "user_id") DO NOTHING`,
        [subgroup.id, userId],
      );
      return {
        outcome: 'joined',
        subgroup: await this.serializeFor(subgroup, community.slug, userId),
      };
    }

    await this.dataSource.query(
      `INSERT INTO "subgroup_join_requests" ("subgroup_id", "user_id", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, 'pending', now(), now())
       ON CONFLICT ("subgroup_id", "user_id")
       DO UPDATE SET "status" = 'pending', "createdAt" = now(), "updatedAt" = now()`,
      [subgroup.id, userId],
    );
    return { outcome: 'pending' };
  }

  async leave(communitySlug: string, slug: string, userId: string): Promise<void> {
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
    if (!isAdmin && membership.role === SubgroupMemberRole.MODERATOR) {
      throw new ForbiddenException('Only a community admin can remove a moderator');
    }
    await this.members.remove(membership);
  }

  async listJoinRequests(
    communitySlug: string,
    slug: string,
    actorId: string,
  ): Promise<SerializedSubgroupJoinRequest[]> {
    const { subgroup } = await this.requireManageable(communitySlug, slug, actorId);
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
    const { subgroup } = await this.requireManageable(communitySlug, slug, actorId);
    const request = await this.requirePending(subgroup.id, requestId);
    await this.dataSource.transaction(async (manager) => {
      request.status = CommunityJoinStatus.APPROVED;
      await manager.save(request);
      await manager.query(
        `INSERT INTO "subgroup_members" ("subgroup_id", "user_id", "role")
         VALUES ($1, $2, 'member')
         ON CONFLICT ("subgroup_id", "user_id") DO NOTHING`,
        [subgroup.id, request.userId],
      );
    });
    return { status: 'approved' };
  }

  async rejectJoinRequest(
    communitySlug: string,
    slug: string,
    requestId: string,
    actorId: string,
  ): Promise<{ status: 'rejected' }> {
    const { subgroup } = await this.requireManageable(communitySlug, slug, actorId);
    const request = await this.requirePending(subgroup.id, requestId);
    request.status = CommunityJoinStatus.REJECTED;
    await this.joinRequests.save(request);
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
      await manager.query(
        `INSERT INTO "subgroup_members" ("subgroup_id", "user_id", "role")
         VALUES ($1, $2, 'member')
         ON CONFLICT ("subgroup_id", "user_id") DO NOTHING`,
        [subgroup.id, user.id],
      );
      await manager
        .createQueryBuilder()
        .update(SubgroupJoinRequest)
        .set({ status: CommunityJoinStatus.APPROVED })
        .where('subgroup_id = :subgroupId AND user_id = :userId AND status = :status', {
          subgroupId: subgroup.id,
          userId: user.id,
          status: CommunityJoinStatus.PENDING,
        })
        .execute();
    });

    return this.serializeFor(subgroup, community.slug, actorId);
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
    const subject = field === 'heroUrl' ? 'community-heroes' : 'community-logos';
    if (file) {
      subgroup[field] = await this.uploads.save(subject, subgroup.id, file);
    } else {
      await this.uploads.remove(subject, subgroup.id);
      subgroup[field] = null;
    }
    const saved = await this.subgroups.save(subgroup);
    return this.serializeFor(saved, community.slug, userId);
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
    const community = await this.requireReadableCommunity(communitySlug, userId);
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

  private async generateSlug(communityId: string, name: string): Promise<string> {
    let base = name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!base) base = 'group';

    let slug = base;
    let suffix = 2;
    while (
      await this.subgroups.findOne({ where: { communityId, slug } })
    ) {
      slug = `${base}-${suffix}`;
      suffix++;
    }
    return slug;
  }

  private async serializeFor(
    subgroup: Subgroup,
    communitySlug: string,
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
      communitySlug,
      slug: subgroup.slug,
      name: subgroup.name,
      description: subgroup.description ?? null,
      visibility: subgroup.visibility,
      heroUrl: subgroup.heroUrl ?? null,
      logoUrl: subgroup.logoUrl ?? null,
      memberCount,
      myRole: membership?.role ?? null,
      myJoinRequest: pending ? 'pending' : null,
      viewerIsCommunityAdmin,
      createdAt: subgroup.createdAt,
      updatedAt: subgroup.updatedAt,
    };
  }
}
