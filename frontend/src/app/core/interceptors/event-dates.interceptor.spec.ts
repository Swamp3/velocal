import { localDayOf } from './event-dates.interceptor';

describe('localDayOf', () => {
  it('keeps the German calendar day as local midnight', () => {
    // 22.11.2026 00:00 in Berlin is 21.11. 23:00 UTC.
    const local = new Date(localDayOf('2026-11-21T23:00:00.000Z'));
    expect([local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours()]).toEqual([
      2026, 11, 22, 0,
    ]);
    // Summer time: 01.07.2026 00:00 in Berlin is 30.06. 22:00 UTC.
    expect(new Date(localDayOf('2026-06-30T22:00:00.000Z')).getDate()).toBe(1);
  });
});
