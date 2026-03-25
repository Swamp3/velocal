import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnChanges,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

// Fix default marker icon paths broken by bundlers
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
  private map?: L.Map;
  private marker?: L.Marker;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(): void {
    if (this.map) {
      this.updateMap();
    }
  }

  private initMap(): void {
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
