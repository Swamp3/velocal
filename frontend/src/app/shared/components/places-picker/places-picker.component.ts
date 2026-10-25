import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { loadLeaflet, TILE_ATTRIBUTION, TILE_URL } from '@shared/utils/leaflet';
import { parkingIcon } from '@shared/utils/parking-markers';
import type * as LeafletNS from 'leaflet';

/** A point the form edits: the venue or a parking area. */
export interface PickerPoint {
  key: string;
  /** Shown on the target buttons. */
  label: string;
  /** Short marker text for parking ("P1"); the venue uses the normal pin. */
  marker: string | null;
  coords: { lat: number; lng: number } | null;
}

const GERMANY: [number, number] = [51.16, 10.45];
const ROUND = 1_000_000;

/**
 * One map for every point of the event form. It loads only when the user opens it. Tapping the map
 * sets the chosen point; every marker can be dragged.
 */
@Component({
  selector: 'app-places-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [TranslocoPipe],
  styleUrls: ['../../../../../node_modules/leaflet/dist/leaflet.css'],
  template: `
    @if (!opened()) {
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-[var(--radius-default)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-left text-sm hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        (click)="opened.set(true)"
      >
        <span class="material-symbols-outlined text-[22px] text-[var(--color-primary)]" aria-hidden="true">map</span>
        <span class="font-medium text-[var(--color-text)]">{{ 'event.form.openMap' | transloco }}</span>
      </button>
    } @else {
      <div class="space-y-2">
        @if (points().length > 1) {
          <div class="flex flex-wrap items-center gap-2 text-xs" role="group" [attr.aria-label]="'event.form.mapTarget' | transloco">
            <span class="text-[var(--color-text-muted)]">{{ 'event.form.mapTarget' | transloco }}</span>
            @for (point of points(); track point.key) {
              <button
                type="button"
                [attr.aria-pressed]="active() === point.key"
                [class]="
                  'rounded-full border px-3 py-1 font-medium ' +
                  (active() === point.key
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]')
                "
                (click)="active.set(point.key)"
              >
                {{ point.marker ? point.marker + ' · ' : '' }}{{ point.label }}
              </button>
            }
          </div>
        }
        <p class="text-xs text-[var(--color-text-muted)]">{{ 'event.form.mapHint' | transloco: { target: activeLabel() } }}</p>
        <div #mapContainer class="h-[300px] w-full overflow-hidden rounded-[var(--radius-default)] border border-[var(--color-border)]"></div>
      </div>
    }
  `,
})
export class PlacesPickerComponent {
  readonly points = input.required<PickerPoint[]>();
  /** Key of the point a tap on the map sets. */
  readonly active = model<string>('venue');
  readonly pointChange = output<{ key: string; coords: { lat: number; lng: number } }>();

  protected readonly opened = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private L?: typeof LeafletNS;
  private map?: LeafletNS.Map;
  private readonly markers = new Map<string, LeafletNS.Marker>();

  constructor() {
    effect(() => {
      const container = this.mapContainer();
      if (container && !this.map && this.isBrowser) void this.build(container.nativeElement);
    });
    // Keep the markers in step with the form.
    effect(() => {
      const points = this.points();
      if (this.map) this.sync(points);
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  protected activeLabel(): string {
    return this.points().find((p) => p.key === this.active())?.label ?? '';
  }

  /** Opens the map with this point chosen, e.g. from a parking area's "set on map" button. */
  focus(key: string): void {
    this.active.set(key);
    this.opened.set(true);
    this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const coords = this.points().find((p) => p.key === key)?.coords;
    if (coords && this.map) this.map.panTo([coords.lat, coords.lng]);
  }

  private async build(container: HTMLElement): Promise<void> {
    this.L = await loadLeaflet();
    if (this.map) return;
    const placed = this.points().filter((p) => p.coords);
    this.map = this.L.map(container, { center: GERMANY, zoom: 6, scrollWheelZoom: true });
    this.L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(this.map);
    if (placed.length === 1) {
      this.map.setView([placed[0].coords!.lat, placed[0].coords!.lng], 15);
    } else if (placed.length > 1) {
      this.map.fitBounds(
        this.L.latLngBounds(placed.map((p) => [p.coords!.lat, p.coords!.lng] as [number, number])),
        { padding: [32, 32], maxZoom: 17 },
      );
    }
    this.map.on('click', (e: LeafletNS.LeafletMouseEvent) => this.emit(this.active(), e.latlng));
    this.sync(this.points());
  }

  private sync(points: PickerPoint[]): void {
    const L = this.L!;
    const keys = new Set(points.map((p) => p.key));
    for (const [key, marker] of this.markers) {
      if (!keys.has(key)) {
        marker.remove();
        this.markers.delete(key);
      }
    }
    for (const point of points) {
      const existing = this.markers.get(point.key);
      if (!point.coords) {
        existing?.remove();
        this.markers.delete(point.key);
        continue;
      }
      const at: [number, number] = [point.coords.lat, point.coords.lng];
      if (existing) {
        existing.setLatLng(at);
        if (point.marker) existing.setIcon(parkingIcon(L, point.marker));
        continue;
      }
      const marker = L.marker(at, {
        draggable: true,
        title: point.label,
        ...(point.marker ? { icon: parkingIcon(L, point.marker) } : {}),
      }).addTo(this.map!);
      marker.on('dragend', () => this.emit(point.key, marker.getLatLng()));
      this.markers.set(point.key, marker);
    }
  }

  private emit(key: string, at: { lat: number; lng: number }): void {
    this.pointChange.emit({
      key,
      coords: { lat: Math.round(at.lat * ROUND) / ROUND, lng: Math.round(at.lng * ROUND) / ROUND },
    });
  }
}
