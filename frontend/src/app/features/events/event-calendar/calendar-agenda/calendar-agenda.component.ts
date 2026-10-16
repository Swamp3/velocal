import {
    afterRenderEffect,
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { CyclingEvent } from '@shared/models';
import { formatTime } from '@shared/utils/event-date';
import { DisciplineChipComponent } from '@shared/components/discipline-chip/discipline-chip.component';

interface AgendaDay {
    dateKey: string;
    date: Date;
    events: CyclingEvent[];
}

@Component({
    selector: 'app-calendar-agenda',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, DatePipe, TranslocoPipe, DisciplineChipComponent],
    templateUrl: './calendar-agenda.component.html',
})
export class CalendarAgendaComponent {
    readonly events = input.required<Map<string, CyclingEvent[]>>();
    readonly currentDate = input.required<Date>();
    readonly selectedDay = input<string | null>(null);
    /** Changes whenever the parent wants the agenda to jump to today again. */
    readonly scrollTick = input(0);

    /** Month (yyyy-mm) whose past days the user opened. */
    private readonly expandedMonth = signal<string | null>(null);
    private lastScrollKey = '';

    readonly agendaDays = computed((): AgendaDay[] => {
        const eventsMap = this.events();
        const d = this.currentDate();

        const from = new Date(d.getFullYear(), d.getMonth(), 1);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        const days: AgendaDay[] = [];
        const cursor = new Date(from);

        while (cursor <= to) {
            const dateKey = this.toKey(cursor);
            const dayEvents = eventsMap.get(dateKey);
            if (dayEvents?.length) {
                days.push({
                    dateKey,
                    date: new Date(cursor),
                    events: dayEvents,
                });
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        return days;
    });

    readonly todayKey = computed(() => this.toKey(new Date()));

    private readonly monthKey = computed(() => this.toKey(this.currentDate()).slice(0, 7));

    /** Past days are only folded away in the month that contains today. */
    readonly isCurrentMonth = computed(() => this.monthKey() === this.todayKey().slice(0, 7));

    readonly pastDays = computed(() =>
        this.isCurrentMonth() ? this.agendaDays().filter((d) => d.dateKey < this.todayKey()) : [],
    );
    readonly pastEventCount = computed(() =>
        this.pastDays().reduce((sum, d) => sum + d.events.length, 0),
    );
    readonly pastOpen = computed(() => this.expandedMonth() === this.monthKey());

    readonly visibleDays = computed(() => {
        const days = this.agendaDays();
        if (!this.pastDays().length || this.pastOpen()) return days;
        return days.filter((d) => d.dateKey >= this.todayKey());
    });

    constructor() {
        // A selected day in the folded part opens it, so the jump has a target.
        afterRenderEffect(() => {
            const selected = this.selectedDay();
            if (selected && this.pastDays().some((d) => d.dateKey === selected)) {
                this.expandedMonth.set(this.monthKey());
            }
        });

        afterRenderEffect(() => {
            const selected = this.selectedDay();
            const tick = this.scrollTick();
            const month = this.monthKey();
            const days = this.visibleDays();
            const key = `${month}|${selected ?? ''}|${tick}`;
            if (key === this.lastScrollKey) return;
            let target: string | undefined;
            if (selected) {
                target = days.find((d) => d.dateKey === selected)?.dateKey;
            } else if (this.isCurrentMonth() && (this.pastOpen() || tick > 0)) {
                // Today, or the next day that has something on. With the past
                // folded away the list already starts there, so only jump when
                // it is open or the user asked.
                target = days.find((d) => d.dateKey >= this.todayKey())?.dateKey;
            }
            this.lastScrollKey = key;
            if (!target || typeof document === 'undefined') return;
            document
                .getElementById(`agenda-${target}`)
                ?.scrollIntoView({ behavior: tick > 0 || selected ? 'smooth' : 'auto', block: 'start' });
        });
    }

    protected togglePast(): void {
        this.expandedMonth.set(this.pastOpen() ? null : this.monthKey());
    }

    protected formatTime = formatTime;

    private toKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
