import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, ButtonComponent],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span class="text-6xl">🚴‍♂️</span>
      <h1 class="text-3xl font-bold text-[var(--color-text)]">404</h1>
      <p class="text-lg text-[var(--color-text-muted)]">
        {{ 'errors.notFoundMessage' | transloco }}
      </p>
      <a routerLink="/events">
        <ui-button>{{ 'errors.backToHome' | transloco }}</ui-button>
      </a>
    </div>
  `,
})
export class NotFoundComponent {}
