# API Reference

| Method | Endpoint                           | Auth     | Description                    |
| ------ | ---------------------------------- | -------- | ------------------------------ |
| POST   | `/api/auth/register`               | No       | Create account                 |
| POST   | `/api/auth/login`                  | No       | Log in, receive JWT            |
| GET    | `/api/events`                      | Optional | List/search/filter events. Members-only events are included only when the caller can see the host |
|        |                                    |          | Filters: `q`, `discipline` (comma list; `breitensport` also finds every touring format), `format` (comma list; `kids` also finds events with a class up to age 12), `fitsMe` (signed in), `championship`, `hideLeagues`, `from`, `to`, geo `zip`/`lat`/`lng`/`radius` |
| GET    | `/api/events/meta`                 | No       | Value lists for forms and filters: racing model (classes, licences, licence classes, age categories, championship levels, series kinds, formats; `backend/src/events/racing.ts`) and parking (kinds, fees; `backend/src/events/parking.ts`) |
| GET    | `/api/events/:id`                  | Optional | Event detail (with public `parkingAreas` and the straight-line `distanceM` to the venue), including the going count. Members-only events are 404 for outsiders | Classes carry `fitsYou` for a viewer with rider data |
| POST   | `/api/events/:id/invites`          | JWT      | Invite a host member by email. Host admins and moderators. Returns `outcome`, `emailed`, `emailSkipped` |
| POST   | `/api/events/:id/rsvp`             | JWT      | Set `going`, `maybe`, or `declined` |
| GET    | `/api/events/:id/rsvps`            | JWT      | RSVP names. Host admins and moderators, or the creator of an unhosted event |
| GET    | `/api/events/:id/comments`         | JWT      | Comments. Members of the host only |
| POST   | `/api/events/:id/comments`         | JWT      | Comment on a hosted event |
| DELETE | `/api/events/:id/comments/:commentId` | Author or host manager | Delete an event comment |
| GET    | `/api/notifications`               | JWT      | Latest 50 inbox rows |
| GET    | `/api/notifications/unread-count`  | JWT      | Unread count |
| POST   | `/api/notifications/read`          | JWT      | Mark every row read |
| POST   | `/api/notifications/:id/read`      | JWT      | Mark one row read |
| GET    | `/api/disciplines`                 | No       | All disciplines                |
| GET    | `/api/users/me`                    | JWT      | Current user profile           |
| PATCH  | `/api/users/me`                    | JWT      | Update profile                 |
| GET    | `/api/users/me/favorites`          | JWT      | List favorites                 |
| POST   | `/api/users/me/favorites/:eventId` | JWT      | Add favorite                   |
| DELETE | `/api/users/me/favorites/:eventId` | JWT      | Remove favorite                |
| GET    | `/api/users/me/discipline-prefs`   | JWT      | Get discipline preferences     |
| PUT    | `/api/users/me/discipline-prefs`   | JWT      | Set discipline preferences     |
| POST   | `/api/import/trigger`              | Admin    | Start import job (202, returns job) |
| GET    | `/api/import/jobs?limit=&offset=`  | Admin    | List import runs (persisted)   |
| GET    | `/api/import/jobs/:id`             | Admin    | Poll import job status         |
| GET    | `/api/import/sources`              | Admin    | List registered import sources |
| POST   | `/api/import/events/check?fileName=` | Admin  | Check an import file (JSON body) without writing; returns the report |
| POST   | `/api/import/events?fileName=&acceptWarnings=` | Admin | Import a file as a job; refused with the report on errors, or on warnings without `acceptWarnings=true` |
| GET    | `/api/import/jobs/:id/report`      | Admin    | Report of an import run |
| POST   | `/api/communities`                 | JWT      | Create a community; creator is admin |
| GET    | `/api/communities`                 | Optional | List public and request communities |
| GET    | `/api/communities/mine`            | JWT      | Communities the current user belongs to |
| GET    | `/api/communities/:slug`           | Optional | Community detail; private is 404 for non-members |
| PATCH  | `/api/communities/:id`             | Admin of that community | Update name, description, visibility |
| POST   | `/api/communities/:id/hero`        | Admin of that community | Upload hero image |
| DELETE | `/api/communities/:id/hero`        | Admin of that community | Remove hero image |
| POST   | `/api/communities/:id/logo`        | Admin of that community | Upload logo |
| DELETE | `/api/communities/:id/logo`        | Admin of that community | Remove logo |
| POST   | `/api/communities/:id/join`        | JWT      | Join (`public`) or open a request (`request`). `private` is 404 for non-members |
| POST   | `/api/communities/:id/leave`       | Member   | Leave. 409 if this drops the last admin |
| GET    | `/api/communities/:id/members`     | Member   | Member list |
| PATCH  | `/api/communities/:id/members/:userId` | Admin of that community | Set role `member` or `admin` |
| DELETE | `/api/communities/:id/members/:userId` | Admin of that community | Remove a member |
| GET    | `/api/communities/:id/join-requests` | Admin of that community | Pending join requests |
| POST   | `/api/communities/:id/join-requests/:requestId/approve` | Admin of that community | Approve a request |
| POST   | `/api/communities/:id/join-requests/:requestId/reject` | Admin of that community | Reject a request |
| POST   | `/api/communities/:id/invites` | Admin of that community | Add an existing user by email |
| GET    | `/api/communities/:slug/subgroups` | Optional | Subgroups the viewer may see |
| POST   | `/api/communities/:slug/subgroups` | Community admin | Create a subgroup |
| GET    | `/api/communities/:slug/subgroups/:subgroupSlug` | Optional | Subgroup detail. Invite-only is 404 for outsiders |
| PATCH  | `/api/communities/:slug/subgroups/:subgroupSlug` | Community admin or moderator | Update name and description. Visibility is community-admin only |
| DELETE | `/api/communities/:slug/subgroups/:subgroupSlug` | Community admin | Delete a subgroup |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/join` | Community member | Join an open subgroup or request a `request` subgroup |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/invites` | Community admin or moderator | Add a community member to the subgroup |
| GET    | `/api/communities/:slug/polls` | Member | Community-hosted polls |
| POST   | `/api/communities/:slug/polls` | Member | Create a poll. Two to twelve options |
| POST   | `/api/communities/:slug/polls/:pollId/votes` | Member | Replace the caller's vote. 409 when the poll is closed |
| DELETE | `/api/communities/:slug/polls/:pollId` | Author or community admin | Delete a poll |
| GET    | `/api/communities/:slug/posts` | Member | Community-hosted posts |
| POST   | `/api/communities/:slug/posts` | Member | Create a community-hosted post (`title`, `body`) |
| GET    | `/api/communities/:slug/events` | Optional | Upcoming events hosted by the community. Members-only rows are omitted for non-members |
| POST   | `/api/communities/:slug/events` | Community admin | Create a community event. `listing` defaults to `members` |
| GET    | `/api/communities/:slug/posts/:postId` | Member | One community-hosted post |
| DELETE | `/api/communities/:slug/posts/:postId` | Author or community admin | Delete a post |
| GET    | `/api/communities/:slug/posts/:postId/comments` | Member | Comments on a community post |
| POST   | `/api/communities/:slug/posts/:postId/comments` | Member | Comment on a community post |
| DELETE | `/api/communities/:slug/posts/:postId/comments/:commentId` | Author or community admin | Delete a comment |
| GET    | `/api/communities/:slug/subgroups/:subgroupSlug/polls` | Subgroup member or community admin | Subgroup-hosted polls |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/polls` | Subgroup member or community admin | Create a subgroup poll |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/polls/:pollId/votes` | Subgroup member or community admin | Replace the caller's vote |
| DELETE | `/api/communities/:slug/subgroups/:subgroupSlug/polls/:pollId` | Author, moderator, or community admin | Delete a subgroup poll |
| GET    | `/api/communities/:slug/subgroups/:subgroupSlug/posts` | Subgroup member or community admin | Subgroup-hosted posts |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/posts` | Subgroup member or community admin | Create a subgroup post (`title`, `body`) |
| GET    | `/api/communities/:slug/subgroups/:subgroupSlug/events` | Optional | Upcoming events hosted by the subgroup |
| POST   | `/api/communities/:slug/subgroups/:subgroupSlug/events` | Moderator or community admin | Create a subgroup event |
| DELETE | `/api/communities/:slug/subgroups/:subgroupSlug/posts/:postId` | Author, moderator, or community admin | Delete a subgroup post |
