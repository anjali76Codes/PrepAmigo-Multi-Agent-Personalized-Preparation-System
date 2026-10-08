# PrepAmigo frontend

The frontend is a React 19 and TypeScript single-page application built with Vite. It provides the preparation workspace, chat and agent activity views, study plans, practice and progress screens, and reusable UI components.

Some pages and flows use local demo data. Authentication, plan and progress APIs, notifications, and agent-streaming workflows can use the backend services when configured; the frontend is not a standalone production deployment.

## Run locally

From this directory:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The Vite development server normally runs at `http://localhost:5173`. Start the Express API separately; the example `VITE_API_URL` points to `http://localhost:3000`. See the root [Getting started guide](../README.md#getting-started) for the backend, agent service, database, and local provider setup.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the Express backend. Defaults to `http://localhost:3000`. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID when using Google sign-in. |
| `VITE_ENABLE_AUTH` | Enables the frontend Google OAuth/JWT authentication flow when set to `true`. |
| `VITE_ENABLE_SERPAPI` | Shows SerpApi-backed search features when set to `true`; backend credentials are configured separately. |

Vite exposes `VITE_*` variables to browser code. Do not put secrets in frontend environment variables.

## Useful commands

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

`npm run preview` serves the compiled build locally after `npm run build`.

## Source layout

- `src/pages/` — route-level screens.
- `src/components/` — shared UI, layout, chat, assessment, and preparation components.
- `src/lib/api/` — HTTP API clients.
- `src/lib/agentStream/` — agent event-stream client and hooks.
- `src/context/` and `src/hooks/` — shared application and feature state.
- `src/data/` and `src/mocks/` — local sample and mock data.
