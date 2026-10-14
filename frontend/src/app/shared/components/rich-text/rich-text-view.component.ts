import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toDisplayHtml } from './rich-text';

@Component({
  selector: 'app-rich-text-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (html()) {
      <div
        class="prose prose-sm dark:prose-invert max-w-none break-words prose-headings:text-[var(--color-text)] prose-p:text-[var(--color-text)] prose-a:text-[var(--color-primary)] prose-strong:text-[var(--color-text)] prose-li:text-[var(--color-text)]"
        [class.line-clamp-3]="clamp()"
        [innerHTML]="html()"
      ></div>
    }
  `,
})
export class RichTextViewComponent {
  readonly value = input<string | null>(null);
  readonly clamp = input(false);

  protected readonly html = computed(() => toDisplayHtml(this.value()));
}
