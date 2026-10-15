import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityCleanupService } from './community-cleanup.service';
import { AdminCommunitySearchDto } from './dto/admin-community-search.dto';

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
}

const SORT_SQL = {
  createdAt: 'c."createdAt"',
  name: 'LOWER(c."name")',
  members: '"memberCount"',
  pending: '"pendingRequests"',
} as const;

/** Site-admin view of every community, private ones included. */
@Injectable()
export class AdminCommunitiesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cleanup: CommunityCleanupService,
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
                 WHERE r."community_id" = c."id" AND r."status" = 'pending') AS "pendingRequests"
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
                 WHERE r."community_id" = c."id" AND r."status" = 'pending') AS "pendingRequests"
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

  async removeCommunity(id: string): Promise<void> {
    const [row] = await this.dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "communities" WHERE "id" = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Community not found');
    await this.cleanup.deleteCommunity(id);
  }

  async removeSubgroup(communityId: string, subgroupId: string): Promise<void> {
    const [row] = await this.dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "subgroups" WHERE "id" = $1 AND "community_id" = $2`,
      [subgroupId, communityId],
    );
    if (!row) throw new NotFoundException('Subgroup not found');
    await this.cleanup.deleteSubgroup(subgroupId);
  }

  async removePost(communityId: string, postId: string): Promise<void> {
    const result = await this.dataSource.query(
      `DELETE FROM "community_posts" WHERE "id" = $1 AND "community_id" = $2 RETURNING "id"`,
      [postId, communityId],
    );
    // pg returns [rows, count] for DELETE ... RETURNING
    const deleted = Array.isArray(result[0]) ? result[0].length : result.length;
    if (!deleted) throw new NotFoundException('Post not found');
  }
}
