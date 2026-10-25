import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ParkingArea } from '@shared/models';
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '@shared/utils/map-links';

/** Icon per parking kind (Material Symbols); `icon:` fields are picked up by scripts/subset-icons.py. */
const KIND_ICONS: { kind: string; icon: string }[] = [
  { kind: 'participants', icon: 'directions_car' },
  { kind: 'teams', icon: 'airport_shuttle' },
  { kind: 'spectators', icon: 'groups' },
  { kind: 'accessible', icon: 'accessible' },
  { kind: 'bikes', icon: 'pedal_bike' },
  { kind: 'camper', icon: 'rv_hookup' },
];

/** Parking areas of an event, with a hint that the details may be wrong. */
@Component({
  selector: 'app-event-parking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DecimalPipe],
  template: `
    <section class="mt-8" aria-labelledby="parking-heading">
      <div class="flex items-center gap-1.5">
        <h2 id="parking-heading" class="text-lg font-semibold text-[var(--color-text)]">
          {{ 'parking.title' | transloco }}
        </h2>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          [title]="'parking.disclaimer' | transloco"
          [attr.aria-label]="'parking.disclaimerLabel' | transloco"
          [attr.aria-expanded]="hintOpen()"
          aria-controls="parking-disclaimer"
          (click)="hintOpen.set(!hintOpen())"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
        </button>
      </div>
      @if (hintOpen()) {
        <p id="parking-disclaimer" class="mt-1 text-xs text-[var(--color-text-muted)]">
          {{ 'parking.disclaimer' | transloco }}
        </p>
      }
      <ul class="mt-3 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        @for (area of areas(); track $index) {
          <li class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <div class="min-w-0">
              <p class="flex items-center gap-2 font-medium text-[var(--color-text)]">
                <span
                  class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-700 text-xs font-bold text-white"
                  aria-hidden="true"
                  >P</span
                >
                <span class="break-words">{{ area.name }}</span>
              </p>
              <p class="mt-1 flex flex-wrap gap-1.5">
                @for (kind of area.kinds; track kind) {
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-alt)] px-2 py-0.5 text-xs text-[var(--color-text)]"
                  >
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ icon(kind) }}</span>
                    {{ 'parking.kind.' + kind | transloco }}
                  </span>
                }
              </p>
              <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                @if (area.distanceM != null) {
                  <span>{{ 'parking.distance' | transloco: { meters: (area.distanceM | number: '1.0-0') } }}</span>
                }
                @if (area.fee) {
                  <span> · {{ 'parking.fee.' + area.fee | transloco }}</span>
                }
                @if (area.feeNote) {
                  <span> ({{ area.feeNote }})</span>
                }
                @if (area.capacity) {
                  <span> · {{ 'parking.capacity' | transloco: { count: area.capacity } }}</span>
                }
                @if (area.openFrom || area.openUntil) {
                  <span>
                    · {{ 'parking.open' | transloco: { from: area.openFrom ?? '…', until: area.openUntil ?? '…' } }}</span
                  >
                }
              </p>
              @if (area.address) {
                <p class="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">{{ area.address }}</p>
              }
              @if (area.note) {
                <p class="mt-0.5 break-words text-xs text-[var(--color-text)]">{{ area.note }}</p>
              }
            </div>
            <div class="flex shrink-0 gap-2 text-xs">
              <a
                class="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg-alt)]"
                [href]="google(area)"
                target="_blank"
                rel="noopener"
              >
                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">directions</span>
                Google Maps
              </a>
              <a
                class="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg-alt)]"
                [href]="apple(area)"
                target="_blank"
                rel="noopener"
              >
                Apple Maps
              </a>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
})
export class EventParkingComponent {
  readonly areas = input.required<ParkingArea[]>();

  /** The hint also opens on tap, since touch screens have no hover. */
  protected readonly hintOpen = signal(false);

  protected icon(kind: string): string {
    return (KIND_ICONS.find((k) => k.kind === kind) ?? KIND_ICONS[0]).icon;
  }

  protected google(area: ParkingArea): string {
    return googleMapsDirectionsUrl(`${area.coordinates.lat},${area.coordinates.lng}`);
  }

  protected apple(area: ParkingArea): string {
    return appleMapsDirectionsUrl(`${area.coordinates.lat},${area.coordinates.lng}`);
  }
}
