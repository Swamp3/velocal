import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { SeriesService, SeriesSearchParams } from '@core/services/series.service';
import { DisciplineService } from '@core/services/discipline.service';
import { AuthService } from '@core/services/auth.service';
import { Discipline, RaceSeries } from '@shared/models';
import { PaginationComponent, SkeletonComponent } from '@shared/ui';
import { DisciplineFilterComponent, EmptyStateComponent, SeriesCardComponent } from '@shared/components';

@Component({
  selector: 'app-series-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    PaginationComponent,
    SkeletonComponent,
    DisciplineFilterComponent,
    SeriesCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './series-list.component.html',
})
export class SeriesListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seriesService = inject(SeriesService);
  private readonly disciplineService = inject(DisciplineService);
  protected readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal('');
  readonly selectedDiscipline = signal<string>('');
  readonly selectedYear = signal<number | null>(null);
  readonly page = signal(1);
  readonly limit = signal(20);

  readonly seriesList = signal<RaceSeries[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly disciplines = signal<Discipline[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));

  readonly years = computed(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);
  });

  private readonly search$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchQuery.set(q);
        this.page.set(1);
        this.syncUrlAndFetch();
      });
  }

  ngOnInit(): void {
    this.disciplineService
      .getDisciplines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => this.disciplines.set(d));

    this.search$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() => this.seriesService.getSeries(this.buildParams())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.seriesList.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.readUrlParams();
  }

  onSearchInput(event: Event): void {
    this.searchInput$.next((event.target as HTMLInputElement).value);
  }

  onDisciplineChange(slugs: string[]): void {
    this.selectedDiscipline.set(slugs[0] ?? '');
    this.page.set(1);
    this.syncUrlAndFetch();
  }

  onYearChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedYear.set(val ? +val : null);
    this.page.set(1);
    this.syncUrlAndFetch();
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.syncUrlAndFetch();
  }

  private readUrlParams(): void {
    const params = this.route.snapshot.queryParams;
    this.searchQuery.set(params['q'] ?? '');
    this.selectedDiscipline.set(params['discipline'] ?? '');
    this.selectedYear.set(params['year'] ? +params['year'] : null);
    this.page.set(params['page'] ? +params['page'] : 1);
    this.search$.next();
  }

  private syncUrlAndFetch(): void {
    const queryParams: Record<string, string | undefined> = {
      q: this.searchQuery() || undefined,
      discipline: this.selectedDiscipline() || undefined,
      year: this.selectedYear() != null ? String(this.selectedYear()) : undefined,
      page: this.page() > 1 ? String(this.page()) : undefined,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });

    this.search$.next();
  }

  private buildParams(): SeriesSearchParams {
    return {
      q: this.searchQuery() || undefined,
      discipline: this.selectedDiscipline() || undefined,
      year: this.selectedYear() ?? undefined,
      page: this.page(),
      limit: this.limit(),
    };
  }
}
