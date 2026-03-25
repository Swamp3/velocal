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
import { forkJoin } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { EventService } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { DisciplineFilterComponent } from '@shared/components';

const EUROPE_CENTER: L.LatLngExpression = [51.1657, 10.4515];
const DEFAULT_ZOOM = 5;
const MAX_EVENTS = 5000;

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

@Component({
  selector: 'app-event-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DisciplineFilterComponent],
  templateUrl: './event-map.component.html',
  host: {
    class: 'block fixed top-14 right-0 bottom-0 left-0 z-10',
  },
})
export class EventMapComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;
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

  readonly filteredEvents = computed(() => {
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
  readonly hasMore = computed(() => this.totalAvailable() > this.allEvents().length);
  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().length > 0 ||
      this.selectedDisciplines().length > 0 ||
      this.dateFrom().length > 0 ||
      this.dateTo().length > 0,
  );

  constructor() {
    effect(() => {
      if (!this.mapReady()) return;
      const events = this.filteredEvents();
      clearTimeout(this.markerRebuildTimer);
      this.markerRebuildTimer = setTimeout(() => this.rebuildMarkers(events), 50);
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.mapReady.set(true);
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected onDisciplineChange(slugs: string[]): void {
    this.selectedDisciplines.set(slugs);
  }

  protected onDateChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'from') this.dateFrom.set(value);
    else this.dateTo.set(value);
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.selectedDisciplines.set([]);
    this.dateFrom.set('');
    this.dateTo.set('');
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
        },
        error: () => this.loading.set(false),
      });
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

      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif">
          <strong style="font-size:14px;line-height:1.3;display:block">${this.esc(ev.name)}</strong>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">${date} · ${this.esc(ev.locationName)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${this.esc(disciplineName)}</div>
          <a href="javascript:void(0)" class="map-evt-link" style="font-size:12px;color:#2563eb;margin-top:6px;display:inline-block;text-decoration:none;font-weight:500">Details →</a>
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
