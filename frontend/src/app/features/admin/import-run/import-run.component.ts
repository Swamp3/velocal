import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminService, ImportJob, ImportReport } from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { SkeletonComponent } from '@shared/ui';
import { forkJoin } from 'rxjs';
import { ImportReportComponent } from '../import-report/import-report.component';

/** Admin page: the report of one import run. */
@Component({
  selector: 'app-import-run',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DatePipe, RouterLink, SkeletonComponent, ImportReportComponent],
  template: `
    <a
      routerLink="/admin/imports"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
    >
      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
      {{ 'admin.imports.title' | transloco }}
    </a>
    @if (loading()) {
      <ui-skeleton class="mt-6 block h-40 w-full" />
    } @else if (job(); as j) {
      <h1 class="mt-4 text-2xl font-bold text-[var(--color-text)]">
        {{ j.fileName ?? j.source ?? ('admin.imports.allSources' | transloco) }}
      </h1>
      <p class="mt-1 text-sm text-[var(--color-text-muted)]">
        {{ j.startedAt | date: 'medium' }} · {{ j.triggeredBy ?? '—' }} ·
        {{ 'admin.imports.status.' + j.status | transloco }}
      </p>
      <div class="mt-6">
        @if (report(); as r) {
          <app-import-report [report]="r" />
        } @else {
          <p class="text-sm text-[var(--color-text-muted)]">{{ 'admin.imports.report.missing' | transloco }}</p>
        }
      </div>
    } @else {
      <p class="mt-6 text-sm text-[var(--color-text-muted)]">{{ 'admin.imports.report.notFound' | transloco }}</p>
    }
  `,
})
export class ImportRunComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly job = signal<ImportJob | null>(null);
  protected readonly report = signal<ImportReport | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    forkJoin([this.admin.getImportJob(id), this.admin.getImportReport(id)]).subscribe({
      next: ([job, { report }]) => {
        this.job.set(job);
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
