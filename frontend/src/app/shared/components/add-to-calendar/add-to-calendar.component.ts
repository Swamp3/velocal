import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { CyclingEvent } from '@shared/models';
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from '@shared/utils/calendar';

@Component({
  selector: 'app-add-to-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'relative inline-block' },
  templateUrl: './add-to-calendar.component.html',
})
export class AddToCalendarComponent {
  readonly event = input.required<CyclingEvent>();
  readonly iconOnly = input(false);

  protected readonly open = signal(false);

  private readonly elRef = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  protected toggle(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.open.update((v) => !v);
  }

  protected openGoogle(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.open.set(false);
    if (this.isBrowser) {
      window.open(googleCalendarUrl(this.event()), '_blank', 'noopener');
    }
  }

  protected openOutlook(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.open.set(false);
    if (this.isBrowser) {
      window.open(outlookCalendarUrl(this.event()), '_blank', 'noopener');
    }
  }

  protected downloadIcsFile(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.open.set(false);
    if (this.isBrowser) {
      downloadIcs(this.event());
    }
  }
}
