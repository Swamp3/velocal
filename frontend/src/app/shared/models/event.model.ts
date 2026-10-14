import { Discipline } from './discipline.model';

export interface CyclingEvent {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: EventStatus;
  locationName: string;
  address?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  registrationDeadline?: string;
  externalUrl?: string;
  stravaUrl?: string | null;
  listing?: 'public' | 'members';
  communityId?: string | null;
  meetupPlace?: string | null;
  meetupAt?: string | null;
  meetupNote?: string | null;
  rsvpCount?: number;
  myRsvp?: EventRsvpStatus | null;
  canComment?: boolean;
  canSeeRsvps?: boolean;
  imageUrl?: string;
  source: EventSource;
  discipline: Discipline;
  disciplineSlug: string;
  createdById?: string;
  createdAt: string;
  distance?: number;
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
  registrationDeadline?: string;
  externalUrl?: string;
  stravaUrl?: string;
  listing?: 'public' | 'members';
  meetupPlace?: string;
  meetupAt?: string;
  meetupNote?: string;
  disciplineSlug: string;
}

export type UpdateEventDto = Partial<CreateEventDto>;
