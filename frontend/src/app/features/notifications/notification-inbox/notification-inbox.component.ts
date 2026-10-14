import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SeoService } from '@core/services/seo.service';
import { AppNotification, NotificationService } from '@core/services/notification.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonComponent, SkeletonComponent } from '@shared/ui';

@Component({
  selector: 'app-notification-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslocoPipe, ButtonComponent, SkeletonComponent],
  templateUrl: './notification-inbox.component.html',
})
export class NotificationInboxComponent implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  protected readonly rows = signal<AppNotification[] | null>(null);
  protected readonly markingAll = signal(false);

  ngOnInit(): void {
    this.seo.setMeta({
      title: this.transloco.translate('notifications.title'),
      description: '',
      noindex: true,
    });
    this.load();
  }

  protected textKey(row: AppNotification): string {
    if (row.type === 'join.decision') {
      const rejected = row.payload.decision === 'rejected';
      if (row.payload.subgroupName) {
        return rejected
          ? 'notifications.decisionSubgroupRejected'
          : 'notifications.decisionSubgroupApproved';
      }
      return rejected ? 'notifications.decisionRejected' : 'notifications.decisionApproved';
    }
    if (row.type === 'join.request') {
      return row.payload.subgroupSlug
        ? 'notifications.joinSubgroup'
        : 'notifications.joinCommunity';
    }
    if (row.type === 'event.invite') return 'notifications.eventInvite';
    return 'notifications.eventCreated';
  }

  protected open(row: AppNotification): void {
    const go = () => void this.router.navigateByUrl(this.target(row));
    if (row.readAt) {
      go();
      return;
    }
    this.notifications.markRead(row.id).subscribe({ next: go, error: go });
  }

  protected markAll(): void {
    this.markingAll.set(true);
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.markingAll.set(false);
        this.rows.update((rows) =>
          (rows ?? []).map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })),
        );
      },
      error: () => this.markingAll.set(false),
    });
  }

  private load(): void {
    this.notifications.list().subscribe({
      next: (rows) => this.rows.set(rows),
      error: () => this.rows.set([]),
    });
  }

  private target(row: AppNotification): string {
    if (row.type === 'event.created' || row.type === 'event.invite') {
      return row.payload.eventId ? `/events/${row.payload.eventId}` : '/notifications';
    }
    const community = `/communities/${row.payload.communitySlug}`;
    if (row.type === 'join.request') {
      return row.payload.subgroupSlug
        ? `${community}/subgroups/${row.payload.subgroupSlug}/requests`
        : `${community}/requests`;
    }
    return row.payload.subgroupSlug
      ? `${community}/subgroups/${row.payload.subgroupSlug}`
      : community;
  }
}
