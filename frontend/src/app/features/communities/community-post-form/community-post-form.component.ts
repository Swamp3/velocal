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
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RichTextComponent } from '@shared/components';
import { InputComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

import { FormActionsComponent } from '@shared/components/form-actions/form-actions.component';

@Component({
  selector: 'app-community-post-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormActionsComponent,
    ReactiveFormsModule,
    TranslocoPipe,
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
  /** Set on the edit route; the form then updates this post instead of creating one. */
  protected readonly postId = signal<string | null>(null);
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
    this.postId.set(this.route.snapshot.paramMap.get('postId'));

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
            this.loadPostThenShow();
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
          this.loadPostThenShow();
        },
        error: () => void this.router.navigateByUrl('/communities'),
      });
  }

  /** On the edit route, load the post (author only) before showing the form. */
  private loadPostThenShow(): void {
    const postId = this.postId();
    if (!postId) {
      this.loaded.set(true);
      return;
    }
    this.communityService
      .getPost(this.communitySlug(), postId, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          if (!post.canEdit) {
            void this.router.navigate(this.postLink(postId));
            return;
          }
          this.form.setValue({ title: post.title, body: post.body });
          this.loaded.set(true);
        },
        error: () => void this.router.navigate(this.listLink()),
      });
  }

  protected postLink(postId: string): string[] {
    const subgroupSlug = this.subgroupSlug();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, 'posts', postId]
      : ['/communities', this.communitySlug(), 'posts', postId];
  }

  protected backLink(): string[] {
    const postId = this.postId();
    return postId ? this.postLink(postId) : this.listLink();
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
    const postId = this.postId();
    const request$ = postId
      ? this.communityService.updatePost(
          this.communitySlug(),
          postId,
          { title, body },
          this.subgroupSlug(),
        )
      : this.communityService.createPost(
          this.communitySlug(),
          { title, body },
          this.subgroupSlug(),
        );
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (post) => {
        const key = postId ? 'communities.posts.updated' : 'communities.posts.published';
        this.toast.success(this.transloco.translate(key));
        void this.router.navigate(this.postLink(post.id));
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.toast.error(this.transloco.translate(communityErrorKey(err)));
      },
    });
  }
}
