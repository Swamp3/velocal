import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, forkJoin, Subject, Subscription, switchMap, tap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type * as LeafletNS from 'leaflet';
import type {} from 'leaflet.markercluster';

import { EventService } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { AuthService } from '@core/services/auth.service';
import { GeolocationService } from '@core/services/geolocation.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { DisciplineFilterComponent } from '@shared/components';
import { normalizeCoords } from '@shared/utils/coords';

const EUROPE_CENTER: LeafletNS.LatLngExpression = [51.1657, 10.4515];
const DEFAULT_ZOOM = 5;
const MAX_EVENTS = 5000;
const RADIUS_OPTIONS = [50, 100, 200, 500] as const;

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
  gravel: '#8D6E63',
};

function disciplineColor(slug: string): string {
  return DISCIPLINE_COLORS[slug] ?? '#6B7280';
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
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly authService = inject(AuthService);
  protected readonly geolocationService = inject(GeolocationService);
  readonly filterStateService = inject(FilterStateService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private L?: typeof LeafletNS;
  private map?: LeafletNS.Map;
  private clusterGroup?: LeafletNS.MarkerClusterGroup;
  private radiusCircle?: LeafletNS.Circle;
  private homeMarker?: LeafletNS.Marker;
  private readonly iconCache = new Map<string, LeafletNS.DivIcon>();
  private readonly markerById = new Map<string, LeafletNS.Marker>();
  private readonly mapReady = signal(false);
  private pendingFocusEventId: string | null = null;

  private readonly today = new Date().toISOString().slice(0, 10);

  private readonly allEvents = signal<CyclingEvent[]>([]);
  private readonly totalAvailable = signal(0);
  readonly disciplines = signal<Discipline[]>([]);
  readonly searchQuery = signal('');
  readonly dateFrom = signal(this.today);
  readonly dateTo = signal('');
  readonly loading = signal(true);
  readonly filterPanelOpen = signal(false);

  readonly zip = signal('');
  readonly country = signal('DE');
  readonly radius = signal<number | null>(null);
  readonly userLat = signal<number | null>(null);
  readonly userLng = signal<number | null>(null);

  readonly radiusOptions = RADIUS_OPTIONS;
  readonly geoActive = computed(() => !!this.zip() || (this.userLat() != null && this.userLng() != null));

  readonly filteredEvents = computed(() => {
    if (this.geoActive()) return this.allEvents().filter((e) => normalizeCoords(e.coordinates));

    let events = this.allEvents().filter((e) => normalizeCoords(e.coordinates));

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      events = events.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.locationName?.toLowerCase().includes(q),
      );
    }

    const discs = this.filterStateService.selectedDisciplines();
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
      this.filterStateService.selectedDisciplines().length > 0 ||
      this.dateFrom() !== this.today ||
      this.dateTo().length > 0 ||
      this.geoActive(),
  );

  private readonly geoSearch$ = new Subject<void>();
  private readonly zipInput$ = new Subject<string>();
  private reverseGeocodeSub?: Subscription;

  private readonly geoCenter = signal<{ lat: number; lng: number } | null>(null);

  constructor() {
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
          const r = this.radius();
          if (r != null) params['radius'] = r;

          const q = this.searchQuery().trim();
          if (q) params['q'] = q;

          const discs = this.filterStateService.selectedDisciplines();
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
          this.geoCenter.set(res.center ?? null);
          this.loading.set(false);
          this.updateGeoOverlays();
          this.refreshMap();
        },
        error: () => this.loading.set(false),
      });

    this.pendingFocusEventId = this.route.snapshot.queryParamMap.get('focusEvent');

    this.loadData();
    this.prefillFromUser();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.initMap();
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    if (this.geoActive()) this.triggerGeoSearch();
    else this.refreshMap();
  }

  protected onDisciplineChange(slugs: string[]): void {
    this.filterStateService.setDisciplines(slugs);
    if (this.geoActive()) this.triggerGeoSearch();
    else this.refreshMap();
  }

  protected onDateChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'from') this.dateFrom.set(value);
    else this.dateTo.set(value);
    if (this.geoActive()) this.triggerGeoSearch();
    else this.refreshMap();
  }

  protected onZipInput(event: Event): void {
    this.zipInput$.next((event.target as HTMLInputElement).value);
  }

  protected onCountryChange(event: Event): void {
    this.country.set((event.target as HTMLSelectElement).value);
    if (this.zip()) this.triggerGeoSearch();
  }

  protected onRadiusChange(r: number | null): void {
    this.radius.set(r);
    if (this.geoActive()) this.triggerGeoSearch();
  }

  protected useMyLocation(): void {
    this.geolocationService
      .getCurrentPosition()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.userLat.set(lat);
          this.userLng.set(lng);
          this.geoCenter.set({ lat, lng });
          this.zip.set('');
          this.triggerGeoSearch();
        },
      });
  }

  protected onMapClick(latlng: LeafletNS.LatLng): void {
    const { lat, lng } = latlng;
    this.userLat.set(lat);
    this.userLng.set(lng);
    this.zip.set('');
    this.geoCenter.set({ lat, lng });
    this.updateGeoOverlays();
    this.triggerGeoSearch();

    this.reverseGeocodeSub?.unsubscribe();
    this.reverseGeocodeSub = this.geolocationService
      .reverseGeocode(lat, lng)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result.zip) this.zip.set(result.zip);
        if (result.country) this.country.set(result.country);
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
    this.filterStateService.setDisciplines([]);
    this.dateFrom.set(this.today);
    this.dateTo.set('');
    this.radius.set(null);
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

  private async initMap(): Promise<void> {
    // Leaflet is UMD/CJS; esbuild wraps its exports under `.default` in the
    // prod build, while the dev server hands back the real namespace. Unwrap
    // so `L.extend`, `L.LayerGroup`, etc. exist in both builds.
    const leafletMod = await import('leaflet');
    const L =
      ((leafletMod as unknown as { default?: typeof LeafletNS }).default ??
        (leafletMod as unknown as typeof LeafletNS));
    this.L = L;
    // leaflet.markercluster is not an ES module — it attaches to whatever
    // `L` it finds on `window`, so we have to publish the dynamic import
    // onto the global before loading it.
    (window as unknown as { L: typeof LeafletNS })['L'] = L;
    await import('leaflet.markercluster');

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
    });
    this.map.addLayer(this.clusterGroup);

    this.map.on('click', (e: LeafletNS.LeafletMouseEvent) => this.onMapClick(e.latlng));
    this.map.getContainer().classList.add('map-clickable');

    this.destroyRef.onDestroy(() => this.map?.remove());

    this.mapReady.set(true);
    this.refreshMap();
  }

  private loadData(): void {
    this.loading.set(true);
    const from = this.dateFrom();
    forkJoin({
      events: this.eventService.getEvents({ limit: MAX_EVENTS, ...(from ? { from } : {}) }),
      disciplines: this.disciplineService.getDisciplines(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ events, disciplines }) => {
          this.allEvents.set(events.data);
          this.totalAvailable.set(events.total);
          this.disciplines.set(disciplines);
          this.geoCenter.set(null);
          this.loading.set(false);
          this.removeGeoOverlays();
          this.refreshMap();
        },
        error: () => this.loading.set(false),
      });
  }

  private updateGeoOverlays(): void {
    if (!this.map || !this.L) return;

    this.removeGeoOverlays();

    const center = this.geoCenter();
    if (!center) return;

    const r = this.radius();
    if (r != null) {
      this.radiusCircle = this.L.circle([center.lat, center.lng], {
        radius: r * 1000,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.06,
        weight: 2,
        dashArray: '6 4',
      }).addTo(this.map);
    }

    this.homeMarker = this.L.marker([center.lat, center.lng], {
      icon: this.createHomeIcon(),
      draggable: true,
    }).addTo(this.map);

    this.homeMarker.on('dragend', () => {
      const pos = this.homeMarker!.getLatLng();
      this.onMapClick(pos);
    });

    if (this.radiusCircle) {
      this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [30, 30] });
    } else {
      this.map.setView([center.lat, center.lng], 8);
    }
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

  private refreshMap(): void {
    if (!this.mapReady()) return;
    this.rebuildMarkers(this.filteredEvents());

    const focused = this.applyPendingFocus();
    if (!focused && !this.geoActive()) this.fitToMarkers();
  }

  private applyPendingFocus(): boolean {
    const id = this.pendingFocusEventId;
    if (!id || !this.map) return false;

    const marker = this.markerById.get(id);
    if (!marker) return false;

    this.pendingFocusEventId = null;
    this.map.setView(marker.getLatLng(), 13, { animate: false });
    // Ensure marker is visible (spiderfy if clustered) then open popup.
    this.clusterGroup?.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
    return true;
  }

  private fitToMarkers(): void {
    if (!this.map || !this.clusterGroup) return;

    const bounds = this.clusterGroup.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }

  private rebuildMarkers(events: CyclingEvent[]): void {
    if (!this.clusterGroup || !this.L) return;
    this.clusterGroup.clearLayers();
    this.markerById.clear();

    const lang = this.transloco.getActiveLang();
    const markers: LeafletNS.Marker[] = [];

    for (const ev of events) {
      const coords = normalizeCoords(ev.coordinates);
      if (!coords) continue;

      const icon = this.getIcon(ev.disciplineSlug);
      const marker = this.L.marker([coords.lat, coords.lng], { icon });
      this.markerById.set(ev.id, marker);

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

  private getIcon(slug: string): LeafletNS.DivIcon {
    let icon = this.iconCache.get(slug);
    if (!icon) {
      icon = this.createDisciplineIcon(disciplineColor(slug));
      this.iconCache.set(slug, icon);
    }
    return icon;
  }

  private createDisciplineIcon(color: string): LeafletNS.DivIcon {
    return this.L!.divIcon({
      className: '',
      html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center">
        <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -14],
    });
  }

  private createHomeIcon(): LeafletNS.DivIcon {
    return this.L!.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L3 9v11a2 2 0 002 2h4v-7h6v7h4a2 2 0 002-2V9l-9-7z"/></svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
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
