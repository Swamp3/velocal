import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly api = inject(ApiService);
  private readonly _favoriteIds = signal<Set<string>>(new Set());

  readonly favoriteIds = this._favoriteIds.asReadonly();

  isFavorite(eventId: string): boolean {
    return this._favoriteIds().has(eventId);
  }

  addFavorite(eventId: string): Observable<void> {
    return this.api.post<void>(`/users/me/favorites/${eventId}`, {}).pipe(
      tap(() => {
        this._favoriteIds.update((ids) => new Set([...ids, eventId]));
      }),
    );
  }

  removeFavorite(eventId: string): Observable<void> {
    return this.api.delete<void>(`/users/me/favorites/${eventId}`).pipe(
      tap(() => {
        this._favoriteIds.update((ids) => {
          const next = new Set(ids);
          next.delete(eventId);
          return next;
        });
      }),
    );
  }

  loadFavorites(): void {
    this.api
      .get<{ data: { eventId: string }[] }>('/users/me/favorites', { limit: 200 })
      .subscribe({
        next: (res) => {
          this._favoriteIds.set(new Set(res.data.map((f) => f.eventId)));
        },
        error: () => {
          // Not authenticated or failed — keep empty
        },
      });
  }
}
