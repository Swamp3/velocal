import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-workouts-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span class="text-6xl">🏋️</span>
      <h1 class="text-3xl font-bold text-[var(--color-text)]">
        {{ 'workouts.title' | transloco }}
      </h1>
      <p class="text-lg text-[var(--color-text-muted)]">
        {{ 'workouts.comingSoon' | transloco }}
      </p>
    </div>
  `,
})
export class WorkoutsPlaceholderComponent {}
