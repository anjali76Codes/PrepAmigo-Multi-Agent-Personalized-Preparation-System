# PrepAmigo-SerpApi-Hackathon

## Setup Instructions

### Frontend

1. Install dependencies:

   ```shell
   cd frontend
   npm install
   ```

2. Run the frontend development server:

   ```shell
   npm run dev
   ```

### Backend

1. Install dependencies:

   ```shell
   cd backend
   npm install
   ```

2. Run the backend development server:

   ```shell
   npm run dev
   ```

### Agents

1. Install dependencies using `uv`:

   ```shell
   cd agents-service
   uv sync --dev
   ```

2. Run the agents development server:

   ```shell
   uv run uvicorn --app-dir src main:app --reload
   ```

The agents service exposes `GET /health` and `POST /api/chat`. See `agents/README.md` for provider configuration and the supported flight-search workflow.

The agents service requires a working LLM provider. With the default Ollama setup, install `llama3.1` using `ollama pull llama3.1`, or set `OLLAMA_MODEL` to a model shown by `ollama list`. A SerpApi key is required for flight searches.


