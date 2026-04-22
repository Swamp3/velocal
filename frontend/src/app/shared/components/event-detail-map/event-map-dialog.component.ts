import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type * as LeafletNS from 'leaflet';

const DIALOG_ZOOM = 14;

@Component({
  selector: 'app-event-map-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm
        p-0 sm:p-6 animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'events.detail.map.dialogLabel' | transloco"
      (click)="onBackdropClick($event)"
      #backdrop
    >
      <div
        class="relative flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg-card)]
          sm:h-[85vh] sm:max-h-[900px] sm:w-full sm:max-w-5xl
          sm:rounded-[var(--radius-lg)] sm:border sm:border-[var(--color-border)]
          sm:shadow-[var(--shadow-card)]"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-[var(--color-border)]
            bg-[var(--color-bg-card)] px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <span class="material-symbols-outlined text-[18px] text-[var(--color-primary)]">location_on</span>
              <span class="truncate">{{ locationName() || ('events.detail.map.title' | transloco) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full
              text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]
              hover:text-[var(--color-text)] transition-colors"
            [attr.aria-label]="'common.close' | transloco"
            (click)="close.emit()"
            #closeBtn
          >
            <span class="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div
          #mapContainer
          class="relative flex-1 w-full bg-[var(--color-bg-alt)]"
        ></div>

        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)]
            bg-[var(--color-bg-card)] px-4 py-3 text-sm"
        >
          <div class="flex flex-wrap items-center gap-3 text-[var(--color-text-muted)]">
            <a
              [href]="googleMapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_new</span>
              {{ 'events.detail.map.openGoogle' | transloco }}
            </a>
            <a
              [href]="appleMapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_new</span>
              {{ 'events.detail.map.openApple' | transloco }}
            </a>
            <a
              [href]="osmUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_new</span>
              {{ 'events.detail.map.openOsm' | transloco }}
            </a>
          </div>
          <a
            [routerLink]="['/map']"
            [queryParams]="{ focusEvent: eventId() }"
            class="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
            (click)="close.emit()"
          >
            {{ 'events.detail.map.showOnFullMap' | transloco }}
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `,
  ],
})
export class EventMapDialogComponent implements AfterViewInit {
  readonly coordinates = input.required<{ lat: number; lng: number }>();
  readonly eventId = input.required<string>();
  readonly locationName = input<string | null | undefined>(null);
  readonly close = output<void>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private map?: LeafletNS.Map;

  get googleMapsUrl(): string {
    const { lat, lng } = this.coordinates();
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  get appleMapsUrl(): string {
    const { lat, lng } = this.coordinates();
    const label = this.locationName();
    const q = label ? `&q=${encodeURIComponent(label)}` : '';
    return `https://maps.apple.com/?ll=${lat},${lng}${q}`;
  }

  get osmUrl(): string {
    const { lat, lng } = this.coordinates();
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = previousOverflow;
    });

    this.initMap().catch((err) => console.error('Failed to init event map dialog', err));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.backdrop().nativeElement) {
      this.close.emit();
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
      zoom: DIALOG_ZOOM,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    L.marker([lat, lng]).addTo(this.map);

    // Leaflet needs a size recalc once laid out inside the flex container.
    setTimeout(() => this.map?.invalidateSize(), 0);

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
    });
  }
}
