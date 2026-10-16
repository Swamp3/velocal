import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconButtonComponent } from '@shared/ui/icon-button/icon-button.component';
import { AppUpdateService } from '@core/services/app-update.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ButtonComponent, IconButtonComponent],
  template: `
    @if (update.updateReady() && !dismissed()) {
      <div
        role="status"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-elevated)]"
      >
        <span>{{ 'app.update.available' | transloco }}</span>
        <span class="flex shrink-0 items-center gap-2">
          <ui-button size="sm" (click)="update.apply()">
            {{ 'app.update.reload' | transloco }}
          </ui-button>
          <button
            type="button"
            uiIconButton
            size="sm"
            icon="close"
            [label]="'common.close' | transloco"
            (click)="dismissed.set(true)"
          ></button>
        </span>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  protected readonly update = inject(AppUpdateService);
  protected readonly dismissed = signal(false);
}
