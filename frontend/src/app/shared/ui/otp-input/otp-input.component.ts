import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const DIGIT_COUNT = 6;

@Component({
  selector: 'ui-otp-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OtpInputComponent),
      multi: true,
    },
  ],
  templateUrl: './otp-input.component.html',
  host: { class: 'block' },
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly completed = output<string>();

  protected readonly digits = signal<string[]>(Array(DIGIT_COUNT).fill(''));
  protected readonly isDisabled = signal(false);
  protected readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string): void {
    const chars = (val || '').split('').slice(0, DIGIT_COUNT);
    const padded = [...chars, ...Array(DIGIT_COUNT - chars.length).fill('')];
    this.digits.set(padded);
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }

  protected onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    const updated = [...this.digits()];

    if (value.length > 1) {
      this.handlePaste(value);
      return;
    }

    updated[index] = value.slice(-1);
    this.digits.set(updated);
    this.emitValue(updated);

    if (value && index < DIGIT_COUNT - 1) {
      this.focusInput(index + 1);
    }
  }

  protected onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const updated = [...this.digits()];
      if (!updated[index] && index > 0) {
        updated[index - 1] = '';
        this.digits.set(updated);
        this.emitValue(updated);
        this.focusInput(index - 1);
        event.preventDefault();
      }
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      this.focusInput(index - 1);
    }
    if (event.key === 'ArrowRight' && index < DIGIT_COUNT - 1) {
      this.focusInput(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') || '';
    const digits = text.replace(/\D/g, '');
    if (digits) {
      this.handlePaste(digits);
    }
  }

  protected onFocus(): void {
    this.onTouched();
  }

  private handlePaste(digits: string): void {
    const chars = digits.split('').slice(0, DIGIT_COUNT);
    const padded = [...chars, ...Array(DIGIT_COUNT - chars.length).fill('')];
    this.digits.set(padded);
    this.emitValue(padded);

    const focusIdx = Math.min(chars.length, DIGIT_COUNT - 1);
    this.focusInput(focusIdx);
  }

  private emitValue(digits: string[]): void {
    const code = digits.join('');
    this.onChange(code);
    if (code.length === DIGIT_COUNT) {
      this.completed.emit(code);
    }
  }

  private focusInput(index: number): void {
    const inputEls = this.inputs();
    if (inputEls[index]) {
      setTimeout(() => inputEls[index].nativeElement.focus());
    }
  }
}
