import { birthYears, categoryForAge, classFits, licenseClassesForAge } from './event-class';
import type { EventClass } from '@shared/models';

const cls = (over: Partial<EventClass> = {}): EventClass => ({
  name: 'X',
  gender: 'open',
  ageMin: null,
  ageMax: null,
  license: 'open',
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
    expect(classFits(cls({ license: 'license' }), { licenseType: 'none' }, 2026)).toBe(false);
    expect(classFits(cls({ license: 'license', dayLicense: true }), { licenseType: 'none' }, 2026)).toBe(true);
    expect(classFits(cls({ license: 'unlicensed' }), { licenseType: 'license' }, 2026)).toBe(false);
    expect(classFits(cls({ license: 'uci' }), { licenseType: 'license' }, 2026)).toBe(false);
    expect(
      classFits(cls({ license: 'license', licenseClasses: ['master'] }), { licenseType: 'license', licenseClass: 'amateur' }, 2026),
    ).toBe(false);
  });

  it('counts the age by year of birth', () => {
    const u15 = cls({ ageMin: 13, ageMax: 14 });
    expect(classFits(u15, { birthYear: 2013 }, 2026)).toBe(true);
    expect(classFits(u15, { birthYear: 2014 }, 2026)).toBe(false);
  });

  it('lets diverse riders start in any gender class', () => {
    expect(classFits(cls({ gender: 'female' }), { gender: 'diverse' }, 2026)).toBe(true);
  });

  it('admits licensed Jedermann riders only of the listed licence classes', () => {
    const jedermann = cls({ licenseClasses: ['amateur', 'master'] });
    expect(classFits(jedermann, { licenseType: 'none' }, 2026)).toBe(true);
    expect(classFits(jedermann, { licenseType: 'license', licenseClass: 'master' }, 2026)).toBe(true);
    expect(classFits(jedermann, { licenseType: 'license', licenseClass: 'elite_amateur' }, 2026)).toBe(false);
    expect(classFits(jedermann, { licenseType: 'license' }, 2026)).toBe(true);
  });

  it('accepts UCI riders in licence classes and excludes nothing unstated', () => {
    expect(classFits(cls({ license: 'license' }), { licenseType: 'uci' }, 2026)).toBe(true);
    expect(classFits(cls({ ageMin: 17, ageMax: 18, gender: 'female', license: 'uci' }), {}, 2026)).toBe(true);
  });

  it('derives category and licence classes from the age', () => {
    expect(categoryForAge(14)).toBe('u15');
    expect(categoryForAge(22)).toBe('u23');
    expect(categoryForAge(45)).toBe('masters2');
    expect(licenseClassesForAge(17)).toEqual([]);
    expect(licenseClassesForAge(25)).toEqual(['elite_amateur', 'amateur']);
    expect(licenseClassesForAge(35)).toContain('master');
  });

  it('turns ages into years of birth', () => {
    expect(birthYears(cls({ ageMin: 13, ageMax: 14 }), 2026)).toEqual({ from: 2012, to: 2013 });
    expect(birthYears(cls({ ageMin: 19 }), 2026)).toEqual({ from: null, to: 2007 });
    expect(birthYears(cls(), 2026)).toBeNull();
  });
});
