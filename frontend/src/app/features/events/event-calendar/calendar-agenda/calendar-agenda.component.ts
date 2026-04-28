import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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

    protected formatTime = formatTime;

    private toKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
