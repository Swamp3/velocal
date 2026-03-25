import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface DropdownOption {
  value: string;
  label: string;
}

@Component({
  selector: 'ui-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-block' },
  templateUrl: './dropdown.component.html',
})
export class DropdownComponent {
  readonly options = input<DropdownOption[]>([]);
  readonly value = input('');
  readonly placeholder = input('Select...');
  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  private readonly triggerEl = viewChild<ElementRef>('trigger');

  protected readonly selectedLabel = computed(() => {
    const match = this.options().find((o) => o.value === this.value());
    return match?.label ?? '';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const el = this.triggerEl()?.nativeElement as HTMLElement | undefined;
    if (el && !el.parentElement?.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected select(value: string): void {
    this.valueChange.emit(value);
    this.open.set(false);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
    }
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected onListKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
      this.triggerEl()?.nativeElement.focus();
    }
  }
}
