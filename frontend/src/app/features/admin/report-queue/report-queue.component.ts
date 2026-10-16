import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminReport, AdminService, ReportStatus } from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BadgeComponent, ButtonComponent, PaginationComponent, SegmentedComponent, SegmentedOption, SkeletonComponent, ToastService } from '@shared/ui';

/** Reports from members, oldest first, with the quickest ways to act on them. */
@Component({
  selector: 'app-admin-report-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    TranslocoPipe,
    BadgeComponent,
    ButtonComponent,
    PaginationComponent,
    SkeletonComponent, SegmentedComponent,
  ],
  templateUrl: './report-queue.component.html',
})
export class ReportQueueComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly status = signal<ReportStatus>('open');
  protected readonly statusOptions: SegmentedOption<ReportStatus>[] = (
    ['open', 'resolved', 'dismissed'] as ReportStatus[]
  ).map((s) => ({ value: s, labelKey: 'admin.reports.status.' + s }));
  protected readonly reports = signal<AdminReport[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 20;
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected setStatus(status: ReportStatus): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected resolve(report: AdminReport, status: 'resolved' | 'dismissed'): void {
    this.act(report, this.admin.resolveReport(report.id, status));
  }

  /** Removes the reported post or comment; the report is closed by the server. */
  protected removeContent(report: AdminReport): void {
    if (!report.communityId || report.targetType === 'community') return;
    if (!window.confirm(this.transloco.translate('admin.reports.removeConfirm'))) return;
    const request$ =
      report.targetType === 'post'
        ? this.admin.deleteCommunityPost(report.communityId, report.targetId)
        : this.admin.deleteCommunityComment(report.communityId, report.targetId);
    this.act(report, request$);
  }

  private act(report: AdminReport, request$: Observable<unknown>): void {
    if (this.busyId()) return;
    this.busyId.set(report.id);
    request$.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.transloco.translate('admin.reports.done'));
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error(this.transloco.translate('admin.reports.error'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getReports(this.status(), this.page()).subscribe({
      next: (res) => {
        this.reports.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
