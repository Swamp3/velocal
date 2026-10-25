import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService, EventImportInfo } from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';

/** Admins only: where an imported event came from, checks of its sources and their conflicts. */
@Component({
  selector: 'app-event-import-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DatePipe, RouterLink],
  template: `
    @if (info(); as i) {
      <section
        class="mt-8 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm"
        aria-labelledby="import-info-heading"
      >
        <h2 id="import-info-heading" class="flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span>
          {{ 'events.importInfo.title' | transloco }}
        </h2>
        <dl class="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt class="text-[var(--color-text-muted)]">{{ 'events.importInfo.origin' | transloco }}</dt>
          <dd class="break-all text-[var(--color-text)]">
            {{ i.sourceName ?? i.source }} @if (i.externalId) { · {{ i.externalId }} }
          </dd>
          @if (i.importRun; as run) {
            <dt class="text-[var(--color-text-muted)]">{{ 'events.importInfo.run' | transloco }}</dt>
            <dd>
              <a [routerLink]="['/admin/imports', run.id]" class="text-[var(--color-primary)] hover:underline">
                {{ run.fileName ?? run.id }}
              </a>
              · {{ run.startedAt | date: 'medium' }}
            </dd>
          }
          @if (i.lastSeenAt) {
            <dt class="text-[var(--color-text-muted)]">{{ 'events.importInfo.lastSeen' | transloco }}</dt>
            <dd class="text-[var(--color-text)]">{{ i.lastSeenAt | date: 'medium' }}</dd>
          }
          @if (i.missingSince) {
            <dt class="text-[var(--color-danger)]">{{ 'events.importInfo.missingSince' | transloco }}</dt>
            <dd class="text-[var(--color-danger)]">{{ i.missingSince | date: 'medium' }}</dd>
          }
          @if (i.editedFields.length) {
            <dt class="text-[var(--color-text-muted)]">{{ 'events.importInfo.edited' | transloco }}</dt>
            <dd class="text-[var(--color-text)]">{{ i.editedFields.join(', ') }}</dd>
          }
        </dl>

        @if (i.sources.length) {
          <h3 class="mt-4 font-medium text-[var(--color-text)]">{{ 'events.importInfo.sources' | transloco }}</h3>
          <ul class="mt-1 space-y-1">
            @for (s of i.sources; track s.url) {
              <li class="break-words">
                <a [href]="s.url" target="_blank" rel="noopener noreferrer" class="text-[var(--color-primary)] hover:underline">{{ s.name }}</a>
                <span class="text-[var(--color-text-muted)]">
                  @if (s.checkedAt) { · {{ 'events.importInfo.checkedAt' | transloco: { date: s.checkedAt } }} }
                  @if (s.updatedAt) { · {{ 'events.importInfo.updatedAt' | transloco: { date: s.updatedAt } }} }
                </span>
              </li>
            }
          </ul>
        }

        @if (i.conflicts.length) {
          <h3 class="mt-4 font-medium text-amber-700 dark:text-amber-400">
            {{ 'events.importInfo.conflicts' | transloco: { count: i.conflicts.length } }}
          </h3>
          <ul class="mt-1 space-y-2">
            @for (c of i.conflicts; track $index) {
              <li class="rounded-lg bg-[var(--color-bg-alt)] p-3">
                <p class="font-medium text-[var(--color-text)]">{{ c.field }}</p>
                @if (c.values?.length) {
                  <ul class="mt-1 space-y-0.5 text-xs text-[var(--color-text-muted)]">
                    @for (v of c.values; track $index) {
                      <li class="break-words">{{ valueText(v) }}</li>
                    }
                  </ul>
                }
                @if (c.reason) {
                  <p class="mt-1 break-words text-[var(--color-text)]">{{ c.reason }}</p>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class EventImportInfoComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly eventId = input.required<string>();
  protected readonly info = signal<EventImportInfo | null>(null);

  ngOnInit(): void {
    this.admin.getEventImportInfo(this.eventId()).subscribe({ next: (info) => this.info.set(info) });
  }

  protected valueText(value: unknown): string {
    if (value && typeof value === 'object') {
      const v = value as { value?: unknown; source?: string; sourceUrl?: string };
      if ('value' in v) return `${String(v.value)}${v.source ? ` (${v.source})` : ''}`;
      return JSON.stringify(value);
    }
    return String(value);
  }
}
