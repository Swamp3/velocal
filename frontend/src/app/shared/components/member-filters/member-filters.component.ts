import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SegmentedComponent, SegmentedOption } from '@shared/ui';

/**
 * Search box and role filter above a member list. `searched` fires shortly after typing stops,
 * so the parent can ask the server for each text without a request per key.
 */
@Component({
  selector: 'app-member-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, SegmentedComponent],
  host: { class: 'flex flex-col gap-3 sm:flex-row sm:items-center' },
  template: `
    <div class="relative flex-1">
      <span
        class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-text-muted)]"
        aria-hidden="true"
        >search</span
      >
      <input
        type="search"
        autocomplete="off"
        [placeholder]="'communities.members.filterPlaceholder' | transloco"
        [attr.aria-label]="'communities.members.filterPlaceholder' | transloco"
        (input)="onInput($event)"
        class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
      />
    </div>
    <ui-segmented
      [options]="roleOptions()"
      [value]="role()"
      [ariaLabel]="'communities.members.filterRole' | transloco"
      (valueChange)="roleChange.emit($event)"
    />
  `,
})
export class MemberFiltersComponent {
  readonly roleOptions = input.required<SegmentedOption<string>[]>();
  readonly role = input.required<string>();
  readonly searched = output<string>();
  readonly roleChange = output<string>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.searched.emit(text.trim()), 300);
  }
}
