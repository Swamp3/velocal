import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { User } from '../users/entities/user.entity';
import type {
  NotificationPayload,
  NotificationType,
} from './entities/notification.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import {
  PUSH_CATEGORIES,
  PUSH_DEFAULTS,
  PushCategory,
  PushLang,
  PushMessage,
  buildPushMessage,
  categoryOf,
} from './push-messages';

/** A subscription that failed this many sends in a row is dropped. */
const MAX_FAILURES = 5;
const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;
const TEST_COOLDOWN_MS = 30_000;

export type PushPreferences = Record<PushCategory, boolean>;

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';
  private ready = false;
  private readonly lastTest = new Map<string, number>();

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptions: Repository<PushSubscription>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:noreply@velocal.cc';
    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys are not set: push notifications are off');
      return;
    }
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
      this.ready = true;
    } catch (error) {
      this.logger.error('Invalid VAPID configuration; push is off', error);
    }
  }

  getConfig(): { enabled: boolean; publicKey: string } {
    return { enabled: this.ready, publicKey: this.publicKey };
  }

  async subscribe(
    userId: string,
    input: { endpoint: string; p256dh: string; auth: string },
    userAgent: string | undefined,
  ): Promise<void> {
    await this.subscriptions.upsert(
      {
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
        failureCount: 0,
      },
      ['endpoint'],
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptions.delete({ userId, endpoint });
  }

  async preferences(userId: string): Promise<PushPreferences> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, pushPreferences: true },
    });
    return mergePreferences(user?.pushPreferences);
  }

  async updatePreferences(
    userId: string,
    changes: Partial<PushPreferences>,
  ): Promise<PushPreferences> {
    const next = { ...(await this.preferences(userId)) };
    for (const key of PUSH_CATEGORIES) {
      if (typeof changes[key] === 'boolean') next[key] = changes[key];
    }
    await this.users.update({ id: userId }, { pushPreferences: next });
    return next;
  }

  /** Sends a test message to the caller's own devices. Returns how many accepted it. */
  async sendTest(userId: string): Promise<{ sent: number } | 'cooldown'> {
    const last = this.lastTest.get(userId) ?? 0;
    if (Date.now() - last < TEST_COOLDOWN_MS) return 'cooldown';
    this.lastTest.set(userId, Date.now());
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, preferredLanguage: true },
    });
    const lang: PushLang = user?.preferredLanguage === 'en' ? 'en' : 'de';
    const message: PushMessage = {
      title: 'VeloCal',
      body:
        lang === 'de'
          ? 'Push-Benachrichtigungen funktionieren.'
          : 'Push notifications are working.',
      url: '/profile',
      tag: 'push-test',
    };
    const subs = await this.subscriptions.find({ where: { userId } });
    let sent = 0;
    for (const sub of subs) {
      if (await this.deliver(sub, message)) sent += 1;
    }
    return { sent };
  }

  /**
   * Pushes the notifications that were just written to the inbox. Never
   * throws: push is best effort and must not break the action that caused it.
   */
  async notify(
    userIds: string[],
    type: NotificationType,
    payload: NotificationPayload,
  ): Promise<void> {
    if (!this.ready || userIds.length === 0) return;
    try {
      const category = categoryOf(type);
      const users = await this.users.find({
        where: { id: In(userIds) },
        select: {
          id: true,
          preferredLanguage: true,
          pushPreferences: true,
          bannedAt: true,
        },
      });
      const wanted = users.filter(
        (u) => !u.bannedAt && mergePreferences(u.pushPreferences)[category],
      );
      if (wanted.length === 0) return;
      const subs = await this.subscriptions.find({
        where: { userId: In(wanted.map((u) => u.id)) },
      });
      const byUser = new Map(wanted.map((u) => [u.id, u]));
      const messages: Record<PushLang, PushMessage> = {
        de: buildPushMessage(type, payload, 'de'),
        en: buildPushMessage(type, payload, 'en'),
      };
      await Promise.all(
        subs.map((sub) => {
          const lang: PushLang =
            byUser.get(sub.userId)?.preferredLanguage === 'en' ? 'en' : 'de';
          return this.deliver(sub, messages[lang]);
        }),
      );
    } catch (error) {
      this.logger.error('Sending push notifications failed', error);
    }
  }

  private async deliver(
    sub: PushSubscription,
    message: PushMessage,
  ): Promise<boolean> {
    // Shape understood by the Angular service worker (ngsw-worker.js): it
    // shows the notification and opens `url` when it is tapped.
    const body = JSON.stringify({
      notification: {
        title: message.title,
        body: message.body,
        icon: '/android-chrome-192x192.png',
        tag: message.tag,
        data: {
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: message.url,
            },
          },
        },
      },
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS },
      );
      await this.subscriptions.update(
        { id: sub.id },
        { failureCount: 0, lastSuccessAt: new Date() },
      );
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await this.subscriptions.delete({ id: sub.id });
      } else if (sub.failureCount + 1 >= MAX_FAILURES) {
        await this.subscriptions.delete({ id: sub.id });
      } else {
        await this.subscriptions.update(
          { id: sub.id },
          { failureCount: sub.failureCount + 1 },
        );
      }
      return false;
    }
  }
}

export function mergePreferences(
  stored: Record<string, boolean> | null | undefined,
): PushPreferences {
  const result = { ...PUSH_DEFAULTS };
  for (const key of PUSH_CATEGORIES) {
    if (typeof stored?.[key] === 'boolean') result[key] = stored[key];
  }
  return result;
}
