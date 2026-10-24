import { inject, Injectable } from '@angular/core';
import { CyclingEvent, User } from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

import type { RiderGender, RiderLicense } from '@shared/models';

export interface UpdateProfileDto {
  displayName?: string;
  homeZip?: string;
  homeCountry?: string;
  preferredLanguage?: string;
  preferredLocale?: string;
  birthYear?: number | null;
  gender?: RiderGender | null;
  licenseType?: RiderLicense | null;
}

export interface MyUpcomingEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  locationName: string;
  cancelled: boolean;
  disciplineSlug: string;
  myRsvp: 'going' | 'maybe';
  community: { slug: string; name: string } | null;
  subgroup: { slug: string; name: string } | null;
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

  deleteAccount(dto: {
    password?: string;
    confirmEmail: string;
    deleteContent: boolean;
  }): Observable<void> {
    return this.api.delete<void>('/users/me', dto);
  }

  getUpcomingEvents(): Observable<MyUpcomingEvent[]> {
    return this.api.get<MyUpcomingEvent[]>('/users/me/upcoming-events');
  }

  getDisciplinePrefs(): Observable<string[]> {
    return this.api.get<string[]>('/users/me/discipline-prefs');
  }

  setDisciplinePrefs(slugs: string[]): Observable<string[]> {
    return this.api.put<string[]>('/users/me/discipline-prefs', {
      disciplineSlugs: slugs,
    });
  }

  getFavorites(page = 1, limit = 10): Observable<{ data: FavoriteEntry[]; total: number }> {
    return this.api.get('/users/me/favorites', { page, limit });
  }
}
