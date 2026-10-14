import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityCardComponent, EmptyStateComponent } from '@shared/components';
import { Community } from '@shared/models';
import { PaginationComponent, SkeletonComponent, ToastService } from '@shared/ui';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

@Component({
  selector: 'app-community-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    PaginationComponent,
    SkeletonComponent,
    CommunityCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './community-list.component.html',
})
export class CommunityListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly searchQuery = signal('');
  protected readonly page = signal(1);
  protected readonly limit = signal(20);
  protected readonly communities = signal<Community[]>([]);
  protected readonly mine = signal<Community[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit())),
  );
  protected readonly showMine = computed(
    () => this.auth.isAuthenticated() && this.mine().length > 0,
  );

  private readonly search$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  constructor() {
    effect((onCleanup) => {
      if (!this.auth.isAuthenticated()) {
        this.mine.set([]);
        return;
      }

      const sub = this.communityService.mine().subscribe({
        next: (rows) => this.mine.set(rows),
        error: () => this.mine.set([]),
      });
      onCleanup(() => sub.unsubscribe());
    });

    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.searchQuery.set(q);
        this.page.set(1);
        this.syncUrlAndFetch();
      });
  }

  ngOnInit(): void {
    this.search$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.communityService.list(this.buildParams()).pipe(
            catchError((err: ApiError) => {
              this.loading.set(false);
              if (err.status < 500 && err.status !== 0) {
                this.toast.error(this.transloco.translate('communities.errors.generic'));
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.communities.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      });

    this.readUrlParams();
  }

  protected onSearchInput(event: Event): void {
    this.searchInput$.next((event.target as HTMLInputElement).value);
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.syncUrlAndFetch();
  }

  private readUrlParams(): void {
    const params = this.route.snapshot.queryParams;
    this.searchQuery.set(params['q'] ?? '');
    this.page.set(params['page'] ? +params['page'] : 1);
    this.search$.next();
  }

  private syncUrlAndFetch(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery() || undefined,
        page: this.page() > 1 ? String(this.page()) : undefined,
      },
      replaceUrl: true,
    });
    this.search$.next();
  }

  private buildParams(): { q?: string; page: number; limit: number } {
    return {
      q: this.searchQuery() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
  }
}
