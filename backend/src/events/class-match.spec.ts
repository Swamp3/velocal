import { classFits, ClassRequirements, RiderProfile } from './class-match';

const cls = (over: Partial<ClassRequirements> = {}): ClassRequirements => ({
  gender: 'open',
  ageMin: null,
  ageMax: null,
  license: 'open',
  dayLicense: false,
  licenseClasses: null,
  ...over,
});
const rider = (over: Partial<RiderProfile> = {}): RiderProfile => ({
  birthYear: null,
  gender: null,
  licenseType: null,
  licenseClass: null,
  ...over,
});

describe('classFits', () => {
  it('counts the age by year of birth', () => {
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
  });

  it('keeps Hobby classes for riders without licence', () => {
    const hobby = cls({ license: 'unlicensed' });
    expect(classFits(hobby, rider({ licenseType: 'none' }), 2026)).toBe(true);
    expect(classFits(hobby, rider({ licenseType: 'license' }), 2026)).toBe(
      false,
    );
  });

  it('needs a licence for licence races unless a day licence is offered', () => {
    expect(
      classFits(
        cls({ license: 'license' }),
        rider({ licenseType: 'none' }),
        2026,
      ),
    ).toBe(false);
    expect(
      classFits(
        cls({ license: 'license', dayLicense: true }),
        rider({ licenseType: 'none' }),
        2026,
      ),
    ).toBe(true);
    expect(
      classFits(
        cls({ license: 'license' }),
        rider({ licenseType: 'uci' }),
        2026,
      ),
    ).toBe(true);
    expect(
      classFits(
        cls({ license: 'uci' }),
        rider({ licenseType: 'license' }),
        2026,
      ),
    ).toBe(false);
  });

  it('respects licence classes', () => {
    const amateurs = cls({
      license: 'license',
      licenseClasses: ['amateur', 'master'],
    });
    expect(
      classFits(
        amateurs,
        rider({ licenseType: 'license', licenseClass: 'amateur' }),
        2026,
      ),
    ).toBe(true);
    expect(
      classFits(
        amateurs,
        rider({ licenseType: 'license', licenseClass: 'elite_amateur' }),
        2026,
      ),
    ).toBe(false);
    expect(classFits(amateurs, rider({ licenseType: 'license' }), 2026)).toBe(
      true,
    );
  });

  it('does not exclude anything the rider did not state', () => {
    expect(
      classFits(
        cls({ ageMin: 17, ageMax: 18, gender: 'female', license: 'uci' }),
        rider(),
        2026,
      ),
    ).toBe(true);
  });
});
