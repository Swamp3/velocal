import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { TranslocoPipe } from '@jsverse/transloco';
import type { EventClass } from '@shared/models';
import { birthYears, classFits, hasRiderData } from '@shared/utils/event-class';

/** Rating classes of an event; marks the ones that fit the signed-in rider. */
@Component({
  selector: 'app-event-classes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DatePipe, RouterLink],
  template: `
    <section class="mt-8" aria-labelledby="classes-heading">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="classes-heading" class="text-lg font-semibold text-[var(--color-text)]">
          {{ 'classes.title' | transloco }}
        </h2>
        @if (auth.isAuthenticated()) {
          @if (riderKnown()) {
            <span class="text-xs text-[var(--color-text-muted)]">
              {{ 'classes.fitCount' | transloco: { count: fitCount(), total: classes().length } }}
            </span>
          } @else {
            <a routerLink="/profile" fragment="rider" class="text-xs text-[var(--color-primary)] hover:underline">
              {{ 'classes.setProfile' | transloco }}
            </a>
          }
        }
      </div>
      <ul class="mt-3 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        @for (row of rows(); track $index) {
          <li class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-2 font-medium text-[var(--color-text)]">
                {{ row.cls.name }}
                @if (row.fits) {
                  <span class="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">how_to_reg</span>
                    {{ 'classes.fitsYou' | transloco }}
                  </span>
                }
                @if (row.cls.championship) {
                  <span class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">emoji_events</span>
                    {{ 'classes.championship.' + row.cls.championship | transloco }}
                  </span>
                }
              </p>
              <p class="mt-0.5 text-xs text-[var(--color-text-muted)]">
                @if (row.years; as y) {
                  @if (y.from && y.to) {
                    {{ 'classes.years' | transloco: { from: y.from, to: y.to } }}
                  } @else if (y.to) {
                    {{ 'classes.yearsAndOlder' | transloco: { year: y.to } }}
                  } @else {
                    {{ 'classes.yearsAndYounger' | transloco: { year: y.from } }}
                  }
                } @else {
                  {{ 'classes.allAges' | transloco }}
                }
                · {{ 'classes.gender.' + row.cls.gender | transloco }}
                · {{ 'classes.license.' + row.cls.license | transloco }}
                @if (row.cls.license === 'license' && row.cls.dayLicense) {
                  · {{ 'classes.dayLicense' | transloco }}
                }
                @if (row.cls.licenseClasses?.length) {
                  · @for (lc of row.cls.licenseClasses; track lc; let last = $last) {{{ 'classes.licenseClass.' + lc | transloco }}@if (!last) {, }}
                }
              </p>
              @if (row.cls.note) {
                <p class="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">{{ row.cls.note }}</p>
              }
            </div>
            @if (row.cls.startTime) {
              <span class="shrink-0 tabular-nums text-[var(--color-text)]">
                {{ 'classes.start' | transloco }} {{ row.cls.startTime | date: 'HH:mm' }}
              </span>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class EventClassesComponent {
  protected readonly auth = inject(AuthService);

  readonly classes = input.required<EventClass[]>();
  readonly startDate = input.required<string>();

  private readonly year = computed(() => new Date(this.startDate()).getFullYear());
  protected readonly riderKnown = computed(() => hasRiderData(this.auth.currentUser()));

  protected readonly rows = computed(() => {
    const rider = this.auth.currentUser();
    const known = this.riderKnown();
    return this.classes().map((cls) => ({
      cls,
      years: birthYears(cls, this.year()),
      fits: known && !!rider && classFits(cls, rider, this.year()),
    }));
  });

  protected readonly fitCount = computed(() => this.rows().filter((r) => r.fits).length);
}
