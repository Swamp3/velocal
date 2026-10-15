import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';

/**
 * Deletes a community or subgroup together with everything that belongs to it.
 * The database foreign keys cascade to members, requests, posts, polls, events,
 * shares and RSVPs; this adds what the database cannot reach: uploaded files,
 * inbox entries that point at the deleted page, and repeat rules left empty.
 */
@Injectable()
export class CommunityCleanupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uploads: UploadsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * `actorId` is the person who deleted it; they are not notified. Everyone else
   * who was a member gets an inbox message, written after the delete so the
   * clean-up of notifications that point at the page does not remove it.
   */
  async deleteCommunity(communityId: string, actorId?: string): Promise<void> {
    const [community] = await this.dataSource.query<
      { slug: string; name: string }[]
    >(`SELECT "slug", "name" FROM "communities" WHERE "id" = $1`, [
      communityId,
    ]);
    const memberIds = (
      await this.dataSource.query<{ user_id: string }[]>(
        `SELECT "user_id" FROM "community_members" WHERE "community_id" = $1`,
        [communityId],
      )
    )
      .map((row) => row.user_id)
      .filter((id) => id !== actorId);
    const eventIds = await this.ids(
      `SELECT "id" FROM "events" WHERE "community_id" = $1`,
      communityId,
    );
    const subgroupIds = await this.ids(
      `SELECT "id" FROM "subgroups" WHERE "community_id" = $1`,
      communityId,
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE "reports" SET "status" = 'resolved', "resolved_at" = now(),
                "resolution_note" = 'Community deleted'
         WHERE "community_id" = $1 AND "status" = 'open'`,
        [communityId],
      );
      await manager.query(`DELETE FROM "communities" WHERE "id" = $1`, [
        communityId,
      ]);
      if (community) {
        await manager.query(
          `DELETE FROM "notifications" WHERE "payload"->>'communitySlug' = $1`,
          [community.slug],
        );
      }
      await this.dropEmptyRecurrences(manager);
    });
    await this.removeFiles(eventIds, [communityId, ...subgroupIds]);
    if (community) {
      await this.notifications.notifyUsers(memberIds, 'community.deleted', {
        communityName: community.name,
        communitySlug: '',
      });
    }
  }

  async deleteSubgroup(subgroupId: string, actorId?: string): Promise<void> {
    const [subgroup] = await this.dataSource.query<
      {
        slug: string;
        name: string;
        communitySlug: string;
        communityName: string;
      }[]
    >(
      `SELECT s."slug" AS "slug", s."name" AS "name",
              c."slug" AS "communitySlug", c."name" AS "communityName"
       FROM "subgroups" s JOIN "communities" c ON c."id" = s."community_id"
       WHERE s."id" = $1`,
      [subgroupId],
    );
    const memberIds = (
      await this.dataSource.query<{ user_id: string }[]>(
        `SELECT "user_id" FROM "subgroup_members" WHERE "subgroup_id" = $1`,
        [subgroupId],
      )
    )
      .map((row) => row.user_id)
      .filter((id) => id !== actorId);
    const eventIds = await this.ids(
      `SELECT "id" FROM "events" WHERE "subgroup_id" = $1`,
      subgroupId,
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM "subgroups" WHERE "id" = $1`, [
        subgroupId,
      ]);
      if (subgroup) {
        await manager.query(
          `DELETE FROM "notifications"
           WHERE "payload"->>'communitySlug' = $1 AND "payload"->>'subgroupSlug' = $2`,
          [subgroup.communitySlug, subgroup.slug],
        );
      }
      await this.dropEmptyRecurrences(manager);
    });
    await this.removeFiles(eventIds, [subgroupId]);
    if (subgroup) {
      await this.notifications.notifyUsers(memberIds, 'subgroup.deleted', {
        communityName: subgroup.communityName,
        communitySlug: '',
        subgroupName: subgroup.name,
      });
    }
  }

  private async ids(sql: string, param: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(sql, [param]);
    return rows.map((row) => row.id);
  }

  private async dropEmptyRecurrences(manager: {
    query: (sql: string) => Promise<unknown>;
  }): Promise<void> {
    await manager.query(
      `DELETE FROM "event_recurrences" r
       WHERE NOT EXISTS (SELECT 1 FROM "events" e WHERE e."recurrence_id" = r."id")`,
    );
  }

  /** Best effort: a leftover file must not turn a finished delete into an error. */
  private async removeFiles(
    eventIds: string[],
    imageOwnerIds: string[],
  ): Promise<void> {
    for (const id of eventIds) await this.uploads.remove('events', id);
    for (const id of imageOwnerIds) {
      await this.uploads.remove('community-heroes', id);
      await this.uploads.remove('community-logos', id);
    }
  }
}
