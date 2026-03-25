import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CyclingEvent, User } from '@shared/models';

export interface UpdateProfileDto {
  displayName?: string;
  homeZip?: string;
  homeCountry?: string;
  preferredLocale?: string;
}

export interface FavoriteEntry {
  id: string;
  eventId: string;
  event: CyclingEvent;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  updateProfile(dto: UpdateProfileDto): Observable<User> {
    return this.api.patch<User>('/users/me', dto);
  }

  getDisciplinePrefs(): Observable<string[]> {
    return this.api.get<string[]>('/users/me/discipline-prefs');
  }

  setDisciplinePrefs(slugs: string[]): Observable<string[]> {
    return this.api.put<string[]>('/users/me/discipline-prefs', {
      disciplineSlugs: slugs,
    });
  }

  getFavorites(
    page = 1,
    limit = 10,
  ): Observable<{ data: FavoriteEntry[]; total: number }> {
    return this.api.get('/users/me/favorites', { page, limit });
  }
}
