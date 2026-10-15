import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Header dropdown: a button that opens a panel of links (projected content).
 * Closes on outside click, Escape, or when a link inside is chosen.
 */
@Component({
  selector: 'app-nav-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        [class]="
          active()
            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        "
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() || null"
        (click)="open.set(!open())"
      >
        @if (icon()) {
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ icon() }}</span>
        }
        <span class="max-w-[10rem] truncate">{{ label() }}</span>
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
          {{ open() ? 'expand_less' : 'expand_more' }}
        </span>
      </button>

      @if (open()) {
        <div
          role="menu"
          class="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-[var(--shadow-elevated)]"
          (click)="open.set(false)"
          (keydown.enter)="open.set(false)"
          tabindex="-1"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class NavDropdownComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly label = input.required<string>();
  readonly icon = input<string>();
  readonly ariaLabel = input<string>();
  readonly active = input(false);

  protected readonly open = signal(false);

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
