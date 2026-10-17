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
import { IconButtonComponent, type IconButtonVariant } from '../icon-button/icon-button.component';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  /** Red text for destructive actions. */
  danger?: boolean;
  disabled?: boolean;
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
      icon="more_vert"
      [variant]="variant()"
      [label]="label()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    ></button>

    @if (open()) {
      <div
        role="menu"
        class="absolute right-0 z-40 mt-1 min-w-[16rem] overflow-hidden rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-[var(--shadow-elevated)]"
        (keydown.escape)="open.set(false)"
      >
        @for (item of items(); track item.id) {
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
      </div>
    }
  `,
})
export class ActionMenuComponent {
  readonly items = input.required<ActionMenuItem[]>();
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('outline');
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
