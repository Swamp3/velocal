import { birthYears } from './event-class';

describe('event classes', () => {
  it('turns ages into years of birth', () => {
    expect(birthYears({ ageMin: 13, ageMax: 14 }, 2026)).toEqual({ from: 2012, to: 2013 });
    expect(birthYears({ ageMin: 19, ageMax: null }, 2026)).toEqual({ from: null, to: 2007 });
    expect(birthYears({ ageMin: null, ageMax: null }, 2026)).toBeNull();
  });
});
