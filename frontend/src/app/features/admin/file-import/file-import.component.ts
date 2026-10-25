import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { AdminService, ImportCheck, ImportJob } from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonComponent, ToastService } from '@shared/ui';
import { interval, switchMap, takeWhile } from 'rxjs';
import { ImportReportComponent } from '../import-report/import-report.component';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Admin page: choose a JSON file, check it (nothing is written), look at errors and warnings,
 * then import. Errors block the import; warnings have to be confirmed.
 */
@Component({
  selector: 'app-file-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, RouterLink, ButtonComponent, ImportReportComponent],
  templateUrl: './file-import.component.html',
})
export class FileImportComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fileName = signal<string | null>(null);
  protected readonly parseError = signal<string | null>(null);
  protected readonly checking = signal(false);
  protected readonly check = signal<ImportCheck | null>(null);
  protected readonly confirmed = signal(false);
  protected readonly importing = signal(false);
  protected readonly job = signal<ImportJob | null>(null);
  private data: unknown = null;

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.reset();
    this.fileName.set(file.name);
    if (file.size > MAX_BYTES) {
      this.parseError.set(this.transloco.translate('admin.imports.file.tooLarge'));
      return;
    }
    try {
      this.data = JSON.parse(await file.text());
    } catch (error) {
      this.parseError.set(
        this.transloco.translate('admin.imports.file.notJson', {
          detail: error instanceof Error ? error.message : '',
        }),
      );
      return;
    }
    this.runCheck();
  }

  protected runCheck(): void {
    if (this.data === null || this.checking()) return;
    this.checking.set(true);
    this.confirmed.set(false);
    this.admin
      .checkImportFile(this.data, this.fileName() ?? 'upload.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (check) => {
          this.check.set(check);
          this.checking.set(false);
        },
        error: (err: ApiError) => {
          this.checking.set(false);
          this.toast.error(err.message);
        },
      });
  }

  protected startImport(): void {
    const check = this.check();
    if (!check?.canImport || this.importing()) return;
    if (check.needsConfirmation && !this.confirmed()) return;
    this.importing.set(true);
    this.admin
      .importFile(this.data, this.fileName() ?? 'upload.json', this.confirmed())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.job.set(job);
          this.follow(job.id);
        },
        error: (err: ApiError) => {
          this.importing.set(false);
          // The server checked again and found something new: show that report.
          const report = (err.body?.['report'] ?? null) as ImportCheck['report'] | null;
          if (report) {
            this.check.set({
              report,
              canImport: report.summary.errors === 0,
              needsConfirmation: report.summary.warnings > 0,
            });
            this.confirmed.set(false);
          }
          this.toast.error(this.transloco.translate('admin.imports.file.refused'));
        },
      });
  }

  protected reset(): void {
    this.data = null;
    this.fileName.set(null);
    this.parseError.set(null);
    this.check.set(null);
    this.confirmed.set(false);
    this.job.set(null);
    this.importing.set(false);
  }

  private follow(id: string): void {
    interval(1500)
      .pipe(
        switchMap(() => this.admin.getImportJob(id)),
        takeWhile((job) => job.status === 'running', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((job) => {
        this.job.set(job);
        if (job.status === 'running') return;
        this.importing.set(false);
        if (job.status === 'completed') {
          this.toast.success(this.transloco.translate('admin.imports.file.done'));
          void this.router.navigate(['/admin/imports', job.id]);
        } else {
          this.toast.error(job.error ?? this.transloco.translate('admin.imports.status.failed'));
        }
      });
  }
}
