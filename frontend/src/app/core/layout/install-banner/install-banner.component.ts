import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppUpdateService } from '@core/services/app-update.service';
import { InstallPromptService } from '@core/services/install-prompt.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconButtonComponent } from '@shared/ui/icon-button/icon-button.component';

@Component({
  selector: 'app-install-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ButtonComponent, IconButtonComponent],
  template: `
    @if (install.visible() && !update.updateReady()) {
      <div
        role="dialog"
        [attr.aria-label]="'app.install.title' | transloco"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-elevated)]"
      >
        <span class="min-w-0">
          <span class="block font-semibold">{{ 'app.install.title' | transloco }}</span>
          <span class="mt-0.5 block text-[var(--color-text-muted)]">
            {{ (install.isIos() ? 'app.install.ios' : 'app.install.text') | transloco }}
          </span>
        </span>
        <span class="flex shrink-0 items-center gap-2">
          @if (!install.isIos()) {
            <ui-button size="sm" (click)="install.install()">
              {{ 'app.install.action' | transloco }}
            </ui-button>
          }
          <button
            type="button"
            uiIconButton
            size="sm"
            icon="close"
            [label]="'app.install.dismiss' | transloco"
            (click)="install.dismiss()"
          ></button>
        </span>
      </div>
    }
  `,
})
export class InstallBannerComponent {
  protected readonly install = inject(InstallPromptService);
  protected readonly update = inject(AppUpdateService);
}
