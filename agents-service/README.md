# TravelAmigo Agents

This folder contains the Python FastAPI service and its LangGraph flight-search runtime.

## Setup

```shell
cd agents-service
uv sync --dev
```

Create a `.env` file in this folder. The default local provider is Ollama:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
SERPAPI_API_KEY=your-serpapi-key
```

The value of `OLLAMA_MODEL` must match a model installed in your Ollama instance. Check available models with `ollama list`, install the documented default with `ollama pull llama3.1`, or set `OLLAMA_MODEL` to an existing model name.

`SERPAPI_API_KEY` is required when the agent performs a flight search. Without it, the API returns `503 Service Unavailable` with a configuration message.

For OpenAI, use `LLM_PROVIDER=openai` and provide `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Run

```shell
uv run uvicorn --app-dir src main:app --reload
```

For the local interactive CLI, run `uv run python src/cli.py`.

The service exposes:

- `GET /health` for liveness information.
- `POST /api/chat` for agent requests.

Example request:

```json
{
  "message": "Find flights from JFK to LAX on 2099-01-01",
  "thread_id": "demo-1"
}
```

The implemented workflow is flight search only. Booking, fare holds, payment, cancellation, refunds, and human support are not implemented and are not advertised by the agent.

Conversation checkpoints currently use process-local memory. They are suitable for local development only and are lost on restart; use a shared LangGraph checkpointer before deploying multiple workers.

## Tests

```shell
uv run pytest
```
