import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnChanges,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import type * as LeafletNS from 'leaflet';

const DEFAULT_ZOOM = 13;

@Component({
  selector: 'app-event-mini-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #mapContainer
      class="h-[300px] w-full rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)]"
    ></div>
  `,
})
export class EventMiniMapComponent implements AfterViewInit, OnChanges {
  readonly coordinates = input.required<{ lat: number; lng: number }>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private map?: LeafletNS.Map;
  private marker?: LeafletNS.Marker;
  private initPromise?: Promise<void>;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.initPromise = this.initMap().catch((err) => {
      console.error('Failed to initialize event mini map', err);
    });
  }

  ngOnChanges(): void {
    if (this.map) {
      this.updateMap();
    } else if (this.initPromise) {
      this.initPromise.then(() => {
        if (this.map) this.updateMap();
      });
    }
  }

  private async initMap(): Promise<void> {
    const leafletMod = await import('leaflet');
    const L =
      ((leafletMod as unknown as { default?: typeof LeafletNS }).default ??
        (leafletMod as unknown as typeof LeafletNS));

    const iconDefault = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = iconDefault;

    const { lat, lng } = this.coordinates();

    this.map = L.map(this.mapContainer().nativeElement, {
      center: [lat, lng],
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    this.marker = L.marker([lat, lng]).addTo(this.map);

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
    });
  }

  private updateMap(): void {
    const { lat, lng } = this.coordinates();
    this.map!.setView([lat, lng], DEFAULT_ZOOM);

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    }
  }
}
