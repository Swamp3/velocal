import { classFitsSql, RiderProfile } from './class-match';

const rider = (over: Partial<RiderProfile> = {}): RiderProfile => ({
  birthYear: null,
  gender: null,
  licenseType: null,
  licenseClass: null,
  ...over,
});

describe('classFitsSql', () => {
  it('excludes nothing the rider did not state', () => {
    const fit = classFitsSql(rider());
    expect(fit.sql).toBe(
      'EXISTS (SELECT 1 FROM "event_classes" fc WHERE fc.event_id = event.id)',
    );
    expect(fit.params).toEqual({});
  });

  it('lets riders without licence start in Hobby and day-licence classes', () => {
    const fit = classFitsSql(rider({ licenseType: 'none' }));
    expect(fit.sql).toContain(`fc.license IN ('open', 'unlicensed')`);
    expect(fit.sql).toContain(`fc.license = 'license' AND fc.day_license`);
  });

  it('checks age, gender and licence class of licensed riders', () => {
    const fit = classFitsSql(
      rider({
        birthYear: 1981,
        gender: 'male',
        licenseType: 'license',
        licenseClass: 'master',
      }),
    );
    expect(fit.params).toEqual({
      fitBirthYear: 1981,
      fitGender: 'male',
      fitLicenseClass: 'master',
    });
    expect(fit.sql).toContain(`fc.license IN ('open', 'license')`);
    expect(fit.sql).toContain(':fitLicenseClass = ANY(fc.license_classes)');
  });
});
