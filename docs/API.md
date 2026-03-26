# API Reference

| Method | Endpoint                           | Auth     | Description                    |
| ------ | ---------------------------------- | -------- | ------------------------------ |
| POST   | `/api/auth/register`               | No       | Create account                 |
| POST   | `/api/auth/login`                  | No       | Log in, receive JWT            |
| GET    | `/api/events`                      | Optional | List/search/filter events      |
| GET    | `/api/events/:id`                  | Optional | Event detail                   |
| GET    | `/api/disciplines`                 | No       | All disciplines                |
| GET    | `/api/users/me`                    | JWT      | Current user profile           |
| PATCH  | `/api/users/me`                    | JWT      | Update profile                 |
| GET    | `/api/users/me/favorites`          | JWT      | List favorites                 |
| POST   | `/api/users/me/favorites/:eventId` | JWT      | Add favorite                   |
| DELETE | `/api/users/me/favorites/:eventId` | JWT      | Remove favorite                |
| GET    | `/api/users/me/discipline-prefs`   | JWT      | Get discipline preferences     |
| PUT    | `/api/users/me/discipline-prefs`   | JWT      | Set discipline preferences     |
| POST   | `/api/import/trigger`              | Admin    | Trigger event import           |
| GET    | `/api/import/sources`              | Admin    | List registered import sources |
