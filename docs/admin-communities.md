# Admin: reviewing and deleting communities

## Goal

Site admins need one place to see every community (private ones included), judge
whether it is healthy or abusive, and remove content or whole communities.
Community admins need to be able to delete their own community or subgroup.

## Scope

**Admin review UI** (`/admin/communities`, site admins only)

- List: name, slug, visibility, creator, created date, counts (members,
  subgroups, posts, polls, events) and open join requests. Search by name or
  slug, filter by visibility, sort by newest / name / members / open requests,
  paginated.
- Detail (`/admin/communities/:id`): description, location, Strava link, admins,
  subgroups with counts, the 20 newest posts and events.
- Actions: delete a post, delete a subgroup, delete the community.

**Delete for community and subgroup admins**

- "Danger zone" on the community and subgroup edit pages.
- Community: its admins or a site admin. Subgroup: community admins.
- Destructive actions ask the user to type the name before the button works.

## Design decisions

- Admin API is its own controller (`/api/admin/communities`) behind
  `JwtAuthGuard` + `AdminGuard`, using plain SQL with sub-select counts, so one
  list request is one query (no N+1).
- Deletion lives in one place, `CommunityCleanupService`. Database foreign keys
  already cascade to members, requests, posts, comments, polls, events, shares
  and RSVPs. The service adds what the database cannot do: remove uploaded files
  (event images, heroes, logos), delete inbox entries pointing at the deleted
  page, and drop repeat rules that lost all their events.
- Site admins review private communities in the admin UI, not by joining them,
  so reviewing leaves no trace in a community's member list.
- No soft delete / undo for now. The confirmation step is the safety net; take
  a database backup before large clean-ups.

## Out of scope (possible follow-ups)

- Suspending or hiding a community instead of deleting it.
- A report button for members and a queue of reports.
- Notifying members before a community is removed.
- Audit log of admin actions.
