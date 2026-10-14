import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityService } from '@core/services/community.service';
import { UploadService } from '@core/services/upload.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ImageUploadComponent } from '@shared/components';
import { SubgroupVisibility } from '@shared/models';
import { ButtonComponent, InputComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-subgroup-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    InputComponent,
    SkeletonComponent,
    ImageUploadComponent,
  ],
  templateUrl: './subgroup-form.component.html',
})
export class SubgroupFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly communityService = inject(CommunityService);
  private readonly uploadService = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly isEdit = signal(false);
  protected readonly loaded = signal(false);
  protected readonly communitySlug = signal('');
  protected readonly subgroupSlug = signal('');
  protected readonly heroUrl = signal<string | null>(null);
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly visibilities: readonly SubgroupVisibility[] = ['open', 'request', 'invite'];
  protected readonly canChangeVisibility = signal(true);

  protected readonly uploadHeroFn = (file: File): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .uploadSubgroupHero(this.communitySlug(), this.subgroupSlug(), file)
      .pipe(map((subgroup) => ({ imageUrl: subgroup.heroUrl })));

  protected readonly deleteHeroFn = (): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .deleteSubgroupHero(this.communitySlug(), this.subgroupSlug())
      .pipe(map((subgroup) => ({ imageUrl: subgroup.heroUrl })));

  protected readonly uploadLogoFn = (file: File): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .uploadSubgroupLogo(this.communitySlug(), this.subgroupSlug(), file)
      .pipe(map((subgroup) => ({ imageUrl: subgroup.logoUrl })));

  protected readonly deleteLogoFn = (): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .deleteSubgroupLogo(this.communitySlug(), this.subgroupSlug())
      .pipe(map((subgroup) => ({ imageUrl: subgroup.logoUrl })));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    visibility: this.fb.nonNullable.control<SubgroupVisibility>('open', Validators.required),
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug') ?? '';
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    this.communitySlug.set(communitySlug);
    if (!subgroupSlug) {
      this.loaded.set(true);
      return;
    }

    this.isEdit.set(true);
    this.communityService
      .getSubgroup(communitySlug, subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subgroup) => {
          const canEdit = subgroup.viewerIsCommunityAdmin || subgroup.myRole === 'moderator';
          if (!canEdit) {
            void this.router.navigate(['/communities', communitySlug, 'subgroups', subgroup.slug]);
            return;
          }
          this.subgroupSlug.set(subgroup.slug);
          this.canChangeVisibility.set(subgroup.viewerIsCommunityAdmin);
          this.heroUrl.set(subgroup.heroUrl);
          this.logoUrl.set(subgroup.logoUrl);
          this.form.patchValue({
            name: subgroup.name,
            description: subgroup.description ?? '',
            visibility: subgroup.visibility,
          });
          this.loaded.set(true);
        },
        error: () => {
          void this.router.navigate(['/communities', communitySlug]);
        },
      });
  }

  protected onSubmit(): void {
    const raw = this.form.getRawValue();
    if (this.form.invalid || !raw.name.trim()) {
      this.form.controls.name.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const description = raw.description.trim();
    const communitySlug = this.communitySlug();
    const visibility = this.canChangeVisibility() ? raw.visibility : undefined;
    const request$ = this.isEdit()
      ? this.communityService.updateSubgroup(communitySlug, this.subgroupSlug(), {
          name: raw.name.trim(),
          description: description || null,
          ...(visibility ? { visibility } : {}),
        })
      : this.communityService.createSubgroup(communitySlug, {
          name: raw.name.trim(),
          description: description || undefined,
          visibility: raw.visibility,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subgroup) => {
        this.toast.success(this.transloco.translate('communities.subgroups.saved'));
        const commands = this.isEdit()
          ? ['/communities', communitySlug, 'subgroups', subgroup.slug]
          : ['/communities', communitySlug, 'subgroups', subgroup.slug, 'edit'];
        void this.router.navigate(commands);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.transloco.translate('communities.errors.generic'));
      },
    });
  }

  protected fieldError(): string {
    const ctrl = this.form.controls.name;
    if (!ctrl.touched || ctrl.valid) return '';
    return this.transloco.translate('validation.required');
  }
}
