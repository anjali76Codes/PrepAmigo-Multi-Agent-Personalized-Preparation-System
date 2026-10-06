# Study Materials Pipeline

How PrepAmigo generates each sprint's quiz questions and flashcards, saves them, and learns from the results.

## 1. Flow

```
Plan saved (backend)
   │
   ├─► ensureStudyMaterial(sprint 1)            backend/src/services/studyMaterial.ts
   │        │  days without material
   │        ▼
   │   POST /internal/study-material             agents-service (stateless)
   │        │  one model call per 3-4 days -> {questions, cards}, validated
   │        ▼
   │   Assessment + Flashcard documents          saved by the backend, linked to their days
   │
   ├─► sprint completed  -> ensureStudyMaterial(next sprint)
   └─► GET /api/assessments (or /api/flashcards): the requested sprint, or each plan's current
       sprint (first not completed), is generated in the background if it has no material yet;
       the response says `generating: true`. This also covers plans saved by the CLI.
```

The agents service never writes to MongoDB (`agents-service/MAINTENANCE.md`): the backend sends the days and saves what comes back.

**Just in time**: material is generated sprint by sprint, as the user gets there. Nothing is paid for sprints nobody reaches, plan generation is not slowed down, and a later sprint is personalised by the results of earlier ones.

**Idempotent**: only days without an assessment are sent, and a sprint is never generated twice at once. A chunk the model could not write is retried the next time the sprint is requested.

## 2. Chunks

A sprint's days are cut into consecutive chunks of 3-4 days (a 7-day sprint: days 1-4 and 5-7). Each chunk gets **one** model call that returns 8 multiple-choice questions and 6 flashcards, grounded in the days' titles, descriptions, objectives, reference titles and the topic's key concepts (`concepts` on each sprint day).

Every item is validated on its own; invalid ones are dropped, not the whole chunk:

- a question has exactly 4 distinct options and `correct_answer` is the letter of the right one (`A`-`D`), which is what the quiz grades against; an answer given as option text is converted
- `difficulty` is `easy`, `medium` or `hard`
- every item carries the `concept` it tests

An unusable answer is evicted from the response cache and retried once with a corrective instruction. Each chunk reports `ok`, `partial` or `failed`.

## 3. Results and the knowledge graph

- `POST /api/assessments/:id/attempt` `{answers: ["B", null, …]}`: graded on the server (`is_correct`, `score`, counts).
- `POST /api/flashcards/:id/review` `{ratings: [1|3|5, …]}`: Hard / Okay / Easy saved as `confidence_level`.

Both send per-concept results to the agents service (`POST /internal/knowledge/attempt`), which updates the user's knowledge graph (Neo4j): each concept's proficiency is a running average, below 0.4 is **weak**, from 0.85 **mastered**. The next sprint's material tests weak concepts more and skips mastered ones; a re-plan skips mastered skills.

## 4. Operations

| Task | Command |
| :--- | :--- |
| Generate material for plans saved before this existed | `npm run backfill:study-material` (backend; optional plan id) |
| Generate one sprint's material and wait for it | `POST /api/sprints/:sprintId/study-material` |
| Grade generated material with an LLM judge | `uv run python scripts/evaluate_generation.py` (agents-service, dev dependencies) |
| Clear plans and study material from a dev database | `uv run python scripts/clear_db.py` (agents-service, dev dependencies) |

The two Python scripts read `MONGODB_URI` from `agents-service/.env`.
