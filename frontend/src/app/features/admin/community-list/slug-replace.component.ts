import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService, SlugChange } from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonComponent, ToastService } from '@shared/ui';

type Target = 'communities' | 'subgroups' | 'both';

/** Admin tool: replace a piece of text in the addresses (slugs) of communities and subgroups. */
@Component({
  selector: 'app-admin-slug-replace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe, ButtonComponent],
  template: `
    <details
      class="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
    >
      <summary class="cursor-pointer text-sm font-medium text-[var(--color-text)]">
        {{ 'admin.communities.slug.title' | transloco }}
      </summary>
      <p class="mt-2 text-sm text-[var(--color-text-muted)]">
        {{ 'admin.communities.slug.hint' | transloco }}
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label class="text-sm text-[var(--color-text-muted)]">
          {{ 'admin.communities.slug.find' | transloco }}
          <input
            [ngModel]="find()"
            (ngModelChange)="find.set($event); changes.set(null)"
            class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </label>
        <label class="text-sm text-[var(--color-text-muted)]">
          {{ 'admin.communities.slug.replace' | transloco }}
          <input
            [ngModel]="replace()"
            (ngModelChange)="replace.set($event); changes.set(null)"
            class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </label>
        <label class="text-sm text-[var(--color-text-muted)]">
          {{ 'admin.communities.slug.target' | transloco }}
          <select
            [ngModel]="target()"
            (ngModelChange)="target.set($event); changes.set(null)"
            class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="both">{{ 'admin.communities.slug.both' | transloco }}</option>
            <option value="communities">{{ 'admin.communities.slug.communities' | transloco }}</option>
            <option value="subgroups">{{ 'admin.communities.slug.subgroups' | transloco }}</option>
          </select>
        </label>
      </div>
      <div class="mt-3">
        <ui-button
          type="button"
          variant="secondary"
          [loading]="busy()"
          [disabled]="busy() || !find().trim()"
          (click)="preview()"
        >
          {{ 'admin.communities.slug.preview' | transloco }}
        </ui-button>
      </div>

      @if (changes(); as list) {
        @if (list.length === 0) {
          <p class="mt-3 text-sm text-[var(--color-text-muted)]">
            {{ 'admin.communities.slug.none' | transloco }}
          </p>
        } @else {
          <ul class="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            @for (change of list; track change.id) {
              <li class="flex items-start gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  class="mt-1"
                  [checked]="selected().has(change.id)"
                  [disabled]="!!change.problem"
                  (change)="toggle(change.id)"
                />
                <div class="min-w-0">
                  <p class="break-words text-[var(--color-text)]">{{ change.name }}</p>
                  <p class="break-all font-mono text-xs text-[var(--color-text-muted)]">
                    /{{ change.oldSlug }} → /{{ change.newSlug }}
                  </p>
                  @if (change.problem) {
                    <p class="text-xs text-red-600 dark:text-red-400">
                      {{ 'admin.communities.slug.problem.' + change.problem | transloco }}
                    </p>
                  }
                </div>
              </li>
            }
          </ul>
          <div class="mt-3">
            <ui-button
              type="button"
              [loading]="busy()"
              [disabled]="busy() || selected().size === 0"
              (click)="apply()"
            >
              {{ 'admin.communities.slug.apply' | transloco: { count: selected().size } }}
            </ui-button>
          </div>
        }
      }
    </details>
  `,
})
export class SlugReplaceComponent {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  /** Emitted after addresses were changed, so the list can reload. */
  readonly applied = output<void>();

  protected readonly find = signal('');
  protected readonly replace = signal('');
  protected readonly target = signal<Target>('both');
  protected readonly changes = signal<SlugChange[] | null>(null);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);

  protected preview(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.admin
      .replaceSlugs({ find: this.find(), replace: this.replace(), target: this.target() })
      .subscribe({
        next: (res) => {
          this.changes.set(res.changes);
          // Everything that works is ticked; clashes can't be applied.
          this.selected.set(new Set(res.changes.filter((c) => !c.problem).map((c) => c.id)));
          this.busy.set(false);
        },
        error: () => this.fail(),
      });
  }

  protected toggle(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected apply(): void {
    if (this.busy() || this.selected().size === 0) return;
    this.busy.set(true);
    this.admin
      .replaceSlugs({
        find: this.find(),
        replace: this.replace(),
        target: this.target(),
        apply: true,
        ids: [...this.selected()],
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.changes.set(null);
          this.toast.success(
            this.transloco.translate('admin.communities.slug.done', { count: res.changes.length }),
          );
          this.applied.emit();
        },
        error: () => this.fail(),
      });
  }

  private fail(): void {
    this.busy.set(false);
    this.toast.error(this.transloco.translate('admin.communities.slug.error'));
  }
}
