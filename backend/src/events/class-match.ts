/** What a rider told us about themselves for finding fitting race classes. */
export interface RiderProfile {
  birthYear: number | null;
  gender: 'male' | 'female' | 'diverse' | null;
  licenseType: 'none' | 'license' | 'uci' | null;
  licenseClass: 'elite_amateur' | 'amateur' | 'master' | null;
}

export interface ClassRequirements {
  gender: 'open' | 'male' | 'female';
  ageMin: number | null;
  ageMax: number | null;
  license: 'open' | 'unlicensed' | 'license' | 'uci';
  dayLicense: boolean;
  licenseClasses: string[] | null;
}

/**
 * Whether a rider may start in a class. Ages count by year of birth: the age reached in the
 * event's year. Unknown profile data does not exclude a class; a rider who chose "diverse" may
 * start in any gender class.
 *
 * Licences: `unlicensed` classes (Hobby) are only for riders without a licence; `license` classes
 * need a federation or UCI licence, or allow a day licence; `uci` classes need a UCI licence.
 * A class limited to licence classes (Elite Amateure, Amateure, Masters) admits only those.
 */
export function classFits(
  cls: ClassRequirements,
  rider: RiderProfile,
  eventYear: number,
): boolean {
  if (rider.birthYear != null) {
    const age = eventYear - rider.birthYear;
    if (cls.ageMin != null && age < cls.ageMin) return false;
    if (cls.ageMax != null && age > cls.ageMax) return false;
  }
  if (
    cls.gender !== 'open' &&
    (rider.gender === 'male' || rider.gender === 'female')
  ) {
    if (cls.gender !== rider.gender) return false;
  }
  const licensed =
    rider.licenseType === 'license' || rider.licenseType === 'uci';
  if (rider.licenseType != null) {
    if (cls.license === 'unlicensed' && licensed) return false;
    if (cls.license === 'license' && !licensed && !cls.dayLicense) return false;
    if (cls.license === 'uci' && rider.licenseType !== 'uci') return false;
  }
  if (
    licensed &&
    rider.licenseClass != null &&
    cls.licenseClasses?.length &&
    !cls.licenseClasses.includes(rider.licenseClass)
  ) {
    return false;
  }
  return true;
}

/**
 * The same rule as SQL for the event search: an event fits when at least one of its classes
 * fits. Uses the alias `event` and named parameters prefixed with `fit`.
 */
export function classFitsSql(rider: RiderProfile): {
  sql: string;
  params: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (rider.birthYear != null) {
    params.fitBirthYear = rider.birthYear;
    const age = `(EXTRACT(YEAR FROM (event.startDate AT TIME ZONE 'Europe/Berlin'))::int - :fitBirthYear)`;
    conditions.push(
      `(fc.age_min IS NULL OR ${age} >= fc.age_min)`,
      `(fc.age_max IS NULL OR ${age} <= fc.age_max)`,
    );
  }
  if (rider.gender === 'male' || rider.gender === 'female') {
    params.fitGender = rider.gender;
    conditions.push(`(fc.gender = 'open' OR fc.gender::text = :fitGender)`);
  }
  const licensed =
    rider.licenseType === 'license' || rider.licenseType === 'uci';
  if (rider.licenseType === 'none') {
    conditions.push(
      `(fc.license IN ('open', 'unlicensed') OR (fc.license = 'license' AND fc.day_license))`,
    );
  } else if (rider.licenseType === 'license') {
    conditions.push(`fc.license IN ('open', 'license')`);
  } else if (rider.licenseType === 'uci') {
    conditions.push(`fc.license IN ('open', 'license', 'uci')`);
  }
  if (licensed && rider.licenseClass != null) {
    params.fitLicenseClass = rider.licenseClass;
    conditions.push(
      `(fc.license_classes IS NULL OR cardinality(fc.license_classes) = 0 OR :fitLicenseClass = ANY(fc.license_classes))`,
    );
  }
  const where = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
  return {
    sql: `EXISTS (SELECT 1 FROM "event_classes" fc WHERE fc.event_id = event.id${where})`,
    params,
  };
}
