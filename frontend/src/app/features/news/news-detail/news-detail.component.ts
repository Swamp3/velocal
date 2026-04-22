import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { PostService } from '@core/services/post.service';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmptyStateComponent } from '@shared/components';
import { Post } from '@shared/models';
import { ButtonComponent, ChipComponent, SkeletonComponent, ToastService } from '@shared/ui';

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
  private readonly seo = inject(SeoService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
        this.applySeo(post);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.seo.setMeta({ title: 'Post not found', description: '', noindex: true });
      },
    });
  }

  private applySeo(post: Post): void {
    const url = this.seo.pageUrl(`/news/${post.slug}`);
    const image = this.seo.ogImage(post.imageUrl);
    const description = this.stripHtml(post.body).slice(0, 200);

    this.seo.setMeta({
      title: post.title,
      description,
      url,
      image,
      type: 'article',
      publishedAt: post.publishedAt ?? post.createdAt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: post.title,
        description,
        datePublished: post.publishedAt ?? post.createdAt,
        author: { '@type': 'Person', name: post.author.displayName },
        publisher: {
          '@type': 'Organization',
          name: 'VeloCal',
          logo: { '@type': 'ImageObject', url: image },
        },
        image,
        ...(url ? { url, mainEntityOfPage: url } : {}),
      },
    });
  }

  /**
   * Browser: parse via DOMParser so HTML entities are decoded correctly.
   * SSR: DOMParser isn't available, use a text-only regex fallback.
   */
  private stripHtml(html: string): string {
    if (this.isBrowser && typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
