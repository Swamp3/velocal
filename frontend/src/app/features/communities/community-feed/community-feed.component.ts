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
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RichTextViewComponent } from '@shared/components';
import { CommunityPost } from '@shared/models';

@Component({
  selector: 'app-community-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TranslocoPipe, RichTextViewComponent],
  templateUrl: './community-feed.component.html',
})
export class CommunityFeedComponent implements OnInit {
  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string | null>(null);

  private readonly communityService = inject(CommunityService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<CommunityPost[]>([]);
  protected readonly loading = signal(true);

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
}
