import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  PaginatedResponse,
  RaceSeries,
  RaceSeriesDetail,
} from '@shared/models';

export interface SeriesSearchParams {
  q?: string;
  discipline?: string;
  year?: number;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly api = inject(ApiService);

  getSeries(
    params: SeriesSearchParams = {},
  ): Observable<PaginatedResponse<RaceSeries>> {
    return this.api.get('/series', params as Record<string, string | number | boolean>);
  }

  getSeriesBySlug(slug: string): Observable<RaceSeriesDetail> {
    return this.api.get(`/series/${slug}`);
  }

  createSeries(dto: Partial<RaceSeries>): Observable<RaceSeries> {
    return this.api.post('/series', dto);
  }

  updateSeries(id: string, dto: Partial<RaceSeries>): Observable<RaceSeries> {
    return this.api.patch(`/series/${id}`, dto);
  }

  deleteSeries(id: string): Observable<void> {
    return this.api.delete(`/series/${id}`);
  }

  addEventToSeries(
    seriesId: string,
    dto: { eventId: string; stageNumber?: number; label?: string },
  ): Observable<void> {
    return this.api.post(`/series/${seriesId}/events`, dto);
  }

  removeEventFromSeries(seriesId: string, eventId: string): Observable<void> {
    return this.api.delete(`/series/${seriesId}/events/${eventId}`);
  }

  getSeriesForEvent(eventId: string): Observable<RaceSeries[]> {
    return this.api.get(`/series/by-event/${eventId}`);
  }
}
