# Contributing to PrepAmigo

Thank you for taking the time to improve PrepAmigo. Contributions can include bug fixes, tests, documentation, accessibility improvements, and focused feature work.

## Before you start

1. Check existing issues and pull requests for related work.
2. For a substantial feature or behavior change, open a feature proposal first so the scope can be discussed.
3. For security concerns, follow [SECURITY.md](SECURITY.md); do not disclose vulnerability details in a public issue.

## Development setup

Follow the root [README setup instructions](README.md#getting-started) for prerequisites and local service configuration. Each service has its own dependencies and environment:

- `frontend/` — Node.js, npm, and its `.env.example`.
- `backend/` — Node.js, npm, MongoDB, and its `.env.example`.
- `agents-service/` — Python 3.11+, uv, and its `.env.example`; Ollama is the default model provider.

Keep real credentials and local `.env` files out of commits. Use the committed examples and redact personal data, access tokens, and private URLs from logs and screenshots.

## Making a change

- Keep changes focused on one issue or behavior.
- Follow the patterns and formatting used in the service being changed.
- Add or update tests for behavior changes where practical.
- Update the relevant README or guide when setup, API behavior, configuration, or user-visible behavior changes.
- Avoid committing build output, local data, caches, or generated files.

## Run checks

From the repository root, run the checks for every service you change:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend run build
```

For the Python service:

```powershell
cd agents-service
uv run pytest
```

If a check cannot be run because a service or external provider is unavailable, mention that in the pull request and include any narrower checks you did run.

## Pull requests

Open a pull request against the default branch and include:

- The problem and why the change is needed.
- A concise summary of the implementation and any tradeoffs.
- The checks run and their results.
- Screenshots or a short recording for UI changes.
- Any configuration, API, migration, or documentation implications.

Keep the pull request reviewable: avoid unrelated formatting or dependency changes, and call out known limitations. Be responsive to review feedback and update the description when the implementation changes.
