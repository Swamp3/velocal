import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialog shell: backdrop, title, close button, Escape and backdrop-click to close.
 * Render it with `@if` in the parent; put the body in the default slot and the
 * buttons in `[footer]`. A bottom sheet on phones, a centered window above.
 */
@Component({
  selector: 'ui-modal',
  imports: [TranslocoPipe],
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div
      class="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      (mousedown)="onBackdrop($event)"
    >
      <div
        #panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [attr.aria-label]="title()"
        class="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-elevated)] outline-none sm:rounded-2xl"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4"
        >
          <h2 class="text-base font-semibold text-[var(--color-text)]">{{ title() }}</h2>
          <button
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]"
            [attr.aria-label]="'common.close' | transloco"
            (click)="closed.emit()"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="overflow-y-auto px-5 py-5">
          <ng-content />
        </div>
        <div class="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <ng-content select="[footer]" />
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  private readonly injector = inject(Injector);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private previouslyFocused: HTMLElement | null = null;

  readonly title = input.required<string>();
  /** Emitted for Escape, the close button, and a click on the backdrop. */
  readonly closed = output<void>();

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID)) && document.activeElement instanceof HTMLElement) {
      this.previouslyFocused = document.activeElement;
    }

    // Move focus into the dialog so keyboard users start there; an autofocus field wins.
    afterNextRender(
      () => {
        const panel = this.panel().nativeElement;
        const field = panel.querySelector<HTMLElement>('[autofocus], input, textarea, .ql-editor');
        (field ?? panel).focus();
      },
      { injector: this.injector },
    );

    inject(DestroyRef).onDestroy(() => {
      if (this.previouslyFocused?.isConnected) this.previouslyFocused.focus();
    });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  /** Keeps Tab inside the dialog. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && panel.contains(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
