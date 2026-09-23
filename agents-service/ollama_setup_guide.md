# Quickstart: Connect Ollama to TravelAmigo

Follow these steps to run the agent locally using Ollama.

---

### 1. Install & Start Ollama

Ensure Ollama is installed and running on your system:

- Download: [ollama.com/download](https://ollama.com/download)
- Verify the service is running (default: `http://localhost:11434`).

---

### 2. Pull the Model

Download your target model:

```shell
ollama pull nemotron-3-nano:30b-cloud
```

Verify it is available:

```shell
ollama list
```

---

### 3. Configure the Environment

In the `agents-service` directory, create or edit your `.env` file:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=nemotron-3-nano:30b-cloud
OLLAMA_BASE_URL=http://localhost:11434
SERPAPI_API_KEY=your-serpapi-key
```

> **Note:** A valid `SERPAPI_API_KEY` is required for flight searches.

---

### 4. Install Dependencies & Launch

From the `agents-service` folder:

```shell
# Sync dependencies
uv sync --dev

# Start the FastAPI service
uv run uvicorn --app-dir src main:app --reload
```

Or test via the interactive CLI:

```shell
uv run python src/cli.py
```