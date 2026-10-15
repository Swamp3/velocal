import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppUpdateService } from '@core/services/app-update.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (update.updateReady() && !dismissed()) {
      <div
        role="status"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-elevated)]"
      >
        <span>{{ 'app.update.available' | transloco }}</span>
        <span class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="rounded-[var(--radius-default)] bg-[var(--color-primary)] px-3 py-1.5 font-medium text-white hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            (click)="update.apply()"
          >
            {{ 'app.update.reload' | transloco }}
          </button>
          <button
            type="button"
            class="rounded-[var(--radius-default)] px-2 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            [attr.aria-label]="'common.close' | transloco"
            (click)="dismissed.set(true)"
          >
            ✕
          </button>
        </span>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  protected readonly update = inject(AppUpdateService);
  protected readonly dismissed = signal(false);
}
