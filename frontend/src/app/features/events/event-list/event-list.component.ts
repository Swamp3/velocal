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
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';

import { EventService, EventSearchParams } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { PaginationComponent, SkeletonComponent } from '@shared/ui';
import { DisciplineFilterComponent } from '@shared/components/discipline-filter/discipline-filter.component';
import { EventCardComponent } from '@shared/components/event-card/event-card.component';
import { EmptyStateComponent } from '@shared/components';

@Component({
  selector: 'app-event-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PaginationComponent,
    SkeletonComponent,
    DisciplineFilterComponent,
    EventCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './event-list.component.html',
})
export class EventListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal('');
  readonly selectedDisciplines = signal<string[]>([]);
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly page = signal(1);
  readonly limit = signal(20);

  readonly events = signal<CyclingEvent[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly disciplines = signal<Discipline[]>([]);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit())),
  );

  private readonly search$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();
  private skipNextUrlSync = false;

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => {
        this.searchQuery.set(q);
        this.page.set(1);
        this.syncUrlAndFetch();
      });

    effect(() => {
      // Track dependencies so effect re-runs on changes
      this.selectedDisciplines();
      this.dateFrom();
      this.dateTo();
      this.page();

      if (this.skipNextUrlSync) {
        this.skipNextUrlSync = false;
        return;
      }

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
        switchMap(() => this.eventService.getEvents(this.buildParams())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.events.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.readUrlParams();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput$.next(value);
  }

  onDisciplineChange(slugs: string[]): void {
    this.selectedDisciplines.set(slugs);
    this.page.set(1);
  }

  onDateFromChange(event: Event): void {
    this.dateFrom.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  onDateToChange(event: Event): void {
    this.dateTo.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  onPageChange(p: number): void {
    this.page.set(p);
  }

  private readUrlParams(): void {
    const params = this.route.snapshot.queryParams;
    this.skipNextUrlSync = true;

    this.searchQuery.set(params['q'] ?? '');
    this.selectedDisciplines.set(
      params['discipline'] ? params['discipline'].split(',') : [],
    );
    this.dateFrom.set(params['from'] ?? '');
    this.dateTo.set(params['to'] ?? '');
    this.page.set(params['page'] ? +params['page'] : 1);

    this.search$.next();
  }

  private syncUrlAndFetch(): void {
    const queryParams: Record<string, string | undefined> = {
      q: this.searchQuery() || undefined,
      discipline: this.selectedDisciplines().length
        ? this.selectedDisciplines().join(',')
        : undefined,
      from: this.dateFrom() || undefined,
      to: this.dateTo() || undefined,
      page: this.page() > 1 ? String(this.page()) : undefined,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });

    this.search$.next();
  }

  private buildParams(): EventSearchParams {
    return {
      q: this.searchQuery() || undefined,
      discipline: this.selectedDisciplines().length
        ? this.selectedDisciplines().join(',')
        : undefined,
      from: this.dateFrom() || undefined,
      to: this.dateTo() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
  }
}
