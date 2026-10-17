import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent } from '@shared/ui/card/card.component';

/**
 * One block of the profile page: a card with the same heading, optional description and
 * spacing everywhere, so the page reads as an even list of sections.
 * `tone="danger"` is for the account-deletion block.
 */
@Component({
  selector: 'app-profile-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  host: { class: 'block' },
  template: `
    <ui-card [class]="tone() === 'danger' ? dangerClasses : ''">
      <header class="mb-5">
        <h2
          class="text-lg font-semibold"
          [class]="
            tone() === 'danger' ? 'text-red-800 dark:text-red-400' : 'text-[var(--color-text)]'
          "
        >
          {{ title() }}
          @if (count() !== null) {
            <span class="ml-1 text-sm font-normal text-[var(--color-text-muted)]"
              >({{ count() }})</span
            >
          }
        </h2>
        @if (description()) {
          <p class="mt-1 text-sm text-[var(--color-text-muted)]">{{ description() }}</p>
        }
      </header>
      <div class="space-y-5">
        <ng-content />
      </div>
    </ui-card>
  `,
})
export class ProfileSectionComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly count = input<number | null>(null);
  readonly tone = input<'default' | 'danger'>('default');

  protected readonly dangerClasses =
    '!border-red-300 !bg-red-50 dark:!border-red-800 dark:!bg-red-900/10';
}
