import { birthYears, classFits } from './event-class';
import type { EventClass } from '@shared/models';

const cls = (over: Partial<EventClass> = {}): EventClass => ({
  name: 'X',
  gender: 'open',
  ageMin: null,
  ageMax: null,
  license: 'none',
  startTime: null,
  championship: null,
  note: null,
  ...over,
});

describe('event classes', () => {
  it('matches like the server', () => {
    expect(classFits(cls({ ageMin: 13, ageMax: 14 }), { birthYear: 2012 }, 2026)).toBe(true);
    expect(classFits(cls({ ageMin: 13, ageMax: 14 }), { birthYear: 2011 }, 2026)).toBe(false);
    expect(classFits(cls({ gender: 'female' }), { gender: 'male' }, 2026)).toBe(false);
    expect(classFits(cls({ license: 'license' }), { licenseType: 'hobby' }, 2026)).toBe(false);
  });

  it('turns ages into years of birth', () => {
    expect(birthYears(cls({ ageMin: 13, ageMax: 14 }), 2026)).toEqual({ from: 2012, to: 2013 });
    expect(birthYears(cls({ ageMin: 19 }), 2026)).toEqual({ from: null, to: 2007 });
    expect(birthYears(cls(), 2026)).toBeNull();
  });
});
