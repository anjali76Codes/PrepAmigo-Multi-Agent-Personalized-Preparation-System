# PrepAmigo Voice Assistant

## Overview
The Voice Assistant is an in-app floating assistant that allows logged-in candidates to ask about their preparation using their voice (or text), hear spoken answers, and navigate to specific parts of the app, including a specific day or sprint in their plan.

## Intent Flow
1. **Input**: User speaks or types a query. Frontend sends transcript and session ID to `/api/voice/process`.
2. **Context Gathering**: Backend loads only the signed-in candidate's profile summary, plans, sprint/day status, progress, available assessments, and assessment results.
3. **Classification**: The transcript is evaluated using the configured Ollama model with strict data isolation. The intent is classified into one of:
   - `personal_data`: Asking about own prep/plan.
   - `navigation`: Asking to go somewhere.
   - `general_knowledge`: Anything else (will be forwarded to Research Agent).
4. **Fuzzy Resolution**: If a navigation intent is detected with fuzzy terms ("tomorrow", "DSA sprint"), the LLM resolves it to a concrete day or sprint number.
5. **Validation**: Target routes and parameters are verified against an allow-list and valid ranges. Unsafe or invalid answers are rejected with graceful fallbacks.
6. **Execution**: A spoken answer is synthesized on the client. Research questions are sent through the existing agent stream and the final agent response is spoken. For a requested plan day or sprint, the roadmap expands its containing sprint/level and scrolls directly to the selected item.

## Allow-listed Navigation Targets
- `plan`: Whole roadmap (`/roadmap`)
- `plan_day`: Specific plan day by its ordinal position (`/roadmap?day=X`)
- `plan_sprint`: Specific sprint (`/roadmap?sprint=Y`)
- `progress`: (`/progress`)
- `gaps`: Progress and skill gaps (`/progress`)
- `readiness`: Dashboard (`/dashboard`)
- `resources`: Resource Pack (`/resource-pack`)
- `profile`: Profile (`/profile`)
- `assessment`: Assessments (`/assessment`)
- `interview_prep`: Interview preparation (`/dashboard/interview-prep`)
- `calendar`: Calendar (`/calendar`)

`plan_day` uses the day’s ordinal position across the candidate’s active plan, while each day’s displayed number may restart within its sprint. Assessment counts come from assessment records actually available to that candidate, rather than an estimate based on plan length.

## Safety Rules
- Uses strict prompt isolation: transcript is treated as data, not instruction.
- The assistant is provided only the user's data; it will never discuss another user's data.
- The intent output is structurally enforced (JSON).
- Navigation is strictly allow-listed.

## Ollama Configuration
The voice assistant uses Ollama's `/api/chat` endpoint. By default, the backend connects to `http://localhost:11434` and uses `nemotron-3-nano:30b-cloud`. Override these with the backend environment variables `OLLAMA_BASE_URL` and `OLLAMA_MODEL` if needed. The `-cloud` model tag means Ollama routes inference to a cloud-hosted model, so the voice transcript and supplied user/plan context are sent for inference; use a local Ollama model tag if that data must stay on your machine. This provider change is limited to the voice assistant; other Gemini-backed features are unchanged.

## Rate Limits
*Note: Add rate limiting at the API Gateway or Express route level.*

## Testing
The backend test script uses the authenticated user associated with `TEST_COOKIE` or `TEST_TOKEN`. Set one before running `backend/src/scripts/test-voice-assistant.js`; without credentials, local development authentication may select the separate Local developer account instead of your signed-in account.

In PowerShell, for example:

```powershell
$env:TEST_COOKIE = "session=<your-session-cookie>"
node backend/src/scripts/test-voice-assistant.js
```

Alternatively, set `TEST_TOKEN` to a bearer token.
