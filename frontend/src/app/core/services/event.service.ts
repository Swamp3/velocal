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
import { EventInviteResult } from './notification.service';

/** Community context a shared public event is viewed in. */
export interface EventHostContext {
  community?: string;
  subgroup?: string;
}

function hostQuery(ctx?: EventHostContext): string {
  if (!ctx?.community) return '';
  const params = new URLSearchParams({ community: ctx.community });
  if (ctx.subgroup) params.set('subgroup', ctx.subgroup);
  return `?${params.toString()}`;
}

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

  getEvent(id: string, ctx?: EventHostContext): Observable<CyclingEvent> {
    return this.api.get(`/events/${id}${hostQuery(ctx)}`);
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

  invite(id: string, email: string): Observable<EventInviteResult> {
    return this.api.post(`/events/${id}/invites`, { email });
  }

  setRsvp(id: string, status: EventRsvpStatus, ctx?: EventHostContext): Observable<CyclingEvent> {
    return this.api.post(`/events/${id}/rsvp${hostQuery(ctx)}`, { status });
  }

  listRsvps(
    id: string,
    ctx?: EventHostContext,
  ): Observable<{ userId: string; displayName: string; status: EventRsvpStatus }[]> {
    return this.api.get(`/events/${id}/rsvps${hostQuery(ctx)}`);
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
