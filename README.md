# PrepAmigo 

**Make every day count before interview day.**

PrepAmigo is an AI-powered interview preparation platform that turns your target company, job role, resume, and available time into a personalized learning roadmap. Its specialized AI agents research the role, identify skill gaps, curate learning resources, and organize your preparation into actionable daily tasks.

<p align="center">
  <img src="frontend/public/assets/Mascot/hi.png" alt="PrepAmigo Mascot" height="80" />
</p>

<p align="center">
  <a href="https://prep-amigo.vercel.app">
    <img src="https://img.shields.io/badge/LIVE_DEMO-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <a href="YOUR_LINKEDIN_URL_HERE">
    <img src="https://img.shields.io/badge/LINKEDIN-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
  <a href="YOUR_YOUTUBE_URL_HERE">
    <img src="https://img.shields.io/badge/YOUTUBE-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Agents-LangGraph-6B46C1" alt="LangGraph" />
  <img src="https://img.shields.io/badge/Search-SerpApi-1F6FEB" alt="SerpApi" />
</p>

---

## Table of Contents

- [Why PrepAmigo?](#why-prepamigo)
- [Features](#features)
- [How It Works](#how-it-works)
- [AI Agent System](#ai-agent-system)
- [Architecture](#architecture)
- [SerpApi Integration](#serpapi-integration)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

## Why PrepAmigo?

Interview preparation is not just about finding resources. It's about knowing **what to learn, what to prioritize, and how to use your available time effectively.**

PrepAmigo addresses three common challenges:

- **Scattered research:** Brings company information, job requirements, interview insights, and learning resources together.
- **Generic preparation:** Uses your resume and target role to identify relevant skill gaps.
- **Unstructured learning:** Converts priorities into a personalized roadmap with daily tasks, quizzes, and revision material.

## Features

| Feature | Description |
|---|---|
| Personalized preparation | Tailors preparation to your company, role, resume, and timeline. |
| Company & job intelligence | Researches company updates, job listings, required skills, and interview experiences. |
| Skill gap analysis | Compares your existing skills against role requirements and prioritizes gaps. |
| Adaptive study roadmap | Organizes learning into sprints, daily tasks, and revision cycles. |
| Curated learning resources | Finds relevant documentation, books, research papers, and videos. |
| Quizzes & flashcards | Generates revision material aligned with your preparation plan. |
| Live agent progress | Streams agent activity and tool execution updates to the interface. |
| Progress tracking | Tracks completed tasks, assessments, milestones, streaks, and XP. |
| Context-aware assistance | Routes follow-up questions to specialized agents while maintaining conversation context. |

## How It Works

<p align="center">
  <img src="frontend/public/assets/Mascot/hi.png" alt="Get started" width="65" />
  <br />
  <strong>Set your goal → Identify gaps → Learn → Practice → Track progress</strong>
</p>

1. **Define your goal:** Enter your target company, role, available preparation time, and resume.
2. **Research the opportunity:** Gather company information, job requirements, and interview insights.
3. **Identify skill gaps:** Compare your current background with the skills expected for the role.
4. **Build your roadmap:** Generate prioritized learning tasks, sprints, and milestones.
5. **Learn and practice:** Explore curated resources, quizzes, and flashcards.
6. **Track progress:** Complete tasks, assess your understanding, and monitor your preparation.

## AI Agent System

PrepAmigo uses a **LangGraph-based multi-agent workflow** to coordinate specialized research and planning tasks instead of relying on a single general-purpose chatbot.

| Agent | Responsibility |
|---|---|
| **Interview Prep Orchestrator** | Coordinates the preparation workflow, parallel research, clarification, and synthesis. |
| **Company Research** | Collects company information, products, technology context, and recent news. |
| **Job Intelligence** | Analyzes job listings to extract skills, responsibilities, and qualifications. |
| **Skill Gap** | Compares resume skills with job requirements and prioritizes learning needs. |
| **Content Research** | Finds and synthesizes relevant learning resources. |
| **Planner** | Converts skill gaps and available time into daily tasks and learning sprints. |
| **Interview Intelligence** | Researches reported interview rounds, candidate experiences, and questions. |
| **Assessment & Flashcards** | Generates plan-aligned quizzes and revision cards. |
| **Chat / Supervisor** | Routes follow-up questions and maintains conversational context. |

The orchestrator can run company research and job intelligence in parallel, request missing information, and resume interrupted workflows using checkpoints.

## Architecture

<p align="center">
  <img
    width="100%"
    alt="image"
    src="https://github.com/user-attachments/assets/d52daad6-ee34-4395-b15b-663d773be200" />

</p>

### Engineering Highlights

- **Real-time streaming:** Server-Sent Events deliver agent progress, with Redis pub/sub and event replay.
- **Resumable workflows:** LangGraph checkpoints support clarification and continuation of interrupted preparation runs.
- **Reliable execution:** Idempotency keys, configurable retries, timeouts, and per-stage execution budgets help control failures and duplicate work.
- **Grounded resources:** Learning links are sourced from tool results rather than generated without verification.
- **Caching and rate limits:** Search responses and analyzed job profiles are cached to reduce redundant requests and external API usage.
- **Graceful fallbacks:** Partial results and alternative data sources help workflows continue when optional services or research branches fail.

## SerpApi Integration

PrepAmigo is built for the **SerpApi Hackathon**, using live search data to make preparation company-aware and role-specific.

| Research task | Data source |
|---|---|
| Company research | Google Search and Google News |
| Job requirements | Google Jobs, with broader role-search fallback |
| Interview intelligence | Web search, related questions, news, and videos |
| Learning resources | Google Search and YouTube |
| Research papers | Google Scholar, optionally; arXiv is also supported |

### Search Optimization

- **Caching:** Search responses are cached for seven days by default, with a one-day cache for faster-changing job and news results.
- **Focused research:** Skill-gap research prioritizes the most relevant gaps within the available preparation schedule.
- **Reduced duplicate requests:** Asynchronous searches use the Search Archive to retrieve completed results.
- **Controlled concurrency:** Configurable concurrency limits, timeouts, and retries help manage search usage.
- **Offline development:** Mock results and JSON fixtures allow development without live search requests.

Live search requires a `SERPAPI_API_KEY`. See the [environment configuration guide](docs/guides/ENVIRONMENT_CONFIGURATION.md) for setup details.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend API | Node.js, Express, MongoDB, Mongoose |
| Agent Service | Python 3.11+, FastAPI, LangGraph, LangChain |
| Web Research | SerpApi, Google Search, Google News, Google Jobs, YouTube |
| Streaming | Server-Sent Events (SSE), Redis Pub/Sub |
| Language Models | Ollama, OpenAI-compatible model providers |
| Optional Memory | Neo4j knowledge graph, Mem0 |
| Deployment | Vercel, Render |
| Testing | pytest |

**Data responsibilities:** MongoDB stores application data and job profiles. Redis coordinates agent events and short-lived streaming history. Neo4j provides optional knowledge-graph storage.

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.11+
- `uv` Python package manager
- MongoDB
- Redis
- Ollama and a compatible model, such as `llama3.1`

SerpApi and optional integrations can be configured separately. Check each service's `.env.example` for the required variables.

### 1. Clone the Repository

```bash
git clone https://github.com/anjali76Codes/PrepAmigo-Multi-Agent-Personalized-Preparation-System.git
cd PrepAmigo
