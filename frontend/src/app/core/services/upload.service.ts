import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@core/tokens/api-base-url';
import { CyclingEvent, Post, RaceSeries } from '@shared/models';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Every uploadable subject lives at
 *   POST   {API_BASE}/{subject}/:id/image   (multipart, field name `file`)
 *   DELETE {API_BASE}/{subject}/:id/image
 * so we only need one pair of generic helpers. The server re-encodes the image
 * into variants and returns the owning entity with its `imageUrl` populated
 * (already cache-busted via `?v=` query arg).
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  uploadEventImage(id: string, file: File): Observable<CyclingEvent> {
    return this.upload<CyclingEvent>('/events', id, file);
  }

  deleteEventImage(id: string): Observable<CyclingEvent> {
    return this.delete<CyclingEvent>('/events', id);
  }

  uploadSeriesImage(id: string, file: File): Observable<RaceSeries> {
    return this.upload<RaceSeries>('/series', id, file);
  }

  deleteSeriesImage(id: string): Observable<RaceSeries> {
    return this.delete<RaceSeries>('/series', id);
  }

  uploadPostImage(id: string, file: File): Observable<Post> {
    return this.upload<Post>('/posts', id, file);
  }

  deletePostImage(id: string): Observable<Post> {
    return this.delete<Post>('/posts', id);
  }

  private upload<T>(subject: string, id: string, file: File): Observable<T> {
    const form = new FormData();
    form.append('file', file, file.name);
    // Do not set `Content-Type` manually — HttpClient needs to generate the
    // multipart boundary itself.
    return this.http
      .post<T>(`${this.base}${subject}/${id}/image`, form)
      .pipe(catchError((err: HttpErrorResponse) => this.toError(err)));
  }

  private delete<T>(subject: string, id: string): Observable<T> {
    return this.http
      .delete<T>(`${this.base}${subject}/${id}/image`)
      .pipe(catchError((err: HttpErrorResponse) => this.toError(err)));
  }

  private toError(err: HttpErrorResponse): Observable<never> {
    return throwError(() => ({
      status: err.status,
      message: err.error?.message ?? err.statusText ?? 'Upload failed',
    }));
  }
}
