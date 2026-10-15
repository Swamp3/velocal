import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export type NotificationType = 'event.created' | 'event.invite' | 'join.request' | 'join.decision';

export interface AppNotification {
  id: string;
  type: NotificationType;
  payload: {
    communityName: string;
    communitySlug: string;
    subgroupName?: string;
    subgroupSlug?: string;
    eventId?: string;
    eventName?: string;
    actorName?: string;
    decision?: 'approved' | 'rejected';
  };
  readAt: string | null;
  createdAt: string;
}

export interface EventInviteResult {
  outcome: 'invited' | 'already' | 'self';
  emailed: boolean;
  emailSkipped: 'unverified' | 'cap' | 'disabled' | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  readonly unread = signal(0);

  refreshUnread(): void {
    this.api.get<{ count: number }>('/notifications/unread-count').subscribe({
      next: (body) => this.unread.set(body.count),
      error: () => this.unread.set(0),
    });
  }

  list(): Observable<AppNotification[]> {
    return this.api.get<AppNotification[]>('/notifications');
  }

  markRead(id: string): Observable<void> {
    return this.api
      .post<void>(`/notifications/${id}/read`, {})
      .pipe(tap(() => this.unread.update((count) => Math.max(0, count - 1))));
  }

  /** Deletes one notification; `wasUnread` keeps the bell badge in step. */
  remove(id: string, wasUnread: boolean): Observable<void> {
    return this.api
      .delete<void>(`/notifications/${id}`)
      .pipe(tap(() => wasUnread && this.unread.update((count) => Math.max(0, count - 1))));
  }

  removeAll(): Observable<void> {
    return this.api.delete<void>('/notifications').pipe(tap(() => this.unread.set(0)));
  }

  markAllRead(): Observable<void> {
    return this.api.post<void>('/notifications/read', {}).pipe(tap(() => this.unread.set(0)));
  }
}
