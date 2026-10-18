import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityCleanupService } from './community-cleanup.service';
import { AdminCommunitySearchDto } from './dto/admin-community-search.dto';
import { SlugReplaceDto } from './dto/admin-slug.dto';
import {
  isValidSlug,
  planSlugReplace,
  RESERVED_COMMUNITY_SLUGS,
  RESERVED_SUBGROUP_SLUGS,
  SlugChange,
} from './community-slug';

export interface SlugChangePreview {
  type: 'community' | 'subgroup';
  id: string;
  name: string;
  oldSlug: string;
  newSlug: string;
  problem: SlugChange['problem'];
}

export interface AdminCommunityRow {
  id: string;
  slug: string;
  name: string;
  visibility: 'public' | 'request' | 'private';
  location: string | null;
  createdAt: Date;
  createdByName: string | null;
  createdByEmail: string | null;
  memberCount: number;
  subgroupCount: number;
  postCount: number;
  pollCount: number;
  eventCount: number;
  pendingRequests: number;
  openReports: number;
  suspendedAt: Date | null;
  suspendedReason: string | null;
}

const SORT_SQL = {
  createdAt: 'c."createdAt"',
  name: 'LOWER(c."name")',
  members: '"memberCount"',
  pending: '"pendingRequests"',
  reports: '"openReports"',
} as const;

