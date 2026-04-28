import { CyclingEvent } from '@shared/models';
import { hasTime } from './event-date';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIcsDate(iso: string): string {
  const d = new Date(iso);
  if (!hasTime(iso)) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

function escapeIcs(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateIcs(event: CyclingEvent): string {
  const allDay = !hasTime(event.startDate);
  const dtStart = allDay
    ? `DTSTART;VALUE=DATE:${formatIcsDate(event.startDate)}`
    : `DTSTART:${formatIcsDate(event.startDate)}`;
  const dtEnd = allDay
    ? `DTEND;VALUE=DATE:${formatIcsDate(event.endDate || event.startDate)}`
    : `DTEND:${formatIcsDate(event.endDate || event.startDate)}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VeloCal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcs(event.name)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs([event.locationName, event.address].filter(Boolean).join(', '))}`,
    `URL:https://velocal.cc/events/${event.id}`,
    `UID:${event.id}@velocal.cc`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(event: CyclingEvent): void {
  const icsContent = generateIcs(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatGoogleDate(iso: string): string {
  const d = new Date(iso);
  if (!hasTime(iso)) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

export function googleCalendarUrl(event: CyclingEvent): string {
  const start = formatGoogleDate(event.startDate);
  const end = formatGoogleDate(event.endDate || event.startDate);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${start}/${end}`,
    details: event.description || '',
    location: [event.locationName, event.address].filter(Boolean).join(', '),
    sprop: 'website:velocal.cc',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CyclingEvent): string {
  const params = new URLSearchParams({
    subject: event.name,
    startdt: event.startDate,
    enddt: event.endDate || event.startDate,
    body: event.description || '',
    location: [event.locationName, event.address].filter(Boolean).join(', '),
    path: '/calendar/action/compose',
    rru: 'addevent',
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}
