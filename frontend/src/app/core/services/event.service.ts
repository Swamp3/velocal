import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CyclingEvent, PaginatedResponse } from '@shared/models';

export interface EventSearchParams {
  q?: string;
  discipline?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  zip?: string;
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
}
