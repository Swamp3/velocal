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
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import type * as LeafletNS from 'leaflet';

const DEFAULT_CENTER: LeafletNS.LatLngExpression = [51.1657, 10.4515];
const DEFAULT_ZOOM = 6;
const MARKER_ZOOM = 13;

@Component({
  selector: 'app-location-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #mapContainer
      class="h-[250px] w-full rounded-[var(--radius-default)] overflow-hidden border border-[var(--color-border)]"
    ></div>
  `,
})
export class LocationPickerComponent implements AfterViewInit, OnChanges {
  readonly coordinates = input<{ lat: number; lng: number } | null>(null);
  readonly coordinatesChange = output<{ lat: number; lng: number }>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private L?: typeof LeafletNS;
  private iconDefault?: LeafletNS.Icon;
  private map?: LeafletNS.Map;
  private marker?: LeafletNS.Marker;
  private skipNextUpdate = false;
  private initPromise?: Promise<void>;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.initPromise = this.initMap().catch((err) => {
      console.error('Failed to initialize location picker map', err);
    });
  }

  ngOnChanges(): void {
    if (this.map) {
      if (!this.skipNextUpdate) this.updateMarker();
    } else if (this.initPromise && !this.skipNextUpdate) {
      this.initPromise.then(() => {
        if (this.map) this.updateMarker();
      });
    }
    this.skipNextUpdate = false;
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');
    this.L = L;
    this.iconDefault = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const coords = this.coordinates();
    const center = coords ? ([coords.lat, coords.lng] as LeafletNS.LatLngExpression) : DEFAULT_CENTER;
    const zoom = coords ? MARKER_ZOOM : DEFAULT_ZOOM;

    this.map = L.map(this.mapContainer().nativeElement, {
      center,
      zoom,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    if (coords) this.addMarker(coords.lat, coords.lng);

    this.map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.addMarker(lat, lng);
      this.emitCoordinates(lat, lng);
    });

    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  private addMarker(lat: number, lng: number): void {
    if (!this.L || !this.map || !this.iconDefault) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = this.L.marker([lat, lng], { icon: this.iconDefault, draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.emitCoordinates(pos.lat, pos.lng);
      });
    }
  }

  private updateMarker(): void {
    const coords = this.coordinates();
    if (coords) {
      this.addMarker(coords.lat, coords.lng);
      this.map!.setView([coords.lat, coords.lng], MARKER_ZOOM);
    } else if (this.marker) {
      this.map!.removeLayer(this.marker);
      this.marker = undefined;
    }
  }

  private emitCoordinates(lat: number, lng: number): void {
    this.skipNextUpdate = true;
    const rounded = {
      lat: Math.round(lat * 1_000_000) / 1_000_000,
      lng: Math.round(lng * 1_000_000) / 1_000_000,
    };
    this.coordinatesChange.emit(rounded);
  }
}
