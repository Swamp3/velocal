import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
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

  async markAllRead(userId: string): Promise<void> {
    await this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('"user_id" = :userId AND "read_at" IS NULL', { userId })
      .execute();
  }

  async eventCreated(input: {
    actorId: string;
    communityId: string;
    subgroupId: string | null;
    payload: NotificationPayload;
  }): Promise<void> {
    const recipients = input.subgroupId
      ? await this.subgroupAudience(
          input.communityId,
          input.subgroupId,
          input.actorId,
        )
      : await this.communityMembers(input.communityId, input.actorId);
    await this.insertMany(recipients, 'event.created', input.payload);
  }

  async joinRequest(input: {
    requesterId: string;
    communityId: string;
    subgroupId?: string;
    payload: NotificationPayload;
  }): Promise<void> {
    const recipients = input.subgroupId
      ? await this.subgroupManagers(
          input.communityId,
          input.subgroupId,
          input.requesterId,
        )
      : await this.communityAdmins(input.communityId, input.requesterId);
    await this.insertMany(recipients, 'join.request', input.payload);
  }

  async joinDecision(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    await this.insertMany([userId], 'join.decision', payload);
  }

  async recordInvite(input: {
    eventId: string;
    eventName: string;
    invitee: User;
    actorId: string;
    payload: NotificationPayload;
  }): Promise<InviteEmailResult> {
    try {
      await this.invites.save(
        this.invites.create({
          eventId: input.eventId,
          userId: input.invitee.id,
          invitedById: input.actorId,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: 'already', emailed: false, emailSkipped: null };
      }
      throw error;
    }

    await this.insertMany([input.invitee.id], 'event.invite', input.payload);

    if (!input.invitee.emailVerified) {
      return { outcome: 'invited', emailed: false, emailSkipped: 'unverified' };
    }

    const sentThisMonth = await this.invites.count({
      where: { emailedAt: MoreThanOrEqual(monthStart()) },
    });
    if (sentThisMonth >= INVITE_EMAIL_MONTHLY_CAP) {
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
      return { outcome: 'invited', emailed: false, emailSkipped: 'disabled' };
    }

    await this.invites.update(
      { eventId: input.eventId, userId: input.invitee.id },
      { emailedAt: new Date() },
    );
    return { outcome: 'invited', emailed: true, emailSkipped: null };
  }

  private async insertMany(
    userIds: string[],
    type: NotificationType,
    payload: NotificationPayload,
  ): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return;
    try {
      await this.notifications.insert(
        unique.map((userId) => ({ userId, type, payload })),
      );
    } catch (error) {
      this.logger.error(`Failed to write ${type} notifications`, error);
    }
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
