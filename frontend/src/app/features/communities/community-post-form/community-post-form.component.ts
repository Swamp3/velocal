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
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RichTextComponent } from '@shared/components';
import { ButtonComponent, InputComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-post-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    InputComponent,
    SkeletonComponent,
    RichTextComponent,
  ],
  templateUrl: './community-post-form.component.html',
})
export class CommunityPostFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly loaded = signal(false);
  protected readonly communitySlug = signal('');
  protected readonly subgroupSlug = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    body: ['', Validators.required],
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    if (!communitySlug) {
      void this.router.navigateByUrl('/communities');
      return;
    }
    this.communitySlug.set(communitySlug);
    this.subgroupSlug.set(subgroupSlug);

    if (subgroupSlug) {
      this.communityService
        .getSubgroup(communitySlug, subgroupSlug)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (subgroup) => {
            if (!subgroup.myRole && !subgroup.viewerIsCommunityAdmin) {
              void this.router.navigate(this.listLink());
              return;
            }
            this.loaded.set(true);
          },
          error: () => void this.router.navigate(['/communities', communitySlug]),
        });
      return;
    }

    this.communityService
      .getBySlug(communitySlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          if (!community.myRole) {
            void this.router.navigate(this.listLink());
            return;
          }
          this.loaded.set(true);
        },
        error: () => void this.router.navigateByUrl('/communities'),
      });
  }

  protected listLink(): string[] {
    const subgroupSlug = this.subgroupSlug();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, 'posts']
      : ['/communities', this.communitySlug(), 'posts'];
  }

  protected titleError(): string {
    const control = this.form.controls.title;
    if (!control.touched || control.valid) return '';
    return this.transloco.translate('validation.required');
  }

  protected publish(): void {
    const title = this.form.controls.title.value.trim();
    const body = this.form.controls.body.value;
    if (!title || !body || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.communityService
      .createPost(this.communitySlug(), { title, body }, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.toast.success(this.transloco.translate('communities.posts.published'));
          const subgroupSlug = this.subgroupSlug();
          const commands = subgroupSlug
            ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, 'posts', post.id]
            : ['/communities', this.communitySlug(), 'posts', post.id];
          void this.router.navigate(commands);
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }
}
