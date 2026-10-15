import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Dialog shell: backdrop, title, close button, Escape and backdrop-click to close.
 * Render it with `@if` in the parent; put the body in the default slot and the
 * buttons in `[footer]`. A bottom sheet on phones, a centered window above.
 */
@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
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

  readonly title = input.required<string>();
  /** Emitted for Escape, the close button, and a click on the backdrop. */
  readonly closed = output<void>();

  constructor() {
    // Move focus into the dialog so keyboard users start there; an autofocus field wins.
    afterNextRender(
      () => {
        const panel = this.panel().nativeElement;
        const field = panel.querySelector<HTMLElement>('[autofocus], input, textarea, .ql-editor');
        (field ?? panel).focus();
      },
      { injector: this.injector },
    );
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
