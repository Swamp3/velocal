import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ParkingArea } from '@shared/models';
import { loadLeaflet, TILE_ATTRIBUTION, TILE_URL } from '@shared/utils/leaflet';
import { addParkingMarkers, boundsWithParking } from '@shared/utils/parking-markers';
import type * as LeafletNS from 'leaflet';

const ZOOM = 15;

/**
 * The one map of an event page: the venue plus its parking areas. Nothing is loaded (no Leaflet,
 * no tiles) until the user opens it; "full screen" enlarges the same map instead of opening a
 * second one.
 */
@Component({
  selector: 'app-event-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, TranslocoPipe],
  styleUrls: ['../../../../../node_modules/leaflet/dist/leaflet.css'],
  template: `
    @if (!opened()) {
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 text-left shadow-[var(--shadow-card)] hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        (click)="open()"
      >
        <span class="material-symbols-outlined text-[28px] text-[var(--color-primary)]" aria-hidden="true">map</span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold text-[var(--color-text)]">{{ 'events.detail.map.show' | transloco }}</span>
          <span class="block truncate text-xs text-[var(--color-text-muted)]">
            {{ locationName() || ('events.detail.map.title' | transloco) }}
            @if (parkingAreas().length) {
              · {{ 'events.detail.map.withParking' | transloco: { count: parkingAreas().length } }}
            }
          </span>
        </span>
        <span class="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]" aria-hidden="true">expand_more</span>
      </button>
    } @else {
      <div
        [class]="
          fullscreen()
            ? 'fixed inset-0 z-[1000] flex flex-col bg-[var(--color-bg-card)]'
            : 'flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]'
        "
        role="region"
        [attr.aria-label]="'events.detail.map.dialogLabel' | transloco"
      >
        <div class="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <span class="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <span class="material-symbols-outlined text-[18px] text-[var(--color-primary)]" aria-hidden="true">location_on</span>
            <span class="truncate">{{ locationName() || ('events.detail.map.title' | transloco) }}</span>
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg-alt)]"
            (click)="toggleFullscreen()"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ fullscreen() ? 'close_fullscreen' : 'open_in_full' }}</span>
            {{ (fullscreen() ? 'events.detail.map.exitFullscreen' : 'events.detail.map.fullscreen') | transloco }}
          </button>
        </div>
        <div #mapContainer [class]="fullscreen() ? 'flex-1 w-full' : 'h-[360px] w-full'"></div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2 text-sm">
          <div class="flex flex-wrap items-center gap-3">
            <a [href]="googleMapsUrl()" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
              {{ 'events.detail.map.openGoogle' | transloco }}
            </a>
            <a [href]="appleMapsUrl()" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
              {{ 'events.detail.map.openApple' | transloco }}
            </a>
            <a [href]="osmUrl()" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
              {{ 'events.detail.map.openOsm' | transloco }}
            </a>
          </div>
          <a [routerLink]="['/map']" [queryParams]="{ focusEvent: eventId() }" class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline">
            {{ 'events.detail.map.showOnFullMap' | transloco }}
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
          </a>
        </div>
      </div>
    }
  `,
})
export class EventMapComponent {
  readonly coordinates = input.required<{ lat: number; lng: number }>();
  readonly eventId = input.required<string>();
  readonly locationName = input<string | null | undefined>(null);
  readonly parkingAreas = input<ParkingArea[]>([]);

  protected readonly opened = signal(false);
  protected readonly fullscreen = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private map?: LeafletNS.Map;
  private parkingMarkers: LeafletNS.Marker[] = [];
  private pendingFocus: number | null = null;

  constructor() {
    // The container exists once opened; build the map then (only once).
    effect(() => {
      const container = this.mapContainer();
      if (container && !this.map && this.isBrowser) void this.build(container.nativeElement);
    });
    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  protected readonly googleMapsUrl = () => {
    const { lat, lng } = this.coordinates();
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  protected readonly appleMapsUrl = () => {
    const { lat, lng } = this.coordinates();
    const label = this.locationName();
    return `https://maps.apple.com/?ll=${lat},${lng}${label ? `&q=${encodeURIComponent(label)}` : ''}`;
  };

  protected readonly osmUrl = () => {
    const { lat, lng } = this.coordinates();
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  };

  open(): void {
    this.opened.set(true);
  }

  /** Opens the map (if needed) and shows one parking area with its popup. */
  showParking(index: number): void {
    this.pendingFocus = index;
    this.open();
    if (this.map) this.focusPending();
    this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  protected toggleFullscreen(): void {
    this.fullscreen.update((v) => !v);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.fullscreen()) this.toggleFullscreen();
  }

  private async build(container: HTMLElement): Promise<void> {
    const L = await loadLeaflet();
    if (this.map) return;
    const { lat, lng } = this.coordinates();
    this.map = L.map(container, { center: [lat, lng], zoom: ZOOM, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(this.map);
    const venue = L.marker([lat, lng]).addTo(this.map);
    const name = this.locationName();
    if (name) venue.bindTooltip(name);
    this.parkingMarkers = addParkingMarkers(L, this.map, this.parkingAreas(), true);
    const bounds = boundsWithParking(L, { lat, lng }, this.parkingAreas());
    if (bounds) this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    this.focusPending();
  }

  private focusPending(): void {
    const marker = this.pendingFocus != null ? this.parkingMarkers[this.pendingFocus] : undefined;
    this.pendingFocus = null;
    if (!marker || !this.map) return;
    this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 16));
    marker.openPopup();
  }
}
