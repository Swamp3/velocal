import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SeriesService } from '@core/services/series.service';
import { DisciplineService } from '@core/services/discipline.service';
import { UploadService } from '@core/services/upload.service';
import { Discipline, RaceSeriesDetail } from '@shared/models';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';
import { RichTextComponent } from '@shared/components/rich-text/rich-text.component';
import { InputComponent, ToastService } from '@shared/ui';

import { FormActionsComponent } from '@shared/components/form-actions/form-actions.component';
@Component({
  selector: 'app-series-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormActionsComponent,
    ReactiveFormsModule,
    TranslocoPipe,
    InputComponent,
    ImageUploadComponent,
    RichTextComponent,
  ],
  templateUrl: './series-form.component.html',
})
export class SeriesFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seriesService = inject(SeriesService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly uploadService = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly disciplines = signal<Discipline[]>([]);
  protected readonly isEdit = signal(false);
  protected readonly imageUrl = signal<string | null>(null);
  private editId = '';

  protected readonly uploadImageFn = (file: File) =>
    this.uploadService.uploadSeriesImage(this.editId, file);
  protected readonly deleteImageFn = () => this.uploadService.deleteSeriesImage(this.editId);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    year: [null as number | null],
    kind: ['series' as 'series' | 'cup' | 'league'],
    season: [''],
    disciplineSlug: [''],
    externalUrl: [''],
  });

  ngOnInit(): void {
    this.disciplineService
      .getDisciplines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => this.disciplines.set(d));

    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.isEdit.set(true);
      this.loading.set(true);
      this.seriesService.getSeriesBySlug(slug).subscribe({
        next: (s) => this.patchForm(s),
        error: () => this.router.navigateByUrl('/series'),
      });
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();
    const dto = {
      name: raw.name,
      description: raw.description || undefined,
      year: raw.year ?? undefined,
      kind: raw.kind,
      season: raw.season || undefined,
      disciplineSlug: raw.disciplineSlug || undefined,
      externalUrl: raw.externalUrl || undefined,
    };

    const action$ = this.isEdit()
      ? this.seriesService.updateSeries(this.editId, dto)
      : this.seriesService.createSeries(dto);

    action$.subscribe({
      next: (result) => {
        this.toast.success(this.transloco.translate('series.saved'));
        this.router.navigate(['/series', result.slug]);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.transloco.translate('series.saveFailed'));
      },
    });
  }

  protected fieldError(name: 'name'): string {
    const ctrl = this.form.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return this.transloco.translate('validation.required');
    return '';
  }

  private patchForm(s: RaceSeriesDetail): void {
    this.editId = s.id;
    this.form.patchValue({
      name: s.name,
      description: s.description ?? '',
      year: s.year ?? null,
      kind: s.kind ?? 'series',
      season: s.season ?? '',
      disciplineSlug: s.discipline?.slug ?? '',
      externalUrl: s.externalUrl ?? '',
    });
    this.imageUrl.set(s.imageUrl ?? null);
    this.loading.set(false);
  }
}
