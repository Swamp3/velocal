import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

interface StripDay {
    date: Date;
    dateKey: string;
    dayNumber: number;
    dayLabel: string;
    isToday: boolean;
    hasEvents: boolean;
}

@Component({
    selector: 'app-calendar-day-strip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './calendar-day-strip.component.html',
})
export class CalendarDayStripComponent {
    readonly currentDate = input.required<Date>();
    readonly eventDates = input.required<Set<string>>();
    readonly dateSelected = output<Date>();
    readonly weekChanged = output<Date>();

    private readonly dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    readonly weekDays = computed((): StripDay[] => {
        const d = this.currentDate();
        const dayOfWeek = d.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
        const today = this.todayKey();
        const dates = this.eventDates();

        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            const dateKey = this.toKey(date);
            return {
                date,
                dateKey,
                dayNumber: date.getDate(),
                dayLabel: this.dayLabels[date.getDay()],
                isToday: dateKey === today,
                hasEvents: dates.has(dateKey),
            };
        });
    });

    readonly selectedKey = computed(() => this.toKey(this.currentDate()));

    prevWeek(): void {
        const d = this.currentDate();
        this.weekChanged.emit(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    }

    nextWeek(): void {
        const d = this.currentDate();
        this.weekChanged.emit(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    }

    selectDay(day: StripDay): void {
        this.dateSelected.emit(day.date);
    }

    private todayKey(): string {
        return this.toKey(new Date());
    }

    private toKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
