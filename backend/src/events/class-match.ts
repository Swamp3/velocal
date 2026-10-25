/** What a rider told us about themselves for finding fitting race classes. */
export interface RiderProfile {
  birthYear: number | null;
  gender: 'male' | 'female' | 'diverse' | null;
  licenseType: 'none' | 'license' | 'uci' | null;
  licenseClass: 'elite_amateur' | 'amateur' | 'master' | null;
}

/**
 * Whether one of an event's classes fits the rider, as SQL for the event search (the browser has
 * the same rule as `classFits` in `shared/utils/event-class.ts`). Ages count by year of birth;
 * unknown profile data excludes nothing; "diverse" may start in any gender class. Hobby classes
 * (`unlicensed`) are only for riders without licence; `license` classes need a licence unless they
 * allow a day licence; `uci` classes need a UCI licence; `license_classes` admits only those
 * licence classes. Uses the alias `event` and named parameters prefixed with `fit`.
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
