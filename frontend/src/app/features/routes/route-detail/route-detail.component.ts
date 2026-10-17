import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RouteService } from '@core/services/route.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmptyStateComponent } from '@shared/components';
import { formatDistance, Route } from '@shared/models';
import { ButtonComponent, SkeletonComponent, ToastService, IconButtonComponent } from '@shared/ui';
import { concat, last, Observable } from 'rxjs';

/** Tells the user why a GPX upload was refused instead of a bare "something went wrong". */
function uploadErrorKey(err: HttpErrorResponse): string {
  const message = typeof err.error?.message === 'string' ? err.error.message : '';
  if (err.status === 413 || message === 'GPX file is too large') return 'routes.errorTooLarge';
  if (message === 'This is not a GPX file') return 'routes.errorNotGpx';
  if (message === 'The GPX file contains no track') return 'routes.errorNoTrack';
  if (message === 'Too many files for one route') return 'routes.errorTooMany';
  if (err.status === 429) return 'routes.errorRateLimit';
  if (err.status === 0) return 'routes.errorNetwork';
  return 'routes.error';
}

/** Status and server text for errors we have no specific message for, so a report says what happened. */
function uploadErrorDetail(err: HttpErrorResponse): string {
  if (uploadErrorKey(err) !== 'routes.error') return '';
  const text = typeof err.error?.message === 'string' ? `: ${err.error.message.slice(0, 120)}` : '';
  return ` (HTTP ${err.status}${text})`;
}

@Component({
  selector: 'app-route-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconButtonComponent,
    RouterLink,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './route-detail.component.html',
})
export class RouteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeService = inject(RouteService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly data = signal<Route | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });
  protected readonly distance = formatDistance;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.routeService.get(id).subscribe({
      next: (data) => {
        this.apply(data);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    const data = this.data();
    if (!data || this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const { name, description } = this.form.getRawValue();
    this.routeService
      .update(data.id, { name: name.trim(), description: description.trim() || null })
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.apply(updated);
          this.toast.success(this.transloco.translate('routes.saved'));
        },
        error: () => this.fail(),
      });
  }

  /** Several GPX files can be picked at once; they upload one after another. */
  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const data = this.data();
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!data || files.length === 0 || this.busy()) return;
    this.busy.set(true);
    const uploads: Observable<Route>[] = files.map((file) =>
      this.routeService.addFile(data.id, file),
    );
    concat(...uploads)
      .pipe(last())
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.apply(updated);
        },
        error: (err: HttpErrorResponse) => {
          this.fail(uploadErrorKey(err), uploadErrorDetail(err));
          this.routeService.get(data.id).subscribe((fresh) => this.apply(fresh));
        },
      });
  }

  protected removeFile(fileId: string): void {
    const data = this.data();
    if (!data || this.busy()) return;
    this.busy.set(true);
    this.routeService.removeFile(data.id, fileId).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.apply(updated);
      },
      error: () => this.fail(),
    });
  }

  protected download(fileId: string, label: string): void {
    const data = this.data();
    if (data) this.routeService.download(data.id, fileId, label);
  }

  protected deleteRoute(): void {
    const data = this.data();
    if (!data || this.busy()) return;
    if (!window.confirm(this.transloco.translate('routes.deleteConfirm'))) return;
    this.busy.set(true);
    this.routeService.remove(data.id).subscribe({
      next: () => void this.router.navigate(['/routes']),
      error: () => this.fail(),
    });
  }

  private apply(data: Route): void {
    this.data.set(data);
    this.form.patchValue({ name: data.name, description: data.description ?? '' });
  }

  private fail(key = 'routes.error', detail = ''): void {
    this.busy.set(false);
    this.toast.error(this.transloco.translate(key) + detail);
  }
}
