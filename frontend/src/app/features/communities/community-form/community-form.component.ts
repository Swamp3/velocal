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
import {
  ConfirmDeleteDialogComponent,
  ImageUploadComponent,
  RichTextComponent,
} from '@shared/components';
import { CommunityVisibility } from '@shared/models';
import { ButtonComponent, InputComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-community-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    InputComponent,
    SkeletonComponent,
    ImageUploadComponent,
    RichTextComponent,
    ConfirmDeleteDialogComponent,
  ],
  templateUrl: './community-form.component.html',
})
export class CommunityFormComponent implements OnInit {
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
  protected readonly slug = signal('');
  protected readonly communityId = signal('');
  protected readonly communityName = signal('');
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly heroUrl = signal<string | null>(null);
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly visibilities: readonly CommunityVisibility[] = [
    'public',
    'request',
    'private',
  ];

  protected readonly uploadHeroFn = (file: File): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .uploadCommunityHero(this.communityId(), file)
      .pipe(map((community) => ({ imageUrl: community.heroUrl })));

  protected readonly deleteHeroFn = (): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .deleteCommunityHero(this.communityId())
      .pipe(map((community) => ({ imageUrl: community.heroUrl })));

  protected readonly uploadLogoFn = (file: File): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .uploadCommunityLogo(this.communityId(), file)
      .pipe(map((community) => ({ imageUrl: community.logoUrl })));

  protected readonly deleteLogoFn = (): Observable<{ imageUrl?: string | null }> =>
    this.uploadService
      .deleteCommunityLogo(this.communityId())
      .pipe(map((community) => ({ imageUrl: community.logoUrl })));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    location: [''],
    stravaUrl: ['', Validators.pattern(/^(https:\/\/(www\.)?strava\.com\/.+)?$/i)],
    visibility: this.fb.nonNullable.control<CommunityVisibility>('public', Validators.required),
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;

    this.isEdit.set(true);
    this.communityService
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          if (community.myRole !== 'admin') {
            void this.router.navigate(['/communities', community.slug]);
            return;
          }
          this.communityId.set(community.id);
          this.slug.set(community.slug);
          this.communityName.set(community.name);
          this.heroUrl.set(community.heroUrl);
          this.logoUrl.set(community.logoUrl);
          this.form.patchValue({
            name: community.name,
            description: community.description ?? '',
            location: community.location ?? '',
            stravaUrl: community.stravaUrl ?? '',
            visibility: community.visibility,
          });
          this.loaded.set(true);
        },
        error: () => {
          void this.router.navigateByUrl('/communities');
        },
      });
  }

  protected deleteCommunity(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.communityService
      .deleteCommunity(this.communityId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('communities.deleted'));
          void this.router.navigateByUrl('/communities');
        },
        error: () => {
          this.deleting.set(false);
          this.toast.error(this.transloco.translate('communities.deleteError'));
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
    if (this.isEdit() && !this.communityId()) return;

    this.saving.set(true);
    const description = raw.description.trim();
    const location = raw.location.trim();
    const stravaUrl = raw.stravaUrl.trim();
    const request$ = this.isEdit()
      ? this.communityService.update(this.communityId(), {
          name: raw.name.trim(),
          description: description || null,
          location: location || null,
          stravaUrl: stravaUrl || null,
          visibility: raw.visibility,
        })
      : this.communityService.create({
          name: raw.name.trim(),
          description: description || undefined,
          location: location || undefined,
          stravaUrl: stravaUrl || undefined,
          visibility: raw.visibility,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (community) => {
        this.toast.success(this.transloco.translate('communities.saved'));
        const commands = this.isEdit()
          ? ['/communities', community.slug]
          : ['/communities', community.slug, 'edit'];
        void this.router.navigate(commands);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.transloco.translate('communities.saveFailed'));
      },
    });
  }

  protected fieldError(name: 'name'): string {
    const ctrl = this.form.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return this.transloco.translate('validation.required');
    return '';
  }
}
