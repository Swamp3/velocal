import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, forkJoin, Subject, switchMap, tap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { EventService } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { AuthService } from '@core/services/auth.service';
import { GeolocationService } from '@core/services/geolocation.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { DisciplineFilterComponent } from '@shared/components';

const EUROPE_CENTER: L.LatLngExpression = [51.1657, 10.4515];
const DEFAULT_ZOOM = 5;
const MAX_EVENTS = 5000;
const RADIUS_OPTIONS = [10, 25, 50, 100, 200] as const;

const DISCIPLINE_COLORS: Record<string, string> = {
  strasse: '#4CAF50',
  bahn: '#2196F3',
  'cyclo-cross': '#FF9800',
  mtb: '#795548',
  bmx: '#E91E63',
  halle: '#9C27B0',
  trial: '#607D8B',
  breitensport: '#00BCD4',
  tt: '#F44336',
};

function disciplineColor(slug: string): string {
  return DISCIPLINE_COLORS[slug] ?? '#6B7280';
}

function createDisciplineIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function createHomeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L3 9v11a2 2 0 002 2h4v-7h6v7h4a2 2 0 002-2V9l-9-7z"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

@Component({
  selector: 'app-event-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DisciplineFilterComponent],
  templateUrl: './event-map.component.html',
  host: {
    class: 'block fixed top-14 right-0 bottom-0 left-0 z-10',
  },
})
export class EventMapComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly authService = inject(AuthService);
  protected readonly geolocationService = inject(GeolocationService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;
  private radiusCircle?: L.Circle;
  private homeMarker?: L.Marker;
  private readonly iconCache = new Map<string, L.DivIcon>();
  private readonly mapReady = signal(false);
  private markerRebuildTimer?: ReturnType<typeof setTimeout>;

  private readonly allEvents = signal<CyclingEvent[]>([]);
  private readonly totalAvailable = signal(0);
  readonly disciplines = signal<Discipline[]>([]);
  readonly searchQuery = signal('');
  readonly selectedDisciplines = signal<string[]>([]);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly loading = signal(true);
  readonly filterPanelOpen = signal(false);

  readonly zip = signal('');
  readonly country = signal('DE');
  readonly radius = signal<number>(50);
  readonly userLat = signal<number | null>(null);
  readonly userLng = signal<number | null>(null);

  readonly radiusOptions = RADIUS_OPTIONS;
  readonly geoActive = computed(() => !!this.zip() || (this.userLat() != null && this.userLng() != null));

  readonly filteredEvents = computed(() => {
    if (this.geoActive()) return this.allEvents().filter((e) => e.coordinates);

    let events = this.allEvents().filter((e) => e.coordinates);

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      events = events.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.locationName?.toLowerCase().includes(q),
      );
    }

    const discs = this.selectedDisciplines();
    if (discs.length > 0) {
      events = events.filter((e) => discs.includes(e.disciplineSlug));
    }

    const from = this.dateFrom();
    if (from) {
      events = events.filter((e) => e.startDate >= from);
    }

    const to = this.dateTo();
    if (to) {
      events = events.filter((e) => e.startDate <= to);
    }

    return events;
  });

  readonly eventCount = computed(() => this.filteredEvents().length);
  readonly hasMore = computed(() => !this.geoActive() && this.totalAvailable() > this.allEvents().length);
  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().length > 0 ||
      this.selectedDisciplines().length > 0 ||
      this.dateFrom().length > 0 ||
      this.dateTo().length > 0 ||
      this.geoActive(),
  );

  private readonly geoSearch$ = new Subject<void>();
  private readonly zipInput$ = new Subject<string>();

  constructor() {
    effect(() => {
      if (!this.mapReady()) return;
      const events = this.filteredEvents();
      clearTimeout(this.markerRebuildTimer);
      this.markerRebuildTimer = setTimeout(() => this.rebuildMarkers(events), 50);
    });

    this.zipInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((z) => {
        this.zip.set(z);
        this.userLat.set(null);
        this.userLng.set(null);
        if (z) this.triggerGeoSearch();
        else this.loadData();
      });
  }

  ngOnInit(): void {
    this.geoSearch$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() => {
          const params: Record<string, string | number | boolean | undefined> = {
            limit: MAX_EVENTS,
            sort: 'distance',
          };

          if (this.userLat() != null && this.userLng() != null) {
            params['lat'] = this.userLat()!;
            params['lng'] = this.userLng()!;
          } else if (this.zip()) {
            params['zip'] = this.zip();
            params['country'] = this.country();
          }
          params['radius'] = this.radius();

          const q = this.searchQuery().trim();
          if (q) params['q'] = q;

          const discs = this.selectedDisciplines();
          if (discs.length) params['discipline'] = discs.join(',');

          const from = this.dateFrom();
          if (from) params['from'] = from;

          const to = this.dateTo();
          if (to) params['to'] = to;

          return this.eventService.getEvents(params as any);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.allEvents.set(res.data);
          this.totalAvailable.set(res.total);
          this.loading.set(false);
          this.updateGeoOverlays();
        },
        error: () => this.loading.set(false),
      });

    this.loadData();
    this.prefillFromUser();
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.mapReady.set(true);
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    if (this.geoActive()) this.triggerGeoSearch();
  }

  protected onDisciplineChange(slugs: string[]): void {
    this.selectedDisciplines.set(slugs);
    if (this.geoActive()) this.triggerGeoSearch();
  }

  protected onDateChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'from') this.dateFrom.set(value);
    else this.dateTo.set(value);
    if (this.geoActive()) this.triggerGeoSearch();
  }

  protected onZipInput(event: Event): void {
    this.zipInput$.next((event.target as HTMLInputElement).value);
  }

  protected onCountryChange(event: Event): void {
    this.country.set((event.target as HTMLSelectElement).value);
    if (this.zip()) this.triggerGeoSearch();
  }

  protected onRadiusChange(r: number): void {
    this.radius.set(r);
    if (this.geoActive()) this.triggerGeoSearch();
  }

  protected useMyLocation(): void {
    this.geolocationService
      .getCurrentPosition()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pos) => {
          this.userLat.set(pos.coords.latitude);
          this.userLng.set(pos.coords.longitude);
          this.zip.set('');
          this.triggerGeoSearch();
        },
      });
  }

  protected clearGeoSearch(): void {
    this.zip.set('');
    this.userLat.set(null);
    this.userLng.set(null);
    this.removeGeoOverlays();
    this.loadData();
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.selectedDisciplines.set([]);
    this.dateFrom.set('');
    this.dateTo.set('');
    this.clearGeoSearch();
  }

  private prefillFromUser(): void {
    const user = this.authService.currentUser();
    if (user?.homeZip) {
      this.zip.set(user.homeZip);
      if (user.homeCountry) this.country.set(user.homeCountry);
      this.triggerGeoSearch();
    }
  }

  private triggerGeoSearch(): void {
    this.geoSearch$.next();
  }

  private initMap(): void {
    this.map = L.map(this.mapEl().nativeElement, {
      center: EUROPE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
    });
    this.map.addLayer(this.clusterGroup);

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.markerRebuildTimer);
      this.map?.remove();
    });
  }

  private loadData(): void {
    this.loading.set(true);
    forkJoin({
      events: this.eventService.getEvents({ limit: MAX_EVENTS }),
      disciplines: this.disciplineService.getDisciplines(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ events, disciplines }) => {
          this.allEvents.set(events.data);
          this.totalAvailable.set(events.total);
          this.disciplines.set(disciplines);
          this.loading.set(false);
          this.removeGeoOverlays();
        },
        error: () => this.loading.set(false),
      });
  }

  private updateGeoOverlays(): void {
    if (!this.map) return;

    this.removeGeoOverlays();

    const events = this.allEvents();
    if (events.length === 0) return;

    let centerLat: number | undefined;
    let centerLng: number | undefined;

    if (this.userLat() != null && this.userLng() != null) {
      centerLat = this.userLat()!;
      centerLng = this.userLng()!;
    } else if (events.length > 0) {
      const withCoords = events.filter((e) => e.coordinates);
      if (withCoords.length > 0) {
        const latSum = withCoords.reduce((s, e) => s + e.coordinates!.lat, 0);
        const lngSum = withCoords.reduce((s, e) => s + e.coordinates!.lng, 0);
        centerLat = latSum / withCoords.length;
        centerLng = lngSum / withCoords.length;
      }
    }

    if (centerLat == null || centerLng == null) return;

    this.radiusCircle = L.circle([centerLat, centerLng], {
      radius: this.radius() * 1000,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '6 4',
    }).addTo(this.map);

    this.homeMarker = L.marker([centerLat, centerLng], { icon: createHomeIcon() })
      .addTo(this.map);

    this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [30, 30] });
  }

  private removeGeoOverlays(): void {
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = undefined;
    }
    if (this.homeMarker) {
      this.homeMarker.remove();
      this.homeMarker = undefined;
    }
  }

  private rebuildMarkers(events: CyclingEvent[]): void {
    if (!this.clusterGroup) return;
    this.clusterGroup.clearLayers();

    const lang = this.transloco.getActiveLang();
    const markers: L.Marker[] = [];

    for (const ev of events) {
      if (!ev.coordinates) continue;

      const icon = this.getIcon(ev.disciplineSlug);
      const marker = L.marker([ev.coordinates.lat, ev.coordinates.lng], { icon });

      const date = new Date(ev.startDate).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const disciplineName =
        ev.discipline?.nameTranslations?.[lang] ?? ev.disciplineSlug;

      const distanceLabel = this.transloco.translate('events.distanceAway', { distance: ev.distance });
      const distanceHtml = ev.distance != null
        ? `<div style="font-size:12px;color:#2563eb;margin-top:2px;font-weight:500">${this.esc(distanceLabel)}</div>`
        : '';

      const detailsLabel = this.transloco.translate('events.detail.details');

      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif">
          <strong style="font-size:14px;line-height:1.3;display:block">${this.esc(ev.name)}</strong>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">${date} · ${this.esc(ev.locationName)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${this.esc(disciplineName)}</div>
          ${distanceHtml}
          <a href="javascript:void(0)" class="map-evt-link" style="font-size:12px;color:#2563eb;margin-top:6px;display:inline-block;text-decoration:none;font-weight:500">${this.esc(detailsLabel)}</a>
        </div>`,
        { closeButton: true, minWidth: 180 },
      );

      marker.on('popupopen', () => {
        marker
          .getPopup()
          ?.getElement()
          ?.querySelector('.map-evt-link')
          ?.addEventListener('click', (e) => {
            e.preventDefault();
            this.router.navigate(['/events', ev.id]);
          });
      });

      markers.push(marker);
    }

    this.clusterGroup.addLayers(markers);
  }

  private getIcon(slug: string): L.DivIcon {
    let icon = this.iconCache.get(slug);
    if (!icon) {
      icon = createDisciplineIcon(disciplineColor(slug));
      this.iconCache.set(slug, icon);
    }
    return icon;
  }

  private esc(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return (text ?? '').replace(/[&<>"']/g, (c) => map[c]);
  }
}
