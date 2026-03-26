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
  source: EventSource;
  discipline: Discipline;
  disciplineSlug: string;
  createdById?: string;
  createdAt: string;
  distance?: number;
}

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
  disciplineSlug: string;
}

export type UpdateEventDto = Partial<CreateEventDto>;
