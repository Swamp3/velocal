import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { CommunityCleanupService } from './community-cleanup.service';

/** Shown wherever content of a deleted account is still displayed. */
export const DELETED_USER_NAME = '[deleted]';

interface Handover {
  communityId: string;
  slug: string;
  name: string;
  newAdminId: string;
}

/**
 * Deletes an account by emptying it: personal data and private records are
 * removed, the user row stays as an anonymous shell so that events, routes and
 * (optionally) posts keep a valid author instead of breaking or vanishing.
 *
 * Communities the user alone administered pass to their longest-standing
 * member; communities left without members are deleted.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cleanup: CommunityCleanupService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async deleteAccount(
    userId: string,
    input: { password?: string; confirmEmail: string; deleteContent: boolean },
  ): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOneBy({
      id: userId,
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (user.isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'adminCannotDelete',
        message: 'Another admin must remove your admin role first.',
      });
    }
    if (input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'emailMismatch',
        message: 'The email address does not match.',
      });
    }
    if (user.passwordHash) {
      const ok =
        !!input.password &&
        (await bcrypt.compare(input.password, user.passwordHash));
      if (!ok) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'wrongPassword',
          message: 'The password is wrong.',
        });
      }
    }

    const handovers: Handover[] = [];
    const emptied: string[] = [];
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE`, [
        userId,
      ]);
      await this.passOnCommunities(manager, userId, handovers, emptied);
      if (input.deleteContent) await this.removeContent(manager, userId);
      await this.removePrivateData(manager, user);
      await this.anonymize(manager, user);
    });

    await this.audit.record({
      actorId: userId,
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
      targetLabel: `user ${userId.slice(0, 8)}`,
      details: { deleteContent: input.deleteContent },
    });

    for (const communityId of emptied) {
      try {
        await this.cleanup.deleteCommunity(communityId, userId);
      } catch (error) {
        this.logger.error(`Deleting empty community ${communityId}`, error);
      }
    }
    for (const h of handovers) {
      await this.notifications
        .notifyUsers([h.newAdminId], 'community.admin_assigned', {
          communityName: h.name,
          communitySlug: h.slug,
        })
        .catch((error) => this.logger.error('Admin handover notice', error));
    }
  }

  /**
   * For every community of the user: if they were its only admin, the member
   * who has been there longest becomes admin; if nobody else is left the
   * community is queued for deletion. Then the membership is removed.
   */
  private async passOnCommunities(
    manager: EntityManager,
    userId: string,
    handovers: Handover[],
    emptied: string[],
  ): Promise<void> {
    const memberships = await manager.query<
      { community_id: string; role: string; slug: string; name: string }[]
    >(
      `SELECT cm."community_id", cm."role", c."slug", c."name"
       FROM "community_members" cm
       JOIN "communities" c ON c."id" = cm."community_id"
       WHERE cm."user_id" = $1`,
      [userId],
    );
    for (const m of memberships) {
      const [others] = await manager.query<
        { admins: number; members: number }[]
      >(
        `SELECT COUNT(*) FILTER (WHERE "role" = 'admin')::int AS admins,
                COUNT(*)::int AS members
         FROM "community_members"
         WHERE "community_id" = $1 AND "user_id" <> $2`,
        [m.community_id, userId],
      );
      if (others.members === 0) {
        emptied.push(m.community_id);
        continue;
      }
      if (m.role === 'admin' && others.admins === 0) {
        // Prefer someone who can still sign in; among them, the longest member.
        const [next] = await manager.query<{ user_id: string }[]>(
          `SELECT cm."user_id"
           FROM "community_members" cm
           JOIN "users" u ON u."id" = cm."user_id"
           WHERE cm."community_id" = $1 AND cm."user_id" <> $2
           ORDER BY (u."bannedAt" IS NOT NULL) ASC, cm."createdAt" ASC
           LIMIT 1`,
          [m.community_id, userId],
        );
        await manager.query(
          `UPDATE "community_members" SET "role" = 'admin'
           WHERE "community_id" = $1 AND "user_id" = $2`,
          [m.community_id, next.user_id],
        );
        handovers.push({
          communityId: m.community_id,
          slug: m.slug,
          name: m.name,
          newAdminId: next.user_id,
        });
      }
    }
  }

  private async removeContent(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await manager.query(
      `DELETE FROM "community_post_comments" WHERE "author_id" = $1`,
      [userId],
    );
    await manager.query(
      `DELETE FROM "community_posts" WHERE "author_id" = $1`,
      [userId],
    );
    await manager.query(
      `DELETE FROM "community_polls" WHERE "author_id" = $1`,
      [userId],
    );
    await manager.query(`DELETE FROM "event_comments" WHERE "author_id" = $1`, [
      userId,
    ]);
  }

  private async removePrivateData(
    manager: EntityManager,
    user: User,
  ): Promise<void> {
    const byUser: [string, string][] = [
      ['user_favorites', 'userId'],
      ['user_discipline_prefs', 'userId'],
      ['password_reset_tokens', 'userId'],
      ['notifications', 'user_id'],
      ['push_subscriptions', 'user_id'],
      ['community_join_requests', 'user_id'],
      ['subgroup_join_requests', 'user_id'],
      ['community_members', 'user_id'],
      ['subgroup_members', 'user_id'],
      ['community_poll_votes', 'user_id'],
      ['event_rsvps', 'user_id'],
      ['event_invites', 'user_id'],
    ];
    for (const [table, column] of byUser) {
      await manager.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [
        user.id,
      ]);
    }
    await manager.query(`DELETE FROM "otp_tokens" WHERE lower("email") = $1`, [
      user.email.toLowerCase(),
    ]);
    await manager.query(
      `UPDATE "reports" SET "reporter_id" = NULL WHERE "reporter_id" = $1`,
      [user.id],
    );
    await manager.query(
      `UPDATE "admin_audit_log" SET "actor_label" = $2 WHERE "actor_id" = $1`,
      [user.id, DELETED_USER_NAME],
    );
    await manager.query(
      `UPDATE "admin_audit_log" SET "target_label" = $2
       WHERE "target_type" = 'user' AND "target_id" = $1`,
      [user.id, DELETED_USER_NAME],
    );
  }

  private async anonymize(manager: EntityManager, user: User): Promise<void> {
    await manager.query(
      `UPDATE "users" SET
         "email" = $2, "passwordHash" = NULL, "emailVerified" = false,
         "displayName" = $3, "firstName" = NULL, "lastName" = NULL,
         "stravaUrl" = NULL, "homeZip" = NULL, "homeCountry" = NULL,
         "homeCoordinates" = NULL, "pushPreferences" = NULL,
         "isAdmin" = false, "deletedAt" = now()
       WHERE "id" = $1`,
      [user.id, `deleted-${user.id}@deleted.invalid`, DELETED_USER_NAME],
    );
  }
}
