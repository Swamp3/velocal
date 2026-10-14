import { DatePipe } from '@angular/common';
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
import { EmptyStateComponent } from '@shared/components';
import { CommunityComment, CommunityPost } from '@shared/models';
import { ButtonComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    TranslocoPipe,
    ButtonComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './community-post.component.html',
})
export class CommunityPostComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly post = signal<CommunityPost | null>(null);
  protected readonly comments = signal<CommunityComment[]>([]);
  protected readonly loading = signal(true);
  protected readonly missing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly communitySlug = signal('');
  protected readonly subgroupSlug = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    body: ['', Validators.required],
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug') ?? '';
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    const postId = this.route.snapshot.paramMap.get('postId');
    this.communitySlug.set(communitySlug);
    this.subgroupSlug.set(subgroupSlug);
    if (!communitySlug || !postId) {
      this.missing.set(true);
      this.loading.set(false);
      return;
    }

    this.communityService
      .getPost(communitySlug, postId, subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.post.set(post);
          this.loadComments(post.id);
        },
        error: () => {
          this.loading.set(false);
          this.missing.set(true);
        },
      });
  }

  protected backLink(): string[] {
    const subgroupSlug = this.subgroupSlug();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug]
      : ['/communities', this.communitySlug()];
  }

  protected authorName(name: string | null): string {
    return name ?? this.transloco.translate('communities.members.unnamed');
  }

  protected publishComment(): void {
    const post = this.post();
    const body = this.form.controls.body.value.trim();
    if (!post || !body || this.submitting()) return;
    this.submitting.set(true);
    this.communityService
      .addComment(this.communitySlug(), post.id, body, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comment) => {
          this.comments.update((comments) => [...comments, comment]);
          this.post.update((current) =>
            current ? { ...current, commentCount: current.commentCount + 1 } : current,
          );
          this.form.reset();
          this.submitting.set(false);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected deletePost(): void {
    const post = this.post();
    if (!post) return;
    if (!window.confirm(this.transloco.translate('communities.posts.deletePostConfirm'))) return;
    this.communityService
      .deletePost(this.communitySlug(), post.id, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(this.backLink()),
        error: (err: ApiError) => {
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected deleteComment(comment: CommunityComment): void {
    const post = this.post();
    if (!post) return;
    if (!window.confirm(this.transloco.translate('communities.posts.deleteCommentConfirm'))) {
      return;
    }
    this.communityService
      .deleteComment(this.communitySlug(), post.id, comment.id, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.comments.update((comments) => comments.filter((row) => row.id !== comment.id));
          this.post.update((current) =>
            current ? { ...current, commentCount: Math.max(0, current.commentCount - 1) } : current,
          );
        },
        error: (err: ApiError) => {
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  private loadComments(postId: string): void {
    this.communityService
      .listComments(this.communitySlug(), postId, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }
}
