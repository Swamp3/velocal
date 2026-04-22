import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { EventMiniMapComponent } from '../event-mini-map/event-mini-map.component';
import { EventMapDialogComponent } from './event-map-dialog.component';

@Component({
  selector: 'app-event-detail-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventMiniMapComponent, EventMapDialogComponent, TranslocoPipe],
  template: `
    <div class="relative group">
      <app-event-mini-map [coordinates]="coordinates()" />

      <button
        type="button"
        class="absolute inset-0 z-10 flex cursor-pointer items-end justify-end
          bg-transparent transition-colors hover:bg-black/5
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
          focus-visible:ring-offset-2 rounded-[var(--radius-lg)]"
        [attr.aria-label]="'events.detail.map.expand' | transloco"
        (click)="open()"
        #trigger
      >
        <span
          class="m-3 inline-flex items-center gap-1.5 rounded-full
            bg-[var(--color-bg-card)]/95 px-3 py-1.5 text-xs font-semibold
            text-[var(--color-text)] shadow-[var(--shadow-card)]
            border border-[var(--color-border)]
            backdrop-blur-sm transition-transform group-hover:scale-105"
        >
          <span class="material-symbols-outlined text-[16px]">open_in_full</span>
          <span class="hidden sm:inline">{{ 'events.detail.map.expand' | transloco }}</span>
          <span class="sm:hidden">{{ 'events.detail.map.tapToExplore' | transloco }}</span>
        </span>
      </button>
    </div>

    @if (expanded() && isBrowser) {
      <app-event-map-dialog
        [coordinates]="coordinates()"
        [eventId]="eventId()"
        [locationName]="locationName()"
        (close)="onClose()"
      />
    }
  `,
})
export class EventDetailMapComponent {
  readonly coordinates = input.required<{ lat: number; lng: number }>();
  readonly eventId = input.required<string>();
  readonly locationName = input<string | null | undefined>(null);

  protected readonly expanded = signal(false);
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  open(): void {
    this.expanded.set(true);
  }

  onClose(): void {
    this.expanded.set(false);
    // Restore focus to the trigger for a11y.
    queueMicrotask(() => this.trigger()?.nativeElement.focus());
  }
}
