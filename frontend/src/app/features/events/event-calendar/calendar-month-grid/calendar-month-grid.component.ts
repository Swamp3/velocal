import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { CyclingEvent } from '@shared/models';
import { DisciplineChipComponent } from '@shared/components/discipline-chip/discipline-chip.component';

interface CalendarDay {
    date: Date;
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CyclingEvent[];
}

const MAX_VISIBLE_EVENTS = 3;

@Component({
    selector: 'app-calendar-month-grid',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, DatePipe, TranslocoPipe, DisciplineChipComponent],
    templateUrl: './calendar-month-grid.component.html',
})
export class CalendarMonthGridComponent {
    readonly events = input.required<Map<string, CyclingEvent[]>>();
    readonly currentDate = input.required<Date>();
    readonly viewMode = input<'month' | 'week'>('month');
    readonly selectedDay = input<string | null>(null);
    readonly daySelected = output<string>();

    readonly weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    readonly calendarDays = computed(() => {
        const d = this.currentDate();
        const eventsMap = this.events();

        if (this.viewMode() === 'week') {
            return this.buildWeekDays(d, eventsMap);
        }
        return this.buildMonthDays(d, eventsMap);
    });

    readonly selectedDayEvents = computed((): CyclingEvent[] => {
        const key = this.selectedDay();
        if (!key) return [];
        return this.events().get(key) ?? [];
    });

    protected maxVisibleEvents = MAX_VISIBLE_EVENTS;

    protected overflowCount(day: CalendarDay): number {
        return Math.max(0, day.events.length - MAX_VISIBLE_EVENTS);
    }

    protected onDayClick(day: CalendarDay): void {
        this.daySelected.emit(day.dateKey);
    }

    private buildMonthDays(d: Date, eventsMap: Map<string, CyclingEvent[]>): CalendarDay[] {
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);

        let startDay = firstOfMonth.getDay() - 1;
        if (startDay < 0) startDay = 6;

        const startDate = new Date(year, month, 1 - startDay);
        const totalCells = Math.ceil((startDay + lastOfMonth.getDate()) / 7) * 7;

        const today = this.todayKey();
        const days: CalendarDay[] = [];

        for (let i = 0; i < totalCells; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
            const dateKey = this.toKey(date);
            days.push({
                date,
                dateKey,
                dayNumber: date.getDate(),
                isCurrentMonth: date.getMonth() === month,
                isToday: dateKey === today,
                events: eventsMap.get(dateKey) ?? [],
            });
        }

        return days;
    }

    private buildWeekDays(d: Date, eventsMap: Map<string, CyclingEvent[]>): CalendarDay[] {
        const day = d.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
        const today = this.todayKey();

        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            const dateKey = this.toKey(date);
            return {
                date,
                dateKey,
                dayNumber: date.getDate(),
                isCurrentMonth: true,
                isToday: dateKey === today,
                events: eventsMap.get(dateKey) ?? [],
            };
        });
    }

    private todayKey(): string {
        return this.toKey(new Date());
    }

    private toKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
