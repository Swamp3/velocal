import type {
  NotificationPayload,
  NotificationType,
} from './entities/notification.entity';

export type PushCategory = 'invites' | 'membership' | 'events' | 'community';

export const PUSH_CATEGORIES: PushCategory[] = [
  'invites',
  'membership',
  'events',
  'community',
];

/** Used while a user has not chosen anything. New-event pushes can be frequent, so they start off. */
export const PUSH_DEFAULTS: Record<PushCategory, boolean> = {
  invites: true,
  membership: true,
  events: false,
  community: true,
};

export function categoryOf(type: NotificationType): PushCategory {
  switch (type) {
    case 'event.invite':
      return 'invites';
    case 'join.request':
    case 'join.decision':
      return 'membership';
    case 'event.created':
      return 'events';
    default:
      return 'community';
  }
}

export type PushLang = 'de' | 'en';

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app that opens when the notification is tapped. */
  url: string;
  /** Messages with the same tag replace each other on the device. */
  tag: string;
}

/** Texts mirror the inbox entries in the frontend (`notifications.*`). */
export function buildPushMessage(
  type: NotificationType,
  payload: NotificationPayload,
  lang: PushLang,
): PushMessage {
  const de = lang === 'de';
  const community = payload.communityName;
  const group = payload.subgroupName ?? community;
  const communityUrl = payload.communitySlug
    ? `/communities/${encodeURIComponent(payload.communitySlug)}`
    : '/notifications';
  const eventUrl = payload.eventId
    ? `/events/${encodeURIComponent(payload.eventId)}`
    : '/notifications';

  switch (type) {
    case 'event.created':
      return {
        title: community,
        body: de
          ? `Neues Event: ${payload.eventName ?? ''}`
          : `New event: ${payload.eventName ?? ''}`,
        url: eventUrl,
        tag: `event-${payload.eventId ?? 'new'}`,
      };
    case 'event.invite':
      return {
        title: 'VeloCal',
        body: de
          ? `Du bist zu ${payload.eventName ?? ''} eingeladen`
          : `You're invited to ${payload.eventName ?? ''}`,
        url: eventUrl,
        tag: `invite-${payload.eventId ?? 'new'}`,
      };
    case 'join.request':
      return {
        title: group,
        body: de ? 'Neue Beitrittsanfrage' : 'New join request',
        url: communityUrl,
        tag: `join-${payload.communitySlug}-${payload.subgroupSlug ?? ''}`,
      };
    case 'join.decision':
      return {
        title: group,
        body:
          payload.decision === 'approved'
            ? de
              ? 'Dein Beitritt wurde angenommen'
              : 'Your join request was approved'
            : de
              ? 'Dein Beitritt wurde abgelehnt'
              : 'Your join request was declined',
        url: communityUrl,
        tag: `decision-${payload.communitySlug}-${payload.subgroupSlug ?? ''}`,
      };
    case 'community.deleted':
      return {
        title: 'VeloCal',
        body: de
          ? `Die Community ${community} wurde gelöscht`
          : `The community ${community} was deleted`,
        url: '/notifications',
        tag: `deleted-${community}`,
      };
    case 'subgroup.deleted':
      return {
        title: community,
        body: de
          ? `Die Untergruppe ${payload.subgroupName ?? ''} wurde gelöscht`
          : `The subgroup ${payload.subgroupName ?? ''} was deleted`,
        url: '/notifications',
        tag: `deleted-${community}-${payload.subgroupName ?? ''}`,
      };
    case 'community.suspended':
      return {
        title: community,
        body: de
          ? `Die Community wurde gesperrt: ${payload.reason ?? ''}`
          : `The community was suspended: ${payload.reason ?? ''}`,
        url: communityUrl,
        tag: `suspended-${payload.communitySlug}`,
      };
    case 'community.unsuspended':
      return {
        title: community,
        body: de
          ? 'Die Community ist wieder verfügbar'
          : 'The community is available again',
        url: communityUrl,
        tag: `suspended-${payload.communitySlug}`,
      };
  }
}
