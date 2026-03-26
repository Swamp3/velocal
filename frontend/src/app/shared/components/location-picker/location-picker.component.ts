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
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

const iconDefault = L.icon({
  iconUrl: 'assets/marker-icon.png',
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: L.LatLngExpression = [51.1657, 10.4515]; // Germany center
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
  private map?: L.Map;
  private marker?: L.Marker;
  private skipNextUpdate = false;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(): void {
    if (this.map && !this.skipNextUpdate) {
      this.updateMarker();
    }
    this.skipNextUpdate = false;
  }

  private initMap(): void {
    const coords = this.coordinates();
    const center = coords ? [coords.lat, coords.lng] as L.LatLngExpression : DEFAULT_CENTER;
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

    if (coords) {
      this.addMarker(coords.lat, coords.lng);
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.addMarker(lat, lng);
      this.emitCoordinates(lat, lng);
    });

    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  private addMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { icon: iconDefault, draggable: true }).addTo(this.map!);
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
