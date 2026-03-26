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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { EventService, EventSearchParams } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { AuthService } from '@core/services/auth.service';
import { GeolocationService } from '@core/services/geolocation.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { ButtonComponent, PaginationComponent, SkeletonComponent } from '@shared/ui';
import { DisciplineFilterComponent } from '@shared/components/discipline-filter/discipline-filter.component';
import { EventCardComponent } from '@shared/components/event-card/event-card.component';
import { EmptyStateComponent } from '@shared/components';

const RADIUS_OPTIONS = [50, 100, 200, 500] as const;

@Component({
  selector: 'app-event-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    RouterLink,
    PaginationComponent,
    SkeletonComponent,
    ButtonComponent,
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
  protected readonly authService = inject(AuthService);
  protected readonly geolocationService = inject(GeolocationService);
  readonly filterStateService = inject(FilterStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal('');
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly page = signal(1);
  readonly limit = signal(20);

  readonly zip = signal<string>('');
  readonly country = signal<string>('DE');
  readonly radius = signal<number | null>(null);
  readonly userLat = signal<number | null>(null);
  readonly userLng = signal<number | null>(null);

  readonly events = signal<CyclingEvent[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly disciplines = signal<Discipline[]>([]);

  readonly radiusOptions = RADIUS_OPTIONS;

  readonly geoActive = computed(() => !!this.zip() || (this.userLat() != null && this.userLng() != null));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));

  private readonly search$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();
  private readonly zipInput$ = new Subject<string>();
  private skipNextUrlSync = false;

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.searchQuery.set(q);
        this.page.set(1);
        this.syncUrlAndFetch();
      });

    this.zipInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((z) => {
        this.zip.set(z);
        this.userLat.set(null);
        this.userLng.set(null);
        this.page.set(1);
        this.syncUrlAndFetch();
      });

    effect(() => {
      this.filterStateService.selectedDisciplines();
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
    this.prefillFromUser();
  }

  onSearchInput(event: Event): void {
    this.searchInput$.next((event.target as HTMLInputElement).value);
  }

  onDisciplineChange(slugs: string[]): void {
    this.filterStateService.setDisciplines(slugs);
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

  onZipInput(event: Event): void {
    this.zipInput$.next((event.target as HTMLInputElement).value);
  }

  onCountryChange(event: Event): void {
    this.country.set((event.target as HTMLSelectElement).value);
    if (this.zip()) {
      this.page.set(1);
      this.syncUrlAndFetch();
    }
  }

  onRadiusChange(r: number | null): void {
    this.radius.set(r);
    if (this.geoActive()) {
      this.page.set(1);
      this.syncUrlAndFetch();
    }
  }

  useMyLocation(): void {
    this.geolocationService
      .getCurrentPosition()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pos) => {
          this.userLat.set(pos.coords.latitude);
          this.userLng.set(pos.coords.longitude);
          this.zip.set('');
          this.page.set(1);
          this.syncUrlAndFetch();
        },
      });
  }

  clearGeoSearch(): void {
    this.zip.set('');
    this.userLat.set(null);
    this.userLng.set(null);
    this.page.set(1);
    this.syncUrlAndFetch();
  }

  private prefillFromUser(): void {
    const user = this.authService.currentUser();
    if (user?.homeZip && !this.zip() && this.userLat() == null) {
      this.zip.set(user.homeZip);
      if (user.homeCountry) {
        this.country.set(user.homeCountry);
      }
      this.syncUrlAndFetch();
    }
  }

  private readUrlParams(): void {
    const params = this.route.snapshot.queryParams;
    this.skipNextUrlSync = true;

    this.searchQuery.set(params['q'] ?? '');
    if (params['discipline']) {
      this.filterStateService.setDisciplines(params['discipline'].split(','));
    }
    this.dateFrom.set(params['from'] ?? '');
    this.dateTo.set(params['to'] ?? '');
    this.page.set(params['page'] ? +params['page'] : 1);

    if (params['zip']) this.zip.set(params['zip']);
    if (params['country']) this.country.set(params['country']);
    if (params['radius']) this.radius.set(+params['radius'] || null);
    if (params['lat'] && params['lng']) {
      this.userLat.set(+params['lat']);
      this.userLng.set(+params['lng']);
    }

    this.search$.next();
  }

  private syncUrlAndFetch(): void {
    const queryParams: Record<string, string | undefined> = {
      q: this.searchQuery() || undefined,
      discipline: this.filterStateService.selectedDisciplines().length
        ? this.filterStateService.selectedDisciplines().join(',')
        : undefined,
      from: this.dateFrom() || undefined,
      to: this.dateTo() || undefined,
      page: this.page() > 1 ? String(this.page()) : undefined,
      zip: this.zip() || undefined,
      country: this.zip() ? this.country() : undefined,
      radius: this.geoActive() && this.radius() != null ? String(this.radius()) : undefined,
      lat: this.userLat() != null ? String(this.userLat()) : undefined,
      lng: this.userLng() != null ? String(this.userLng()) : undefined,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });

    this.search$.next();
  }

  private buildParams(): EventSearchParams {
    const params: EventSearchParams = {
      q: this.searchQuery() || undefined,
      discipline: this.filterStateService.selectedDisciplines().length
        ? this.filterStateService.selectedDisciplines().join(',')
        : undefined,
      from: this.dateFrom() || undefined,
      to: this.dateTo() || undefined,
      page: this.page(),
      limit: this.limit(),
    };

    if (this.userLat() != null && this.userLng() != null) {
      params.lat = this.userLat()!;
      params.lng = this.userLng()!;
      if (this.radius() != null) params.radius = this.radius()!;
      params.sort = 'distance';
    } else if (this.zip()) {
      params.zip = this.zip();
      params.country = this.country();
      if (this.radius() != null) params.radius = this.radius()!;
      params.sort = 'distance';
    }

    return params;
  }
}
