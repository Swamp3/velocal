import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService, ImportJob, ImportJobStatus } from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { BadgeComponent, BadgeVariant, ButtonComponent, SkeletonComponent } from '@shared/ui';
import { interval, switchMap } from 'rxjs';

const STATUS_VARIANT: Record<ImportJobStatus, BadgeVariant> = {
  running: 'warning',
  completed: 'success',
  failed: 'danger',
};

@Component({
  selector: 'app-import-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, BadgeComponent, ButtonComponent, SkeletonComponent, DatePipe],
  templateUrl: './import-status.component.html',
})
export class ImportStatusComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly jobs = signal<ImportJob[]>([]);
  protected readonly sources = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly triggering = signal(false);
  protected readonly expandedErrors = signal<Set<string>>(new Set());

  protected readonly hasRunningJob = computed(() =>
    this.jobs().some((j) => j.status === 'running'),
  );

  ngOnInit(): void {
    this.loadJobs();
    this.loadSources();

    interval(10_000)
      .pipe(
        switchMap(() => this.admin.getImportJobs()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((jobs) => this.jobs.set(jobs));
  }

  protected statusVariant(status: ImportJobStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }

  protected duration(job: ImportJob): string | null {
    if (!job.finishedAt) return null;
    const ms = new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  protected totalEvents(job: ImportJob): number {
    if (!job.result) return 0;
    return job.result.created + job.result.updated + job.result.skipped;
  }

  protected toggleError(jobId: string): void {
    this.expandedErrors.update((set) => {
      const next = new Set(set);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  protected isErrorExpanded(jobId: string): boolean {
    return this.expandedErrors().has(jobId);
  }

  protected triggerImport(source?: string): void {
    this.triggering.set(true);
    this.admin.triggerImport(source).subscribe({
      next: (job) => {
        this.jobs.update((jobs) => [job, ...jobs]);
        this.triggering.set(false);
      },
      error: () => this.triggering.set(false),
    });
  }

  private loadJobs(): void {
    this.admin.getImportJobs().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSources(): void {
    this.admin.getImportSources().subscribe({
      next: (sources) => this.sources.set(sources),
    });
  }
}
