import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PostService } from '@core/services/post.service';
import { AuthService } from '@core/services/auth.service';
import { Post } from '@shared/models';
import { ButtonComponent, ChipComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { EmptyStateComponent } from '@shared/components';

@Component({
  selector: 'app-news-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    ButtonComponent,
    ChipComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './news-detail.component.html',
})
export class NewsDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postService = inject(PostService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly post = signal<Post | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly deleteLoading = signal(false);
  protected readonly renderedBody = signal<SafeHtml>('');

  protected readonly isAdmin = computed(() => !!this.auth.currentUser()?.isAdmin);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.loadPost(slug);
  }

  protected deletePost(): void {
    const p = this.post();
    if (!p) return;

    const msg = this.transloco.translate('news.deleteConfirm');
    if (!confirm(msg)) return;

    this.deleteLoading.set(true);
    this.postService.deletePost(p.id).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('news.delete'));
        this.router.navigate(['/news']);
      },
      error: () => this.deleteLoading.set(false),
    });
  }

  private loadPost(slug: string): void {
    this.postService.getPost(slug).subscribe({
      next: (post) => {
        this.post.set(post);
        this.renderedBody.set(this.sanitizer.bypassSecurityTrustHtml(post.body));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
