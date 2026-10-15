import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  ViewEncapsulation,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { normalizeRichText } from './rich-text';

@Component({
  selector: 'app-rich-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, QuillEditorComponent],
  templateUrl: './rich-text.component.html',
  styleUrls: ['../../../../../node_modules/quill/dist/quill.snow.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextComponent),
      multi: true,
    },
  ],
})
export class RichTextComponent implements ControlValueAccessor {
  readonly placeholder = input('');
  readonly compact = input(false);

  private readonly platformId = inject(PLATFORM_ID);
  protected readonly isBrowser = isPlatformBrowser(this.platformId);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'link'],
      ['clean'],
    ],
  };

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected changed(value: string | null): void {
    const raw = value ?? '';
    this.value.set(raw);
    this.onChange(normalizeRichText(raw));
    this.onTouched();
  }
}
