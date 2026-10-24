import { classFits } from './class-match';

const cls = (over = {}) => ({ gender: 'open' as const, ageMin: null, ageMax: null, license: 'none' as const, ...over });
const rider = (over = {}) => ({ birthYear: null, gender: null, licenseType: null, ...over });

describe('classFits', () => {
  it('counts the age by year of birth', () => {
    // U15: ages 13 and 14 in the event year.
    const u15 = cls({ ageMin: 13, ageMax: 14 });
    expect(classFits(u15, rider({ birthYear: 2013 }), 2026)).toBe(true);
    expect(classFits(u15, rider({ birthYear: 2012 }), 2026)).toBe(true);
    expect(classFits(u15, rider({ birthYear: 2011 }), 2026)).toBe(false);
    expect(classFits(u15, rider({ birthYear: 2014 }), 2026)).toBe(false);
  });

  it('checks gender, diverse riders may start anywhere', () => {
    const women = cls({ gender: 'female' });
    expect(classFits(women, rider({ gender: 'female' }), 2026)).toBe(true);
    expect(classFits(women, rider({ gender: 'male' }), 2026)).toBe(false);
    expect(classFits(women, rider({ gender: 'diverse' }), 2026)).toBe(true);
    expect(classFits(cls(), rider({ gender: 'male' }), 2026)).toBe(true);
  });

  it('needs at least the required licence', () => {
    const licensed = cls({ license: 'license' });
    const hobby = cls({ license: 'hobby' });
    expect(classFits(licensed, rider({ licenseType: 'hobby' }), 2026)).toBe(false);
    expect(classFits(licensed, rider({ licenseType: 'license' }), 2026)).toBe(true);
    expect(classFits(hobby, rider({ licenseType: 'none' }), 2026)).toBe(false);
    expect(classFits(cls(), rider({ licenseType: 'none' }), 2026)).toBe(true);
  });

  it('does not exclude anything the rider did not state', () => {
    expect(classFits(cls({ ageMin: 17, ageMax: 18, gender: 'female', license: 'license' }), rider(), 2026)).toBe(true);
  });
});
