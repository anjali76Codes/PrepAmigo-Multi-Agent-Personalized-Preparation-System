# Plans and Progress API

The Node backend exposes authenticated APIs for plans, sprints, sprint days, and progress. All routes below are mounted under `/api` and accept the existing session cookie or `Authorization: Bearer <token>`.

In non-production mode, the auth middleware creates/uses a local MongoDB user when no token is provided. Production always requires a valid JWT. Resource ownership is scoped to the authenticated user; do not provide `user_id` in request bodies.

## Plans

### `POST /api/plans`

Create a plan. `user_id`, `sprints`, status, and completion percentage are managed by the server.

```json
{
  "plan_name": "Acme SDE Interview Prep",
  "company": "Acme",
  "role": "SDE",
  "total_days": 28,
  "start_date": "2026-10-01",
  "end_date": "2026-10-28"
}
```

Returns HTTP 201 with `success`, `message`, `id`, `plan_id`, and the created document in `data`.

### `GET /api/plans`

Returns all plans owned by the authenticated user, newest first, with sprint summary fields populated.

### `GET /api/plans/:planId`

Returns one owned plan with its sprints and each sprint's days populated.

### `GET /api/plans/:planId/summary`

Returns plan fields plus sprint/day counts and compact progress data; does not return every day/reference document.

## Sprints

### `POST /api/plans/:planId/sprints`

Create a sprint under the path plan. The same controller is also available at `POST /api/sprints` when `plan_id` is included in the body.

```json
{
  "sprint_number": 1,
  "sprint_name": "Foundations",
  "start_date": "2026-10-01",
  "end_date": "2026-10-07",
  "total_days": 7
}
```

The backend checks plan ownership, stores `plan_id`, and adds the sprint ObjectId to `Plan.sprints`. Returns HTTP 201 with `id`, `sprint_id`, and the created document.

### `GET /api/plans/:planId/sprints`

Returns the plan's sprint summaries ordered by `sprint_number`.

### `GET /api/sprints/:sprintId`

Returns one owned sprint with its days populated.

## Sprint Days

### `POST /api/sprints/:sprintId/days`

Create a day under the path sprint. The same controller is available at `POST /api/sprint-days` when `sprint_id` is in the body.

```json
{
  "day_number": 1,
  "scheduled_date": "2026-10-01",
  "topic_title": "Arrays and Hash Maps",
  "topic_description": "Core patterns and tradeoffs",
  "objectives": ["Recognize common array patterns"],
  "estimated_minutes": 90,
  "references": [
    {
      "type": "documentation",
      "title": "Language reference",
      "url": "https://example.com/docs",
      "source": "Example",
      "description": "Reading for the day",
      "is_required": true
    }
  ]
}
```

The server checks ownership, stores `sprint_id`, and adds the day ObjectId to `Sprint.sprint_days`. Embedded references do not have their own ObjectIds. Returns HTTP 201 with `id`, `sprint_day_id`, and the created document.

### `GET /api/sprints/:sprintId/days`

Returns the sprint's days ordered by `day_number`.

### `GET /api/sprint-days/:dayId`

Returns one day if its parent sprint and plan belong to the authenticated user.

### `POST /api/sprint-days/:dayId/start`

Marks an unfinished day `in_progress` and advances its parent sprint/plan from `pending` to `in_progress`.

### `POST /api/sprint-days/:dayId/complete`

Marks the day completed and updates sprint/plan status and percentages. Repeating this request is safe: the day is not awarded XP twice.

## Progress APIs

### `POST /api/plans/:planId/progress`

Initialize the plan's progress document (zero XP, no completed days or trophies) or return the existing one. This is idempotent and returns `progress_id`.

### `GET /api/plans/:planId/progress`

Returns one plan's XP, completed day count, weekly bonuses, streak, and trophies. Returns a zero-valued progress object if none exists yet.

### `GET /api/progress`

Returns the user's aggregate XP and streak across plans, earned trophies, and per-plan progress.

## Progress Algorithm

Progress is calculated by the server from persisted SprintDay completion state:

- **Daily XP:** 20 XP for each distinct SprintDay completed in a plan. A unique `completed_day_ids` claim and a unique `(user_id, plan_id)` progress record make repeated completion requests idempotent.
- **Weekly bonus:** an additional 100 XP for every seven distinct SprintDays completed in that plan (`7`, `14`, `21`, ...). Bonus count updates are atomic, so retries do not double-award.
- **Streak:** completing at least one SprintDay on a UTC calendar date counts as one active day. The current streak is the latest run of consecutive dates and resets after a gap longer than one day; the longest streak is retained. Multiple day completions on the same date do not increase the streak more than once.
- **First sprint trophy:** awarded when the first sprint reaches completed status.
- **Halfway trophy:** awarded when at least `ceil(total sprints / 2)` sprints are complete.
- **75% trophy:** awarded when plan completion reaches 75%, measured against `Plan.total_days`.
- **Completion trophy:** awarded when completed SprintDays meet or exceed `Plan.total_days`.

Trophy keys are `first_sprint`, `half_sprints`, `plan_75_percent`, and `plan_complete`. Each key is stored once per plan progress record.

## MongoDB References

The registered model references are:

- `User.plans` → `Plan`
- `Plan.user_id` → `User`
- `Plan.sprints` → `Sprint`
- `Sprint.plan_id` → `Plan`
- `Sprint.sprint_days` → `SprintDay`
- `SprintDay.sprint_id` → `Sprint`
- `PlanProgress.user_id` → `User`
- `PlanProgress.plan_id` → `Plan`
- `PlanProgress.completed_day_ids` → `SprintDay`

`backend/src/config/db.ts` imports the model registry before connecting, and `backend/src/index.ts` waits for MongoDB before opening the HTTP listener.

## Backend Folder Map

- `backend/src/controllers/plan.controller.ts`: plan creation, list, detail, and summary handlers.
- `backend/src/controllers/sprint.controller.ts`: sprint creation, list, and detail handlers.
- `backend/src/controllers/sprintDay.controller.ts`: sprint-day creation, detail, start, and completion handlers.
- `backend/src/controllers/progress.controller.ts`: per-plan initialization/read and user aggregate progress handlers.
- `backend/src/routes/plans.routes.ts`: authenticated plan endpoints.
- `backend/src/routes/sprints.routes.ts`: authenticated sprint endpoints.
- `backend/src/routes/sprint-days.routes.ts`: authenticated sprint-day and completion endpoints.
- `backend/src/routes/progress.routes.ts`: progress initialization and read endpoints.
- `backend/src/routes/index.ts`: central API router registration for the separate resource routes, agents, and Job Intelligence.
- `backend/src/middlewares/auth.middleware.ts`: shared JWT authentication and the local-development user bootstrap.
- `backend/src/utils/planProgress.ts`: idempotent XP claims, weekly bonuses, trophy awards, and UTC streak calculation.
- `backend/src/utils/planApi.ts`: shared validation schemas, ownership lookups, and response/error helpers.
- `backend/src/models/`: Mongoose schemas and ObjectId references.
