import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  IconButtonComponent,
  type IconButtonSize,
  type IconButtonVariant,
} from '../icon-button/icon-button.component';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  /** Red text for destructive actions. */
  danger?: boolean;
  disabled?: boolean;
  /** Opens this address in a new tab instead of emitting `selected` (e.g. a maps link). */
  href?: string;
}

/**
 * "More" menu behind an icon button, for the less common actions of a page or row:
 * `<ui-action-menu [items]="items" label="More actions" (selected)="run($event)" />`.
 * Put the one or two main actions next to it as icon buttons.
 */
@Component({
  selector: 'ui-action-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  host: { class: 'relative inline-block' },
  template: `
    <button
      type="button"
      uiIconButton
      [icon]="icon()"
      [variant]="variant()"
      [size]="size()"
      [label]="label()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    ></button>

    @if (open()) {
      <div
        role="menu"
        [class]="align() === 'start' ? 'left-0' : 'right-0'"
        class="absolute z-40 mt-1 w-max min-w-[12rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-[var(--shadow-elevated)]"
        (keydown.escape)="open.set(false)"
      >
        @for (item of items(); track item.id) {
          @if (item.href) {
            <a
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
              [href]="item.href"
              target="_blank"
              rel="noopener noreferrer"
              (click)="open.set(false)"
            >
              @if (item.icon) {
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{
                  item.icon
                }}</span>
              }
              {{ item.label }}
            </a>
          } @else {
            <button
              type="button"
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-alt)] disabled:pointer-events-none disabled:opacity-50"
              [class]="item.danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'"
              [disabled]="item.disabled"
              (click)="pick(item.id)"
            >
              @if (item.icon) {
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{
                  item.icon
                }}</span>
              }
              {{ item.label }}
            </button>
          }
        }
      </div>
    }
  `,
})
export class ActionMenuComponent {
  readonly items = input.required<ActionMenuItem[]>();
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('outline');
  readonly size = input<IconButtonSize>('md');
  readonly icon = input('more_vert');
  /** Which edge of the button the menu lines up with; use `start` when the button sits near the left of the screen. */
  readonly align = input<'start' | 'end'>('end');
  readonly selected = output<string>();

  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected pick(id: string): void {
    this.open.set(false);
    this.selected.emit(id);
  }
}
