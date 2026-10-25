import {
  categoryForAge,
  classAges,
  classFitCondition,
  disciplineFor,
  eventFitsSql,
  inferFormat,
  licenseClassesForAge,
  type RiderProfile,
} from './racing';

const rider = (over: Partial<RiderProfile> = {}): RiderProfile => ({
  birthYear: null,
  gender: null,
  licenseType: null,
  licenseClass: null,
  ...over,
});

describe('age categories', () => {
  it('derives the category from the age reached in the year', () => {
    expect(categoryForAge(5).key).toBe('u7');
    expect(categoryForAge(8).key).toBe('u9');
    expect(categoryForAge(14).key).toBe('u15');
    expect(categoryForAge(22).key).toBe('u23');
    expect(categoryForAge(45).key).toBe('masters2');
    expect(categoryForAge(70).key).toBe('masters4');
  });

  it('fills missing class ages from the category; given ages win', () => {
    expect(classAges('u15', null, null)).toEqual({ ageMin: 13, ageMax: 14 });
    expect(classAges('u15', 12, null)).toEqual({ ageMin: 12, ageMax: 14 });
    expect(classAges(null, null, null)).toEqual({ ageMin: null, ageMax: null });
  });

  it('offers licence classes by age', () => {
    expect(licenseClassesForAge(17)).toEqual([]);
    expect(licenseClassesForAge(25)).toEqual(['elite_amateur', 'amateur']);
    expect(licenseClassesForAge(35)).toEqual([
      'elite_amateur',
      'amateur',
      'master',
    ]);
  });
});

describe('formats', () => {
  it('reads the format from the name', () => {
    expect(inferFormat('42. RTF Rund um den Kahlen Asten')).toBe('rtf');
    expect(inferFormat('22. RST Lübeck O-CTF')).toBe('ctf');
    expect(inferFormat('Radmarathon Tannheimer Tal')).toBe('marathon');
    expect(inferFormat('ARA Schönbuch: 600 km Early Bird')).toBe('brevet');
    expect(inferFormat('Brevet 200 – Nachts durchs Braunkohlerevier')).toBe(
      'brevet',
    );
    expect(inferFormat('Jedermannrennen Rund um Köln')).toBe('jedermann');
    expect(inferFormat('47. Bitterfelder Goitzsche Gravelride')).toBe(
      'gravel_ride',
    );
    expect(inferFormat('Fette-Reifen-Rennen Bolanden')).toBe('kids');
    expect(inferFormat('RTF Münster mit Fette-Reifen-Rennen')).toBe('rtf');
  });

  it('says nothing for plain race names', () => {
    expect(inferFormat('Großer Preis von Buir')).toBeNull();
    expect(inferFormat('MTB-Marathon Willingen')).toBeNull();
    expect(inferFormat('Niederrhein Gravel Race')).toBeNull();
  });

  it('gives "Breitensport" events of a known format their bike type', () => {
    expect(disciplineFor('breitensport', 'rtf')).toBe('strasse');
    expect(disciplineFor('breitensport', 'ctf')).toBe('mtb');
    expect(disciplineFor('breitensport', 'gravel_ride')).toBe('gravel');
    expect(disciplineFor('breitensport', 'tour')).toBe('breitensport');
    expect(disciplineFor('breitensport', null)).toBe('breitensport');
    expect(disciplineFor('gravel', 'ctf')).toBe('gravel');
  });
});

describe('fits me', () => {
  it('excludes nothing the rider did not state', () => {
    expect(classFitCondition(rider())).toEqual({ sql: 'TRUE', params: {} });
  });

  it('lets riders without licence start in Hobby and day-licence classes', () => {
    const { sql } = classFitCondition(rider({ licenseType: 'none' }));
    expect(sql).toContain(`fc.license IN ('open', 'unlicensed')`);
    expect(sql).toContain(`fc.license = 'license' AND fc.day_license`);
  });

  it('checks age, gender and licence class of licensed riders', () => {
    const fit = classFitCondition(
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

  it('keeps kids races without classes from licensed riders', () => {
    expect(eventFitsSql(rider({ licenseType: 'license' })).sql).toContain(
      `event.format = 'kids' AND FALSE`,
    );
  });
});
