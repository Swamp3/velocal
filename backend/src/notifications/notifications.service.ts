import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { EventInvite } from './entities/event-invite.entity';
import {
  Notification,
  NotificationPayload,
  NotificationType,
} from './entities/notification.entity';

/** Leaves the rest of the 3000/month Resend budget for password reset and OTP. */
export const INVITE_EMAIL_MONTHLY_CAP = 400;

export interface InviteEmailResult {
  outcome: 'invited' | 'already';
  emailed: boolean;
  emailSkipped: 'unverified' | 'cap' | 'disabled' | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(EventInvite)
    private readonly invites: Repository<EventInvite>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async list(userId: string): Promise<Notification[]> {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const row = await this.notifications.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found');
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notifications.save(row);
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.notifications.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Notification not found');
  }

  async removeAll(userId: string): Promise<void> {
    await this.notifications.delete({ userId });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('"user_id" = :userId AND "read_at" IS NULL', { userId })
      .execute();
  }

  async eventCreated(
    input: {
      actorId: string;
      communityId: string;
      subgroupId: string | null;
      payload: NotificationPayload;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const recipients = input.subgroupId
      ? await this.subgroupAudience(
          input.communityId,
          input.subgroupId,
          input.actorId,
        )
      : await this.communityMembers(input.communityId, input.actorId);
    await this.insertMany(recipients, 'event.created', input.payload, manager);
  }

  async joinRequest(
    input: {
      requesterId: string;
      communityId: string;
      subgroupId?: string;
      payload: NotificationPayload;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const recipients = input.subgroupId
      ? await this.subgroupManagers(
          input.communityId,
          input.subgroupId,
          input.requesterId,
        )
      : await this.communityAdmins(input.communityId, input.requesterId);
    await this.insertMany(recipients, 'join.request', input.payload, manager);
  }

  async joinDecision(
    userId: string,
    payload: NotificationPayload,
    manager?: EntityManager,
  ): Promise<void> {
    await this.insertMany([userId], 'join.decision', payload, manager);
  }

  async recordInvite(input: {
    eventId: string;
    eventName: string;
    invitee: User;
    actorId: string;
    payload: NotificationPayload;
  }): Promise<InviteEmailResult> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.save(
          manager.create(EventInvite, {
            eventId: input.eventId,
            userId: input.invitee.id,
            invitedById: input.actorId,
          }),
        );
        await this.insertMany(
          [input.invitee.id],
          'event.invite',
          input.payload,
          manager,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: 'already', emailed: false, emailSkipped: null };
      }
      throw error;
    }

    if (!input.invitee.emailVerified) {
      return { outcome: 'invited', emailed: false, emailSkipped: 'unverified' };
    }

    const claimed = await this.claimInviteEmail(
      input.eventId,
      input.invitee.id,
    );
    if (!claimed) {
      this.logger.warn(
        `Event invite email cap reached (${INVITE_EMAIL_MONTHLY_CAP})`,
      );
      return { outcome: 'invited', emailed: false, emailSkipped: 'cap' };
    }

    const url = `${this.siteUrl()}/events/${input.eventId}`;
    const lang = input.invitee.preferredLanguage === 'en' ? 'en' : 'de';
    let sent = false;
    try {
      sent = await this.mail.sendEventInvite(
        input.invitee.email,
        input.eventName,
        url,
        lang,
      );
    } catch (error) {
      this.logger.error(
        `Event invite mail failed for ${input.invitee.id}`,
        error,
      );
    }
    if (!sent) {
      await this.invites.update(
        { eventId: input.eventId, userId: input.invitee.id },
        { emailedAt: null },
      );
      return { outcome: 'invited', emailed: false, emailSkipped: 'disabled' };
    }

    return { outcome: 'invited', emailed: true, emailSkipped: null };
  }

  /**
   * Reserves one monthly invite email. The advisory lock serializes the count
   * and the `emailedAt` write. A failed send clears `emailedAt` so it does not
   * consume the cap.
   */
  private async claimInviteEmail(
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock($1)`, [404_000_001]);
      const sentThisMonth = await manager.count(EventInvite, {
        where: { emailedAt: MoreThanOrEqual(monthStart()) },
      });
      if (sentThisMonth >= INVITE_EMAIL_MONTHLY_CAP) return false;
      await manager.update(
        EventInvite,
        { eventId, userId },
        { emailedAt: new Date() },
      );
      return true;
    });
  }

  private async insertMany(
    userIds: string[],
    type: NotificationType,
    payload: NotificationPayload,
    manager?: EntityManager,
  ): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return;
    const repo = manager
      ? manager.getRepository(Notification)
      : this.notifications;
    await repo.insert(unique.map((userId) => ({ userId, type, payload })));
  }

  private async communityMembers(
    communityId: string,
    exceptUserId: string,
  ): Promise<string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      `SELECT "user_id" FROM "community_members" WHERE "community_id" = $1 AND "user_id" <> $2`,
      [communityId, exceptUserId],
    );
    return rows.map((row) => row.user_id);
  }

  private async communityAdmins(
    communityId: string,
    exceptUserId: string,
  ): Promise<string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      `SELECT "user_id" FROM "community_members"
       WHERE "community_id" = $1 AND "role" = 'admin' AND "user_id" <> $2`,
      [communityId, exceptUserId],
    );
    return rows.map((row) => row.user_id);
  }

  private async subgroupAudience(
    communityId: string,
    subgroupId: string,
    exceptUserId: string,
  ): Promise<string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      `SELECT "user_id" FROM (
         SELECT "user_id" FROM "subgroup_members" WHERE "subgroup_id" = $1
         UNION
         SELECT "user_id" FROM "community_members"
         WHERE "community_id" = $2 AND "role" = 'admin'
       ) people
       WHERE "user_id" <> $3`,
      [subgroupId, communityId, exceptUserId],
    );
    return rows.map((row) => row.user_id);
  }

  private async subgroupManagers(
    communityId: string,
    subgroupId: string,
    exceptUserId: string,
  ): Promise<string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      `SELECT "user_id" FROM (
         SELECT "user_id" FROM "subgroup_members"
         WHERE "subgroup_id" = $1 AND "role" = 'moderator'
         UNION
         SELECT "user_id" FROM "community_members"
         WHERE "community_id" = $2 AND "role" = 'admin'
       ) people
       WHERE "user_id" <> $3`,
      [subgroupId, communityId, exceptUserId],
    );
    return rows.map((row) => row.user_id);
  }

  private siteUrl(): string {
    return (
      this.config.get<string>('SITE_URL') ?? 'https://velocal.cc'
    ).replace(/\/$/, '');
  }
}

function monthStart(): Date {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as { code?: string }).code === '23505'
  );
}
