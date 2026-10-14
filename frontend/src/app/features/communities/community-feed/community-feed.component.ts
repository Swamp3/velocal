import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityPost } from '@shared/models';
import { ButtonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TranslocoPipe, ButtonComponent],
  templateUrl: './community-feed.component.html',
})
export class CommunityFeedComponent implements OnInit {
  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<CommunityPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly publishing = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    body: ['', Validators.required],
  });

  ngOnInit(): void {
    this.communityService
      .listPosts(this.communitySlug(), this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          this.posts.set(posts);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected postLink(postId: string): string[] {
    const subgroupSlug = this.subgroupSlug();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, 'posts', postId]
      : ['/communities', this.communitySlug(), 'posts', postId];
  }

  protected authorName(name: string | null): string {
    return name ?? this.transloco.translate('communities.members.unnamed');
  }

  protected publish(): void {
    const body = this.form.controls.body.value.trim();
    if (!body || this.publishing()) return;
    this.publishing.set(true);
    this.communityService
      .createPost(this.communitySlug(), body, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.posts.update((posts) => [post, ...posts]);
          this.form.reset();
          this.publishing.set(false);
        },
        error: (err: ApiError) => {
          this.publishing.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }
}
