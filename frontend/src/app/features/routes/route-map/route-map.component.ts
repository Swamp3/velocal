import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteService, TrackPoint } from '@core/services/route.service';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { DecimalPipe } from '@angular/common';
import { formatDistance, Route, RouteFile } from '@shared/models';
import { forkJoin } from 'rxjs';
import type * as LeafletNS from 'leaflet';
import type {} from 'leaflet-polylinedecorator';

const PROFILE_W = 600;
const PROFILE_H = 120;

@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../../../../../node_modules/leaflet/dist/leaflet.css'],
  imports: [RouterLink, TranslocoPipe, DecimalPipe],
  templateUrl: './route-map.component.html',
})
export class RouteMapComponent implements OnInit {
  private readonly activated = inject(ActivatedRoute);
  private readonly routeService = inject(RouteService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private map?: LeafletNS.Map;
  private leaflet?: typeof LeafletNS;
  private hoverMarker?: LeafletNS.CircleMarker;

  protected readonly route = signal<Route | null>(null);
  protected readonly file = signal<RouteFile | null>(null);
  protected readonly points = signal<TrackPoint[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly distance = formatDistance;
  protected readonly profileW = PROFILE_W;
  protected readonly profileH = PROFILE_H;

  /** Whole track length in metres, the base of the distance axis. */
  private readonly totalM = computed(() => this.points().at(-1)?.[3] || 1);

  /**
   * Elevation profile: SVG paths plus the points it was drawn from (x and y as 0..1 fractions of
   * the plot), or null when the track has no elevation data.
   */
  protected readonly profile = computed(() => {
    const pts = this.points().filter((p) => p[2] !== null);
    if (pts.length < 2) return null;
    const total = this.totalM();
    const eles = pts.map((p) => p[2] as number);
    const min = Math.min(...eles);
    const max = Math.max(...eles);
    const span = Math.max(max - min, 1);
    const dots = pts.map((p) => ({
      x: p[3] / total,
      y: ((p[2] as number) - min) / span,
      km: p[3] / 1000,
      ele: Math.round(p[2] as number),
      lat: p[0],
      lon: p[1],
    }));
    const line = dots
      .map((d, i) => {
        const x = d.x * PROFILE_W;
        const y = PROFILE_H - d.y * (PROFILE_H - 8) - 4;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    return {
      line,
      area: `${line} L${PROFILE_W} ${PROFILE_H} L0 ${PROFILE_H} Z`,
      min: Math.round(min),
      max: Math.round(max),
      dots,
    };
  });

  /** Distance labels under the profile, at a round step (1, 2, 5, 10, 20, 25, 50, 100 km). */
  protected readonly ticks = computed(() => {
    const km = this.totalM() / 1000;
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => km / s <= 6) ?? 100;
    const out: { km: number; left: number }[] = [];
    for (let k = 0; k <= km; k += step) out.push({ km: k, left: (k / km) * 100 });
    return out;
  });

  /** Point under the finger or mouse on the profile. */
  protected readonly hover = signal<{
    left: number;
    top: number;
    km: number;
    ele: number;
    lat: number;
    lon: number;
  } | null>(null);

  constructor() {
    effect(() => {
      const el = this.mapContainer();
      const pts = this.points();
      if (el && pts.length > 0 && this.isBrowser && !this.map) {
        void this.initMap(el.nativeElement, pts);
      }
    });
    // The profile and the map follow each other: a point on the profile shows on the route.
    effect(() => {
      const h = this.hover();
      const map = this.map;
      const L = this.leaflet;
      if (!map || !L) return;
      if (!h) {
        this.hoverMarker?.remove();
        this.hoverMarker = undefined;
        return;
      }
      if (!this.hoverMarker) {
        this.hoverMarker = L.circleMarker([h.lat, h.lon], {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map);
      } else {
        this.hoverMarker.setLatLng([h.lat, h.lon]);
      }
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  protected onProfileMove(event: PointerEvent): void {
    const p = this.profile();
    if (!p) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    // The points are ordered by distance, so the nearest one is found by bisection.
    let lo = 0;
    let hi = p.dots.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (p.dots[mid].x < x) lo = mid + 1;
      else hi = mid;
    }
    const prev = p.dots[Math.max(0, lo - 1)];
    const d = Math.abs(prev.x - x) < Math.abs(p.dots[lo].x - x) ? prev : p.dots[lo];
    this.hover.set({
      left: d.x * 100,
      top: (1 - d.y) * 100,
      km: d.km,
      ele: d.ele,
      lat: d.lat,
      lon: d.lon,
    });
  }

  protected onProfileLeave(): void {
    this.hover.set(null);
  }

  ngOnInit(): void {
    const id = this.activated.snapshot.paramMap.get('id')!;
    const fileId = this.activated.snapshot.paramMap.get('fileId')!;
    this.seo.setMeta({ title: 'VeloCal — Route', description: '', noindex: true });
    forkJoin([this.routeService.get(id), this.routeService.getTrack(id, fileId)]).subscribe({
      next: ([route, track]) => {
        this.route.set(route);
        this.file.set(route.files.find((f) => f.id === fileId) ?? null);
        this.points.set(track.points);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private async initMap(el: HTMLElement, pts: TrackPoint[]): Promise<void> {
    const mod = await import('leaflet');
    const L =
      (mod as unknown as { default?: typeof LeafletNS }).default ??
      (mod as unknown as typeof LeafletNS);
    if (this.map) return;
    this.leaflet = L;
    this.map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    const latlngs = pts.map((p) => [p[0], p[1]] as [number, number]);
    const line = L.polyline(latlngs, { color: '#e11d48', weight: 4, opacity: 0.9 }).addTo(this.map);
    const dot = (color: string) => ({
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    });
    // The plugin attaches to whatever `L` it finds on `window`, and is only loaded on this page.
    (window as unknown as { L: typeof LeafletNS })['L'] = L;
    await import('leaflet-polylinedecorator');
    L.polylineDecorator(line, {
      patterns: [
        {
          offset: 40,
          repeat: 110,
          symbol: L.Symbol.arrowHead({
            pixelSize: 11,
            polygon: false,
            pathOptions: { color: '#fff', weight: 3, opacity: 0.95 },
          }),
        },
      ],
    }).addTo(this.map);
    L.circleMarker(latlngs[0], dot('#16a34a')).addTo(this.map);
    L.circleMarker(latlngs[latlngs.length - 1], dot('#dc2626')).addTo(this.map);
    this.map.fitBounds(line.getBounds(), { padding: [20, 20] });
  }
}
