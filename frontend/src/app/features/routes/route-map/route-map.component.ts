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
import { formatDistance, Route, RouteFile } from '@shared/models';
import { forkJoin } from 'rxjs';
import type * as LeafletNS from 'leaflet';

const PROFILE_W = 600;
const PROFILE_H = 120;

@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['../../../../../node_modules/leaflet/dist/leaflet.css'],
  imports: [RouterLink, TranslocoPipe],
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

  protected readonly route = signal<Route | null>(null);
  protected readonly file = signal<RouteFile | null>(null);
  protected readonly points = signal<TrackPoint[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly distance = formatDistance;
  protected readonly profileW = PROFILE_W;
  protected readonly profileH = PROFILE_H;

  /** SVG path of the elevation profile, or null when the track has no elevation data. */
  protected readonly profile = computed(() => {
    const pts = this.points().filter((p) => p[2] !== null);
    if (pts.length < 2) return null;
    const total = pts[pts.length - 1][3] || 1;
    const eles = pts.map((p) => p[2] as number);
    const min = Math.min(...eles);
    const max = Math.max(...eles);
    const span = Math.max(max - min, 1);
    const line = pts
      .map((p, i) => {
        const x = (p[3] / total) * PROFILE_W;
        const y = PROFILE_H - (((p[2] as number) - min) / span) * (PROFILE_H - 8) - 4;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    return {
      line,
      area: `${line} L${PROFILE_W} ${PROFILE_H} L0 ${PROFILE_H} Z`,
      min: Math.round(min),
      max: Math.round(max),
    };
  });

  constructor() {
    effect(() => {
      const el = this.mapContainer();
      const pts = this.points();
      if (el && pts.length > 0 && this.isBrowser && !this.map) {
        void this.initMap(el.nativeElement, pts);
      }
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
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
    L.circleMarker(latlngs[0], dot('#16a34a')).addTo(this.map);
    L.circleMarker(latlngs[latlngs.length - 1], dot('#dc2626')).addTo(this.map);
    this.map.fitBounds(line.getBounds(), { padding: [20, 20] });
  }
}
