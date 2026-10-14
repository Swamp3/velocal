import { inject, Injectable } from '@angular/core';
import {
  CreateEventDto,
  CyclingEvent,
  EventRsvpStatus,
  PaginatedResponse,
  UpdateEventDto,
} from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type EventSort = 'date' | 'distance' | 'name';

export interface EventSearchParams {
  q?: string;
  discipline?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  zip?: string;
  country?: string;
  sort?: EventSort;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(ApiService);

  getEvents(params: EventSearchParams = {}): Observable<PaginatedResponse<CyclingEvent>> {
    return this.api.get('/events', params as Record<string, string | number | boolean>);
  }

  getEvent(id: string): Observable<CyclingEvent> {
    return this.api.get(`/events/${id}`);
  }

  createEvent(dto: CreateEventDto): Observable<CyclingEvent> {
    return this.api.post('/events', dto);
  }

  updateEvent(id: string, dto: UpdateEventDto): Observable<CyclingEvent> {
    return this.api.patch(`/events/${id}`, dto);
  }

  deleteEvent(id: string): Observable<void> {
    return this.api.delete(`/events/${id}`);
  }

  setRsvp(id: string, status: EventRsvpStatus): Observable<CyclingEvent> {
    return this.api.post(`/events/${id}/rsvp`, { status });
  }

  listRsvps(
    id: string,
  ): Observable<{ userId: string; displayName: string; status: EventRsvpStatus }[]> {
    return this.api.get(`/events/${id}/rsvps`);
  }

  listComments(id: string): Observable<EventComment[]> {
    return this.api.get(`/events/${id}/comments`);
  }

  addComment(id: string, body: string): Observable<EventComment> {
    return this.api.post(`/events/${id}/comments`, { body });
  }

  deleteComment(id: string, commentId: string): Observable<void> {
    return this.api.delete(`/events/${id}/comments/${commentId}`);
  }
}

export interface EventComment {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  canDelete: boolean;
  createdAt: string;
}
