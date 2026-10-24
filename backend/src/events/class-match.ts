/** What a rider told us about themselves for finding fitting race classes. */
export interface RiderProfile {
  birthYear: number | null;
  gender: 'male' | 'female' | 'diverse' | null;
  licenseType: 'none' | 'hobby' | 'license' | null;
}

export interface ClassRequirements {
  gender: 'open' | 'male' | 'female';
  ageMin: number | null;
  ageMax: number | null;
  license: 'none' | 'hobby' | 'license';
}

const LICENSE_RANK = { none: 0, hobby: 1, license: 2 } as const;

/**
 * Whether a rider may start in a class. Ages count by year of birth: the age reached in the
 * event's year. Unknown profile data does not exclude a class; a rider who chose "diverse" may
 * start in any gender class.
 */
export function classFits(cls: ClassRequirements, rider: RiderProfile, eventYear: number): boolean {
  if (rider.birthYear != null) {
    const age = eventYear - rider.birthYear;
    if (cls.ageMin != null && age < cls.ageMin) return false;
    if (cls.ageMax != null && age > cls.ageMax) return false;
  }
  if (cls.gender !== 'open' && (rider.gender === 'male' || rider.gender === 'female')) {
    if (cls.gender !== rider.gender) return false;
  }
  if (rider.licenseType != null && LICENSE_RANK[cls.license] > LICENSE_RANK[rider.licenseType]) {
    return false;
  }
  return true;
}

/**
 * The same rule as SQL for the event search: an event fits when at least one of its classes
 * fits. Uses the alias `event` and named parameters prefixed with `fit`.
 */
export function classFitsSql(rider: RiderProfile): { sql: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (rider.birthYear != null) {
    params.fitBirthYear = rider.birthYear;
    const age = `(EXTRACT(YEAR FROM (event.startDate AT TIME ZONE 'Europe/Berlin'))::int - :fitBirthYear)`;
    conditions.push(`(fc.age_min IS NULL OR ${age} >= fc.age_min)`, `(fc.age_max IS NULL OR ${age} <= fc.age_max)`);
  }
  if (rider.gender === 'male' || rider.gender === 'female') {
    params.fitGender = rider.gender;
    conditions.push(`(fc.gender = 'open' OR fc.gender::text = :fitGender)`);
  }
  if (rider.licenseType != null) {
    const allowed = Object.entries(LICENSE_RANK)
      .filter(([, rank]) => rank <= LICENSE_RANK[rider.licenseType!])
      .map(([name]) => name);
    params.fitLicenses = allowed;
    conditions.push(`fc.license::text IN (:...fitLicenses)`);
  }
  const where = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
  return {
    sql: `EXISTS (SELECT 1 FROM "event_classes" fc WHERE fc.event_id = event.id${where})`,
    params,
  };
}
