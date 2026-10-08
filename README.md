<div align="center">
  <img src="frontend/public/assets/Mascot/hi.png" alt="PrepAmigo mascot" width="132" />
  <h1>PrepAmigo</h1>
  <p><strong>Make every day count before interview day.</strong></p>
  <p>Company-aware interview preparation, shaped around your role, skills, and available time.</p>
  <p>
    <a href="#quick-start"><strong>🚀 Quick start</strong></a>
    &nbsp;·&nbsp;
    <a href="#why-prepamigo">Why PrepAmigo?</a>
    &nbsp;·&nbsp;
    <a href="#documentation">Documentation</a>
  </p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/Agents-LangGraph-6B46C1" alt="LangGraph agents" />
  <img src="https://img.shields.io/badge/Project-In%20development-F08C46" alt="Project in development" />
</p>

<p align="center">
  <img src="frontend/public/assets/Mascot/Thinking.png" alt="PrepAmigo thinking" width="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="frontend/public/assets/Mascot/working.png" alt="PrepAmigo building your plan" width="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="frontend/public/assets/Mascot/Celebration.png" alt="PrepAmigo celebrating progress" width="100" />
</p>

> [!TIP]
> **The idea:** less time figuring out what to study, more time getting interview-ready. Start with your [local quick start](#quick-start) or jump to the [product overview](docs/PrepAmigo.md).

## What you can do

<table>
  <tr>
    <td width="33%" align="center"><h3>🎯 Prepare with context</h3><p>Bring your target company, role, resume, and timeline into one preparation journey.</p></td>
    <td width="33%" align="center"><h3>🧭 Find your focus</h3><p>Explore role requirements and surface skills to prioritize in your prep.</p></td>
    <td width="33%" align="center"><h3>🗓️ Follow a roadmap</h3><p>Turn priorities into structured study tasks, practice, and curated resources.</p></td>
  </tr>
  <tr>
    <td width="33%" align="center"><h3>🤖 Specialist agents</h3><p>Coordinate company, job, skill-gap, and learning research with dedicated agents.</p></td>
    <td width="33%" align="center"><h3>📚 Practice with purpose</h3><p>Use quizzes and revision materials connected to your preparation topics.</p></td>
    <td width="33%" align="center"><h3>✨ See your progress</h3><p>Track completed work and milestones as interview day gets closer.</p></td>
  </tr>
</table>

## Why PrepAmigo

| Generic prep | PrepAmigo |
| --- | --- |
| One-size-fits-all checklists | Preparation informed by your role, background, and timeline |
| Search results without a next step | Research organized into focused priorities and tasks |
| Scattered notes and progress | A connected roadmap, learning resources, and progress view |

<p align="center">
  <img src="frontend/public/assets/Mascot/working.png" alt="" width="68" />
  <strong>Not another link dump—a clearer answer to “what should I do next?”</strong>
</p>

## Your prep journey

<table>
  <tr>
    <td align="center" width="25%"><img src="frontend/public/assets/Mascot/hi.png" alt="" width="68" /><br /><strong>01 · Set your goal</strong><br /><sub>Company, role, and timeline</sub></td>
    <td align="center" width="25%"><img src="frontend/public/assets/Mascot/Thinking.png" alt="" width="68" /><br /><strong>02 · Find priorities</strong><br /><sub>Research the role and skill focus</sub></td>
    <td align="center" width="25%"><img src="frontend/public/assets/Mascot/working.png" alt="" width="68" /><br /><strong>03 · Get a roadmap</strong><br /><sub>Organize study and practice</sub></td>
    <td align="center" width="25%"><img src="frontend/public/assets/Mascot/Celebration.png" alt="" width="68" /><br /><strong>04 · Make progress</strong><br /><sub>Complete tasks and track milestones</sub></td>
  </tr>
</table>

## Built with

`React` · `TypeScript` · `Vite` &nbsp;|&nbsp; `Node.js` · `Express` · `MongoDB` &nbsp;|&nbsp; `Python` · `FastAPI` · `LangGraph` · `Redis`

<details>
  <summary><strong>See the AI and research options</strong></summary>
  <p>Ollama is the default model provider. SerpApi enables live search; OpenAI-compatible fast-model routing, Mem0, and Neo4j are optional integrations.</p>
</details>

## Quick start

> [!IMPORTANT]
> PrepAmigo is under active development. Some screens use demo data, and complete local workflows need supporting services and model configuration. Follow the service guides for setup details.

**Prerequisites:** Node.js/npm, Python 3.11+ with `uv`, MongoDB, Redis, Ollama, and an Ollama model such as `llama3.1`.

Run each service in its **own terminal**. Configure the `.env` files using each service's `.env.example` first.

<details>
  <summary><strong>1 · Start the backend API</strong></summary>

```powershell
cd backend
Copy-Item .env.example .env
# Set MONGODB_URI in .env
npm install
npm run dev
```

API: <http://localhost:3000> · Health: <http://localhost:3000/health>
</details>

<details>
  <summary><strong>2 · Start the agent service</strong></summary>

```powershell
cd agents-service
Copy-Item .env.example .env
ollama pull llama3.1
uv sync --dev
uv run uvicorn --app-dir src main:app --reload
```

Agent API: <http://localhost:8000>. Live search is optional and requires a SerpApi key.
</details>

<details>
  <summary><strong>3 · Start the web app</strong></summary>

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in your terminal (usually <http://localhost:5173>).
</details>

## Documentation

<p align="center">
  <a href="docs/PrepAmigo.md">Product overview</a> &nbsp;·&nbsp;
  <a href="agents-service/README.md">Agent service setup</a> &nbsp;·&nbsp;
  <a href="docs/agents/ORCHESTRATION_WORKFLOW.md">Agent workflow</a> &nbsp;·&nbsp;
  <a href="docs/api-docs/PLAN_PROGRESS_API.md">Plans API</a>
</p>

<p align="center">
  <a href="docs/guides/ENVIRONMENT_CONFIGURATION.md">Environment guide</a> &nbsp;·&nbsp;
  <a href="docs/agents/SSE_STREAMING_GUIDE.md">Streaming guide</a> &nbsp;·&nbsp;
  <a href="prepamigo-apis-bruno/">Bruno API collection</a>
</p>
