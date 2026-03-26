import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PostService, PostSearchParams } from '@core/services/post.service';
import { AuthService } from '@core/services/auth.service';
import { PostListItem } from '@shared/models';
import { ButtonComponent, PaginationComponent, SkeletonComponent } from '@shared/ui';
import { EmptyStateComponent, NewsCardComponent } from '@shared/components';

@Component({
  selector: 'app-news-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    PaginationComponent,
    SkeletonComponent,
    EmptyStateComponent,
    NewsCardComponent,
  ],
  templateUrl: './news-list.component.html',
})
export class NewsListComponent implements OnInit {
  private readonly postService = inject(PostService);
  protected readonly auth = inject(AuthService);

  protected readonly posts = signal<PostListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 12;
  protected readonly loading = signal(true);
  protected readonly tags = signal<string[]>([]);
  protected readonly activeTag = signal<string | null>(null);

  protected readonly isAdmin = computed(() => !!this.auth.currentUser()?.isAdmin);
  protected readonly totalPages = computed(() => Math.ceil(this.total() / this.limit));
  protected readonly pinnedPosts = computed(() => this.posts().filter((p) => p.isPinned));
  protected readonly unpinnedPosts = computed(() => this.posts().filter((p) => !p.isPinned));

  ngOnInit(): void {
    this.loadTags();
    this.loadPosts();
  }

  protected onTagClick(tag: string): void {
    this.activeTag.set(this.activeTag() === tag ? null : tag);
    this.page.set(1);
    this.loadPosts();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.loadPosts();
  }

  private loadPosts(): void {
    this.loading.set(true);
    const params: PostSearchParams = {
      page: this.page(),
      limit: this.limit,
    };
    const tag = this.activeTag();
    if (tag) params.tag = tag;

    this.postService.getPosts(params).subscribe({
      next: (res) => {
        this.posts.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTags(): void {
    this.postService.getTags().subscribe({
      next: (tags) => this.tags.set(tags),
    });
  }
}