/** Site-admin view of every community, private ones included. */
@Injectable()
export class AdminCommunitiesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cleanup: CommunityCleanupService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(dto: AdminCommunitySearchDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const params: unknown[] = [];
    const where: string[] = [];
    if (dto.q) {
      params.push(`%${dto.q}%`);
      where.push(
        `(c."name" ILIKE $${params.length} OR c."slug" ILIKE $${params.length})`,
      );
    }
    if (dto.visibility) {
      params.push(dto.visibility);
      where.push(`c."visibility" = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = `${SORT_SQL[dto.sort ?? 'createdAt']} ${dto.order === 'ASC' ? 'ASC' : 'DESC'}`;

    const [{ total }] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*) AS "total" FROM "communities" c ${whereSql}`,
      params,
    );
    const rows = await this.dataSource.query<AdminCommunityRow[]>(
      `SELECT c."id", c."slug", c."name", c."visibility", c."location", c."createdAt",
              u."displayName" AS "createdByName", u."email" AS "createdByEmail",
              (SELECT COUNT(*)::int FROM "community_members" m WHERE m."community_id" = c."id") AS "memberCount",
              (SELECT COUNT(*)::int FROM "subgroups" s WHERE s."community_id" = c."id") AS "subgroupCount",
              (SELECT COUNT(*)::int FROM "community_posts" p WHERE p."community_id" = c."id") AS "postCount",
              (SELECT COUNT(*)::int FROM "community_polls" l WHERE l."community_id" = c."id") AS "pollCount",
              (SELECT COUNT(*)::int FROM "events" e WHERE e."community_id" = c."id") AS "eventCount",
              (SELECT COUNT(*)::int FROM "community_join_requests" r
                 WHERE r."community_id" = c."id" AND r."status" = 'pending') AS "pendingRequests",
              (SELECT COUNT(*)::int FROM "reports" rp
                 WHERE rp."community_id" = c."id" AND rp."status" = 'open') AS "openReports",
              c."suspended_at" AS "suspendedAt", c."suspended_reason" AS "suspendedReason"
       FROM "communities" c
       LEFT JOIN "users" u ON u."id" = c."created_by_id"
       ${whereSql}
       ORDER BY ${orderSql}, c."id"
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    return { data: rows, total: Number(total), page, limit };
  }

  async detail(id: string) {
    const [community] = await this.dataSource.query<
      (AdminCommunityRow & {
        description: string | null;
        stravaUrl: string | null;
      })[]
    >(
      `SELECT c."id", c."slug", c."name", c."description", c."visibility", c."location",
              c."strava_url" AS "stravaUrl", c."createdAt",
              u."displayName" AS "createdByName", u."email" AS "createdByEmail",
              (SELECT COUNT(*)::int FROM "community_members" m WHERE m."community_id" = c."id") AS "memberCount",
              (SELECT COUNT(*)::int FROM "subgroups" s WHERE s."community_id" = c."id") AS "subgroupCount",
              (SELECT COUNT(*)::int FROM "community_posts" p WHERE p."community_id" = c."id") AS "postCount",
              (SELECT COUNT(*)::int FROM "community_polls" l WHERE l."community_id" = c."id") AS "pollCount",
              (SELECT COUNT(*)::int FROM "events" e WHERE e."community_id" = c."id") AS "eventCount",
              (SELECT COUNT(*)::int FROM "community_join_requests" r
                 WHERE r."community_id" = c."id" AND r."status" = 'pending') AS "pendingRequests",
              (SELECT COUNT(*)::int FROM "reports" rp
                 WHERE rp."community_id" = c."id" AND rp."status" = 'open') AS "openReports",
              c."suspended_at" AS "suspendedAt", c."suspended_reason" AS "suspendedReason"
       FROM "communities" c
       LEFT JOIN "users" u ON u."id" = c."created_by_id"
       WHERE c."id" = $1`,
      [id],
    );
    if (!community) throw new NotFoundException('Community not found');

    const [admins, subgroups, posts, events] = await Promise.all([
      this.dataSource.query(
        `SELECT m."user_id" AS "userId", u."displayName", u."email"
         FROM "community_members" m JOIN "users" u ON u."id" = m."user_id"
         WHERE m."community_id" = $1 AND m."role" = 'admin'
         ORDER BY u."displayName" NULLS LAST`,
        [id],
      ),
      this.dataSource.query(
        `SELECT s."id", s."slug", s."name", s."visibility",
                (SELECT COUNT(*)::int FROM "subgroup_members" m WHERE m."subgroup_id" = s."id") AS "memberCount",
                (SELECT COUNT(*)::int FROM "community_posts" p WHERE p."subgroup_id" = s."id") AS "postCount"
         FROM "subgroups" s WHERE s."community_id" = $1 ORDER BY LOWER(s."name")`,
        [id],
      ),
      this.dataSource.query(
        `SELECT p."id", p."title", p."createdAt", u."displayName" AS "authorName",
                s."name" AS "subgroupName"
         FROM "community_posts" p
         LEFT JOIN "users" u ON u."id" = p."author_id"
         LEFT JOIN "subgroups" s ON s."id" = p."subgroup_id"
         WHERE p."community_id" = $1 ORDER BY p."createdAt" DESC LIMIT 20`,
        [id],
      ),
      this.dataSource.query(
        `SELECT e."id", e."name", e."startDate", e."listing", s."name" AS "subgroupName"
         FROM "events" e LEFT JOIN "subgroups" s ON s."id" = e."subgroup_id"
         WHERE e."community_id" = $1 ORDER BY e."startDate" DESC LIMIT 20`,
        [id],
      ),
    ]);
    return {
      ...community,
      admins,
      subgroups,
      recentPosts: posts,
      recentEvents: events,
    };
  }

  async removeCommunity(id: string, actorId: string): Promise<void> {
    const [row] = await this.dataSource.query<
      { id: string; name: string; members: number }[]
    >(
      `SELECT c."id", c."name",
              (SELECT COUNT(*)::int FROM "community_members" m WHERE m."community_id" = c."id") AS "members"
       FROM "communities" c WHERE c."id" = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Community not found');
    await this.cleanup.deleteCommunity(id, actorId);
    await this.audit.record({
      actorId,
      action: 'community.delete',
      targetType: 'community',
      targetId: id,
      targetLabel: row.name,
      communityId: id,
      details: { members: row.members, via: 'admin' },
    });
  }

  async removeSubgroup(
    communityId: string,
    subgroupId: string,
    actorId: string,
  ): Promise<void> {
    const [row] = await this.dataSource.query<{ id: string; name: string }[]>(
      `SELECT "id", "name" FROM "subgroups" WHERE "id" = $1 AND "community_id" = $2`,
      [subgroupId, communityId],
    );
    if (!row) throw new NotFoundException('Subgroup not found');
    await this.cleanup.deleteSubgroup(subgroupId, actorId);
    await this.audit.record({
      actorId,
      action: 'subgroup.delete',
      targetType: 'subgroup',
      targetId: subgroupId,
      targetLabel: row.name,
      communityId,
      details: { via: 'admin' },
    });
  }

  async removePost(
    communityId: string,
    postId: string,
    actorId: string,
  ): Promise<void> {
    const rows = await this.dataSource.query<{ title: string }[]>(
      `DELETE FROM "community_posts" WHERE "id" = $1 AND "community_id" = $2 RETURNING "title"`,
      [postId, communityId],
    );
    // pg returns [rows, count] for DELETE ... RETURNING
    const deleted = Array.isArray(rows[0])
      ? (rows[0] as unknown as { title: string }[])
      : rows;
    if (!deleted.length) throw new NotFoundException('Post not found');
    await this.closeReports('post', postId, actorId, 'Content removed');
    await this.audit.record({
      actorId,
      action: 'post.delete',
      targetType: 'post',
      targetId: postId,
      targetLabel: deleted[0].title,
      communityId,
    });
  }

  async removeComment(
    communityId: string,
    commentId: string,
    actorId: string,
  ): Promise<void> {
    const [found] = await this.dataSource.query<{ body: string }[]>(
      `SELECT c."body" FROM "community_post_comments" c
       JOIN "community_posts" p ON p."id" = c."post_id"
       WHERE c."id" = $1 AND p."community_id" = $2`,
      [commentId, communityId],
    );
    if (!found) throw new NotFoundException('Comment not found');
    await this.dataSource.query(
      `DELETE FROM "community_post_comments" WHERE "id" = $1`,
      [commentId],
    );
    await this.closeReports('comment', commentId, actorId, 'Content removed');
    await this.audit.record({
      actorId,
      action: 'comment.delete',
      targetType: 'comment',
      targetId: commentId,
      targetLabel: found.body
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120),
      communityId,
    });
  }

  /** Hides the community and makes it read-only until it is lifted. */
  async suspend(id: string, reason: string, actorId: string): Promise<void> {
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('A reason is required');
    const [row] = await this.dataSource
      .query<{ id: string; name: string; slug: string }[]>(
        `UPDATE "communities" SET "suspended_at" = now(), "suspended_reason" = $2
       WHERE "id" = $1 AND "suspended_at" IS NULL RETURNING "id", "name", "slug"`,
        [id, trimmed],
      )
      .then((res) => (Array.isArray(res[0]) ? res[0] : res));
    if (!row)
      throw new NotFoundException('Community not found or already suspended');
    await this.notifyAdmins(
      id,
      'community.suspended',
      row.name,
      row.slug,
      trimmed,
      actorId,
    );
    await this.audit.record({
      actorId,
      action: 'community.suspend',
      targetType: 'community',
      targetId: id,
      targetLabel: row.name,
      communityId: id,
      details: { reason: trimmed },
    });
  }

  async unsuspend(id: string, actorId: string): Promise<void> {
    const [row] = await this.dataSource
      .query<{ id: string; name: string; slug: string }[]>(
        `UPDATE "communities" SET "suspended_at" = NULL, "suspended_reason" = NULL
       WHERE "id" = $1 AND "suspended_at" IS NOT NULL RETURNING "id", "name", "slug"`,
        [id],
      )
      .then((res) => (Array.isArray(res[0]) ? res[0] : res));
    if (!row)
      throw new NotFoundException('Community not found or not suspended');
    await this.notifyAdmins(
      id,
      'community.unsuspended',
      row.name,
      row.slug,
      undefined,
      actorId,
    );
    await this.audit.record({
      actorId,
      action: 'community.unsuspend',
      targetType: 'community',
      targetId: id,
      targetLabel: row.name,
      communityId: id,
    });
  }

  /** Sets the address of one community. Old links stop working, so only admins may do this. */
  async renameSlug(id: string, slug: string, actorId: string): Promise<void> {
    if (!isValidSlug(slug)) {
      throw new BadRequestException(
        'Use lower-case letters, digits and single hyphens',
      );
    }
    if (RESERVED_COMMUNITY_SLUGS.has(slug)) {
      throw new BadRequestException('This address is reserved');
    }
    const [row] = await this.dataSource.query<{ name: string; slug: string }[]>(
      `SELECT "name", "slug" FROM "communities" WHERE "id" = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Community not found');
    if (row.slug === slug) return;
    const [clash] = await this.dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "communities" WHERE "slug" = $1`,
      [slug],
    );
    if (clash) throw new ConflictException('This address is already taken');
    await this.dataSource.transaction(async (manager) => {
      await this.applyCommunitySlug(manager, id, row.slug, slug);
    });
    await this.audit.record({
      actorId,
      action: 'community.slug',
      targetType: 'community',
      targetId: id,
      targetLabel: row.name,
      communityId: id,
      details: { from: row.slug, to: slug },
    });
  }

  /**
   * Replaces `find` with `replace` in the addresses of communities and/or subgroups. Without
   * `apply` it only returns what would change; with `apply` nothing is changed unless every
   * result is valid and free.
   */
  async replaceSlugs(
    dto: SlugReplaceDto,
    actorId: string,
  ): Promise<{ applied: boolean; changes: SlugChangePreview[] }> {
    const withCommunities = dto.target !== 'subgroups';
    const withSubgroups = dto.target !== 'communities';

    const communities = await this.dataSource.query<
      { id: string; name: string; slug: string }[]
    >(`SELECT "id", "name", "slug" FROM "communities"`);
    const subgroups = await this.dataSource.query<
      { id: string; name: string; slug: string; community_id: string }[]
    >(`SELECT "id", "name", "slug", "community_id" FROM "subgroups"`);

    const taken = new Map<string, Set<string>>();
    taken.set('communities', new Set(communities.map((c) => c.slug)));
    for (const sub of subgroups) {
      const set = taken.get(sub.community_id) ?? new Set<string>();
      set.add(sub.slug);
      taken.set(sub.community_id, set);
    }

    const names = new Map<string, string>();
    for (const c of communities) names.set(c.id, c.name);
    for (const sub of subgroups) names.set(sub.id, sub.name);
    const types = new Map<string, 'community' | 'subgroup'>();

    const plans: SlugChange[] = [];
    if (withCommunities) {
      for (const c of communities) types.set(c.id, 'community');
      plans.push(
        ...planSlugReplace(
          communities.map((c) => ({
            id: c.id,
            scope: 'communities',
            slug: c.slug,
          })),
          dto.find,
          dto.replace,
          RESERVED_COMMUNITY_SLUGS,
          taken,
        ),
      );
    }
    if (withSubgroups) {
      for (const sub of subgroups) types.set(sub.id, 'subgroup');
      plans.push(
        ...planSlugReplace(
          subgroups.map((sub) => ({
            id: sub.id,
            scope: sub.community_id,
            slug: sub.slug,
          })),
          dto.find,
          dto.replace,
          RESERVED_SUBGROUP_SLUGS,
          taken,
        ),
      );
    }

    const changes: SlugChangePreview[] = plans.map((plan) => ({
      type: types.get(plan.id) ?? 'community',
      id: plan.id,
      name: names.get(plan.id) ?? '',
      oldSlug: plan.slug,
      newSlug: plan.newSlug,
      problem: plan.problem,
    }));

    if (!dto.apply) return { applied: false, changes };
    const selected = dto.ids
      ? changes.filter((change) => dto.ids?.includes(change.id))
      : changes;
    if (selected.some((change) => change.problem)) {
      throw new BadRequestException({
        message: 'Some addresses cannot be changed; nothing was changed',
        changes,
      });
    }
    if (selected.length === 0) return { applied: true, changes: [] };

    const parentSlug = new Map(communities.map((c) => [c.id, c.slug]));
    const subParent = new Map(
      subgroups.map((sub) => [sub.id, sub.community_id]),
    );
    await this.dataSource.transaction(async (manager) => {
      // Communities first, so subgroup notifications use the new community address.
      for (const change of selected.filter((c) => c.type === 'community')) {
        await this.applyCommunitySlug(
          manager,
          change.id,
          change.oldSlug,
          change.newSlug,
        );
        parentSlug.set(change.id, change.newSlug);
      }
      for (const change of selected.filter((c) => c.type === 'subgroup')) {
        const communityId = subParent.get(change.id) as string;
        await manager.query(
          `UPDATE "subgroups" SET "slug" = $2 WHERE "id" = $1`,
          [change.id, change.newSlug],
        );
        await manager.query(
          `UPDATE "notifications"
              SET "payload" = jsonb_set("payload", '{subgroupSlug}', to_jsonb($3::text))
            WHERE "payload"->>'communitySlug' = $1 AND "payload"->>'subgroupSlug' = $2`,
          [parentSlug.get(communityId), change.oldSlug, change.newSlug],
        );
      }
    });
    for (const change of selected) {
      await this.audit.record({
        actorId,
        action:
          change.type === 'community' ? 'community.slug' : 'subgroup.slug',
        targetType: change.type,
        targetId: change.id,
        targetLabel: change.name,
        details: {
          from: change.oldSlug,
          to: change.newSlug,
          find: dto.find,
          replace: dto.replace,
        },
      });
    }
    return { applied: true, changes: selected };
  }

  private async applyCommunitySlug(
    manager: EntityManager,
    id: string,
    oldSlug: string,
    newSlug: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE "communities" SET "slug" = $2 WHERE "id" = $1`,
      [id, newSlug],
    );
    // Inbox links of earlier notifications carry the address.
    await manager.query(
      `UPDATE "notifications"
          SET "payload" = jsonb_set("payload", '{communitySlug}', to_jsonb($2::text))
        WHERE "payload"->>'communitySlug' = $1`,
      [oldSlug, newSlug],
    );
  }

  private async notifyAdmins(
    communityId: string,
    type: 'community.suspended' | 'community.unsuspended',
    name: string,
    slug: string,
    reason: string | undefined,
    actorId: string,
  ): Promise<void> {
    const admins = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT "user_id" FROM "community_members" WHERE "community_id" = $1 AND "role" = 'admin' AND "user_id" <> $2`,
      [communityId, actorId],
    );
    await this.notifications.notifyUsers(
      admins.map((row) => row.user_id),
      type,
      { communityName: name, communitySlug: slug, reason },
    );
  }

  /** Reports about content that has been removed are done. */
  private async closeReports(
    targetType: string,
    targetId: string,
    actorId: string,
    note: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE "reports" SET "status" = 'resolved', "resolved_by_id" = $3,
              "resolved_at" = now(), "resolution_note" = $4
       WHERE "target_type" = $1 AND "target_id" = $2 AND "status" = 'open'`,
      [targetType, targetId, actorId, note],
    );
  }
}
