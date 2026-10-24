import { Discipline } from './discipline.model';
import { PaceGroup, PaceGroupInput, Route, StravaLink } from './route.model';

export interface CyclingEvent {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  /** False when only the day is known; no time is shown. */
  startTimeKnown?: boolean;
  status: EventStatus;
  locationName: string;
  address?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  registrationStart?: string | null;
  registrationDeadline?: string | null;
  externalUrl?: string;
  stravaUrl?: string | null;
  listing?: 'public' | 'members';
  communityId?: string | null;
  meetupPlace?: string | null;
  meetupAt?: string | null;
  meetupNote?: string | null;
  rsvpCount?: number;
  myRsvp?: EventRsvpStatus | null;
  routeId?: string | null;
  route?: Route | null;
  stravaLinks?: StravaLink[];
  paceGroups?: PaceGroup[];
  recurrenceId?: string | null;
  recurrence?: { id: string; frequency: RecurrenceFrequency } | null;
  canRsvp?: boolean;
  canEditMeetup?: boolean;
  shared?: boolean;
  hostCommunity?: { name: string; slug: string } | null;
  canComment?: boolean;
  canSeeRsvps?: boolean;
  canInvite?: boolean;
  canEdit?: boolean;
  imageUrl?: string;
  /** Where the event's data comes from (name and link). */
  sources?: { name: string; url: string }[];
  source: EventSource;
  discipline: Discipline;
  disciplineSlug: string;
  createdById?: string;
  createdAt: string;
  distance?: number;
}

export type RecurrenceFrequency = 'weekly' | 'biweekly';

export interface RecurrenceDto {
  frequency: RecurrenceFrequency;
  until?: string;
  count?: number;
  timezone: string;
}

export type EventRsvpStatus = 'going' | 'maybe' | 'declined';

export type EventStatus = 'published' | 'cancelled' | 'completed';
export type EventSource = 'manual' | 'imported';

export interface CreateEventDto {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status?: EventStatus;
  locationName: string;
  address?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  registrationStart?: string | null;
  registrationDeadline?: string | null;
  externalUrl?: string;
  stravaUrl?: string;
  listing?: 'public' | 'members';
  meetupPlace?: string;
  meetupAt?: string;
  meetupNote?: string;
  disciplineSlug: string;
  recurrence?: RecurrenceDto;
  routeId?: string | null;
  paceGroups?: PaceGroupInput[];
  stravaLinks?: { url: string; label?: string }[];
}

export type UpdateEventDto = Partial<CreateEventDto>;
