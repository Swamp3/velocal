/**
 * SQL condition that is true for events that do not belong to a suspended
 * community (events without a community always pass). `eventAlias` is the
 * query-builder alias of the events table.
 */
export function notInSuspendedCommunitySql(eventAlias = 'event'): string {
  return `(${eventAlias}.community_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM communities sc
    WHERE sc.id = ${eventAlias}.community_id AND sc.suspended_at IS NOT NULL
  ))`;
}
