import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, switchMap, tap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { EventService, EventSearchParams } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { CyclingEvent, Discipline } from '@shared/models';
import { SkeletonComponent } from '@shared/ui';
import { DisciplineFilterComponent } from '@shared/components/discipline-filter/discipline-filter.component';
import { CalendarMonthGridComponent } from './calendar-month-grid/calendar-month-grid.component';
import { CalendarAgendaComponent } from './calendar-agenda/calendar-agenda.component';
import { CalendarDayStripComponent } from './calendar-day-strip/calendar-day-strip.component';

@Component({
    selector: 'app-event-calendar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslocoPipe, RouterLink, SkeletonComponent, DisciplineFilterComponent, CalendarMonthGridComponent, CalendarAgendaComponent, CalendarDayStripComponent],
    templateUrl: './event-calendar.component.html',
})
export class EventCalendarComponent implements OnInit {
    private readonly eventService = inject(EventService);
    private readonly disciplineService = inject(DisciplineService);
    readonly filterStateService = inject(FilterStateService);
    private readonly destroyRef = inject(DestroyRef);

    readonly currentDate = signal(new Date());
    readonly viewMode = signal<'month' | 'week'>('month');
    readonly events = signal<CyclingEvent[]>([]);
    readonly loading = signal(false);
    readonly disciplines = signal<Discipline[]>([]);
    readonly isMobile = signal(false);
    readonly selectedDay = signal<string | null>(null);

    private readonly fetch$ = new Subject<void>();
    private mediaQuery?: MediaQueryList;

    readonly eventsByDate = computed(() => {
        const map = new Map<string, CyclingEvent[]>();
        for (const event of this.events()) {
            const key = event.startDate.slice(0, 10);
            const list = map.get(key) ?? [];
            list.push(event);
            map.set(key, list);
        }
        return map;
    });

    readonly eventDates = computed(() => new Set(this.eventsByDate().keys()));

    readonly dateRange = computed(() => {
        const d = this.currentDate();
        if (this.viewMode() === 'week' && !this.isMobile()) {
            const day = d.getDay();
            const mondayOffset = day === 0 ? -6 : 1 - day;
            const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
            const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
            return { from: monday, to: sunday };
        }
        const from = new Date(d.getFullYear(), d.getMonth(), 1);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        from.setDate(from.getDate() - from.getDay() + (from.getDay() === 0 ? -6 : 1));
        to.setDate(to.getDate() + (7 - to.getDay()) % 7);
        return { from, to };
    });

    readonly monthLabel = computed(() => {
        const d = this.currentDate();
        return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    });

    constructor() {
        effect(() => {
            this.currentDate();
            this.viewMode();
            this.filterStateService.selectedDisciplines();
            this.isMobile();
            this.fetch$.next();
        });
    }

    ngOnInit(): void {
        this.setupMediaQuery();

        this.disciplineService
            .getDisciplines()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((d) => this.disciplines.set(d));

        this.fetch$
            .pipe(
                tap(() => this.loading.set(true)),
                switchMap(() => {
                    const range = this.dateRange();
                    const params: EventSearchParams = {
                        from: this.toISODate(range.from),
                        to: this.toISODate(range.to),
                        limit: 500,
                        discipline: this.filterStateService.selectedDisciplines().length ? this.filterStateService.selectedDisciplines().join(',') : undefined,
                    };
                    return this.eventService.getEvents(params);
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: (res) => {
                    this.events.set(res.data);
                    this.loading.set(false);
                },
                error: () => this.loading.set(false),
            });
    }

    navigateMonth(delta: number): void {
        const d = this.currentDate();
        this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + delta, 1));
        this.selectedDay.set(null);
    }

    navigateWeek(delta: number): void {
        const d = this.currentDate();
        this.currentDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7));
    }

    goToToday(): void {
        this.currentDate.set(new Date());
        this.selectedDay.set(null);
    }

    onViewModeChange(mode: 'month' | 'week'): void {
        this.viewMode.set(mode);
    }

    onDisciplineChange(slugs: string[]): void {
        this.filterStateService.setDisciplines(slugs);
    }

    onDaySelected(date: string): void {
        this.selectedDay.set(this.selectedDay() === date ? null : date);
    }

    onStripDateSelected(date: Date): void {
        this.currentDate.set(date);
        this.selectedDay.set(this.toISODate(date));
    }

    onStripWeekChanged(date: Date): void {
        this.currentDate.set(date);
    }

    private setupMediaQuery(): void {
        if (typeof window === 'undefined') return;
        this.mediaQuery = window.matchMedia('(max-width: 767px)');
        this.isMobile.set(this.mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
        this.mediaQuery.addEventListener('change', handler);
        this.destroyRef.onDestroy(() => this.mediaQuery?.removeEventListener('change', handler));
    }

    private toISODate(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
