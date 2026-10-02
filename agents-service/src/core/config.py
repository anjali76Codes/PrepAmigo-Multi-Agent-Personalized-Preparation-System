"""
Central config. One switch (LLM_PROVIDER) decides which model backs every
agent, so swapping local <-> cloud never touches agent code.
"""
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def service_path(value: str) -> Path:
    """Resolve a configured relative path against agents-service/, not the
    cwd: running from the repo root otherwise writes logs/plans/cache to a
    repo-root .data/ that agents-service/.gitignore doesn't cover."""
    path = Path(value)
    return path if path.is_absolute() else SERVICE_ROOT / path


@dataclass(frozen=True)
class Settings:
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1").strip()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    # thinking models (e.g. nemotron-3-nano) write a hidden reasoning trace
    # before every answer by default — measured on the research synthesis
    # prompt: ~4,000 output tokens / 12.9s with it, ~940 / 3.4s without,
    # with no loss in the visible answer, and trace length is unbounded
    # (the 68s/90s+ synthesis outliers). Off by default; harmless on models
    # without the thinking capability. "true" turns it back on, empty
    # leaves it to the model's own default.
    ollama_reasoning: str = os.getenv("OLLAMA_REASONING", "false").strip().lower()
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    # --- Fast model profile (optional) ---
    # A second, OpenAI-compatible endpoint (e.g. Groq) for small calls where
    # latency matters more than depth. Used only by agents whose *_LLM
    # setting is "fast"; unset, those agents use the main model above.
    fast_llm_base_url: str = os.getenv("FAST_LLM_BASE_URL", "").strip()
    fast_llm_model: str = os.getenv("FAST_LLM_MODEL", "").strip()
    fast_llm_api_key: str = os.getenv("FAST_LLM_API_KEY", "").strip()
    # sent as `reasoning_effort` when set (e.g. "none" turns a thinking
    # model's hidden reasoning off on Groq); empty sends nothing
    fast_llm_reasoning_effort: str = os.getenv("FAST_LLM_REASONING_EFFORT", "").strip()
    # concurrent calls to the fast model where a stage fans out (planner
    # chunks). Kept low: a free tier's tokens-per-minute cap is hit by
    # volume, and a burst gains nothing once it is.
    fast_llm_max_concurrency: int = int(os.getenv("FAST_LLM_MAX_CONCURRENCY", "2") or 2)
    serpapi_api_key: str = os.getenv("SERPAPI_API_KEY", "").strip()
    serpapi_enabled: bool = os.getenv("SERPAPI_ENABLED", "true").strip().lower() in {
        "1", "true", "yes", "on",
    }
    # SerpApi is usually 1-3s but occasionally hangs (a 54.8s search was
    # seen). Each attempt is cut off after this many seconds and tried again,
    # up to SERPAPI_MAX_ATTEMPTS: a retry normally answers in a second or two.
    serpapi_attempt_timeout_seconds: float = float(os.getenv("SERPAPI_ATTEMPT_TIMEOUT_SECONDS", "8") or 8)
    serpapi_max_attempts: int = int(os.getenv("SERPAPI_MAX_ATTEMPTS", "2") or 2)
    # SerpApi requests in flight at once. Six topics searching together
    # (12+ requests) is when the 8s+ answers and timeouts appeared; a few
    # at a time each answer in 1-3s.
    serpapi_max_concurrency: int = int(os.getenv("SERPAPI_MAX_CONCURRENCY", "4") or 4)
    serpapi_dummy_data_path: str = os.getenv(
        "SERPAPI_DUMMY_DATA_PATH", ".data/serpapi_fixtures.json"
    ).strip()
    # Google's AI Overview panel adds significant server-side latency to a
    # plain `google` engine call (SerpApi has to wait on it even when the
    # caller never reads it) — udm=14 forces Google's AI-Overview-free "Web"
    # view. Default on for every `google` call; a caller that actually wants
    # the overview (e.g. search_google_interview_sources) opts out per-call
    # via serpapi_search(..., suppress_ai_overview=False), it's never a
    # blanket per-engine switch.
    serpapi_suppress_ai_overview: bool = os.getenv("SERPAPI_SUPPRESS_AI_OVERVIEW", "true").strip().lower() in {
        "1", "true", "yes", "on",
    }
    log_level: str = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    # rotating log file for inspection (step/tool timings, errors); empty
    # disables file logging and keeps console-only output. Always under
    # .data/, which is gitignored, so logs never get committed
    log_file: str = os.getenv("LOG_FILE", ".data/logs/agents-service.log").strip()
    log_file_max_bytes: int = int(os.getenv("LOG_FILE_MAX_BYTES", "5000000") or 5_000_000)
    # stream reply tokens as they are generated: the CLI default, and
    # whether graph.streaming.stream_turn includes token events at all
    stream_responses: bool = os.getenv("STREAM_RESPONSES", "true").strip().lower() in {"1", "true", "yes", "on"}

    # --- Long-term memory (see memory/store.py) ---
    # "local" = in-process/JSON store, "mem0" = hosted mem0 Platform,
    # "mem0_oss" = self-hosted mem0; mem0 modes fall back to local if unavailable
    memory_provider: str = os.getenv("MEMORY_PROVIDER", "local").strip().lower()
    # JSON file for the local provider; empty keeps memories in-process only
    memory_store_path: str = os.getenv("MEMORY_STORE_PATH", "").strip()
    # hosted mem0 Platform (MEMORY_PROVIDER=mem0)
    mem0_api_key: str = os.getenv("MEM0_API_KEY", "").strip()
    mem0_host: str = os.getenv("MEM0_HOST", "").strip()
    # longest startup waits for a mem0 mode to connect before falling back
    # to the local provider
    memory_connect_timeout_seconds: float = float(os.getenv("MEMORY_CONNECT_TIMEOUT_SECONDS", "10") or 10)
    # self-hosted mem0 (MEMORY_PROVIDER=mem0_oss) keeps vectors (Qdrant) and
    # history (SQLite) here unless a Qdrant URL is set
    mem0_data_dir: str = os.getenv("MEM0_DATA_DIR", ".data/mem0").strip()
    mem0_qdrant_url: str = os.getenv("MEM0_QDRANT_URL", "").strip()
    mem0_qdrant_api_key: str = os.getenv("MEM0_QDRANT_API_KEY", "").strip()
    ollama_embed_model: str = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text").strip()
    openai_embed_model: str = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small").strip()

    # --- User knowledge graph (see graph/knowledge_graph.py) ---
    # JSON file for the graph; empty keeps the graph in-process only.
    # Not currently written by the research agent; reserved for the
    # skill-gap/assessment agents.
    knowledge_graph_path: str = os.getenv("KNOWLEDGE_GRAPH_PATH", "").strip()

    # --- Research tool cache (tools/cache.py) ---
    # cache raw tool/SerpApi responses as inspectable JSON so repeated dev
    # and test runs don't spend limited SerpApi credits
    research_cache_enabled: bool = os.getenv("RESEARCH_CACHE_ENABLED", "true").strip().lower() in {
        "1", "true", "yes", "on",
    }
    research_cache_dir: str = os.getenv("RESEARCH_CACHE_DIR", ".data/research_cache").strip()
    research_cache_ttl_seconds: int = int(os.getenv("RESEARCH_CACHE_TTL_SECONDS", "604800") or 0)
    # news and job-listing searches change daily, so their cached responses
    # expire sooner than web/YouTube/Scholar results (tools/serpapi_client.py)
    serpapi_fresh_cache_ttl_seconds: int = int(os.getenv("SERPAPI_FRESH_CACHE_TTL_SECONDS", "86400") or 0)
    # engine for the content-research docs web searches. "google" (default,
    # with the AI Overview suppressed) measured 1-2.5s; "google_light",
    # SerpApi's organic-results-only endpoint, is advertised as faster but
    # measured 10-20s per search on this account
    serpapi_web_engine: str = os.getenv("SERPAPI_WEB_ENGINE", "google").strip() or "google"

    # where reference books come from: "catalogue" = Open Library (free, no
    # key, real books only), "web" = a "best books to learn X" web search
    # through SerpApi (one credit, and it returned job adverts)
    books_source: str = os.getenv("BOOKS_SOURCE", "catalogue").strip().lower()
    # a catalogue book is recommended only if it is established: at least
    # this many editions, or this many readers who shelved it
    book_min_editions: int = int(os.getenv("BOOK_MIN_EDITIONS", "2") or 0)
    book_min_readers: int = int(os.getenv("BOOK_MIN_READERS", "5") or 0)
    # where papers come from: "arxiv" (free API) or "scholar" (SerpApi credit)
    papers_source: str = os.getenv("PAPERS_SOURCE", "arxiv").strip().lower()

    # --- LLM response cache (storage/llm_cache.py) ---
    # identical prompt + model + parameters returns the stored answer instead
    # of a new generation: a repeated run spends no tokens on unchanged steps.
    # Stored under RESEARCH_CACHE_DIR/llm/.
    llm_cache_enabled: bool = os.getenv("LLM_CACHE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
    llm_cache_ttl_seconds: int = int(os.getenv("LLM_CACHE_TTL_SECONDS", "604800") or 0)
    # development only: a cache hit (API or LLM) waits as long as the original
    # call took, so a cached run times like a live one without spending
    # credits or tokens. Off = hits return immediately (what production wants).
    cache_replay_latency: bool = os.getenv("CACHE_REPLAY_LATENCY", "false").strip().lower() in {
        "1", "true", "yes", "on",
    }
    # longest wait replayed for one hit: a call recorded during an outage
    # (one entry took 70s) shouldn't be replayed in full
    cache_replay_max_seconds: float = float(os.getenv("CACHE_REPLAY_MAX_SECONDS", "30") or 30)

    # --- Research agent tuning (agents/research_agent.py) ---
    # wall-clock budget for the tool-orchestration phase (memory recall,
    # scoping, and the parallel docs/books/papers/videos/transcript calls) —
    # the part "the tools are optimized" is actually about
    research_timeout_seconds: float = float(os.getenv("RESEARCH_TIMEOUT_SECONDS", "30") or 30)
    # separate budget for the LLM call that writes the module: that time is
    # bound by model speed, not tool efficiency, so a slow model shouldn't
    # eat into (or be let off the hook by) the research-phase budget above
    research_synthesis_timeout_seconds: float = float(
        os.getenv("RESEARCH_SYNTHESIS_TIMEOUT_SECONDS", "45") or 45
    )
    # budget for a single tool call (search or transcript fetch)
    # (covers SERPAPI_MAX_ATTEMPTS attempts of SERPAPI_ATTEMPT_TIMEOUT_SECONDS)
    research_tool_timeout_seconds: float = float(os.getenv("RESEARCH_TOOL_TIMEOUT_SECONDS", "20") or 20)
    # resource kinds the research agent may search at all, comma separated:
    # docs, videos, books, papers, repos (repos: company module only).
    # Leaving one out switches it off for every topic.
    research_kinds: str = os.getenv("RESEARCH_KINDS", "docs,videos,books,papers,repos").strip().lower()
    # share of a topic's significant words a search result's title+snippet
    # must contain to be kept (tools/relevance.py); 0 disables the filter
    research_min_relevance: float = float(os.getenv("RESEARCH_MIN_RELEVANCE", "0.5") or 0)
    # an optional model check of each topic's search results before they
    # become resources: "is this something to study from, for this topic and
    # role?". Catches what word matching can't (a consultancy's sales page
    # titled exactly like the topic, a news clip, a homonym). One small call
    # per topic. "off" (default), "default" (main model) or "fast" (FAST_LLM_*).
    research_judge_llm: str = os.getenv("RESEARCH_JUDGE_LLM", "off").strip().lower()
    # most tokens one research write-up may generate. Typical modules are
    # ~1,000 tokens; an uncapped one ran to 4,800 (27s) — the cap bounds that
    # tail. Overview and Key Concepts (what the planner reads) come first.
    # 0 = no cap.
    research_max_output_tokens: int = int(os.getenv("RESEARCH_MAX_OUTPUT_TOKENS", "1800") or 0)
    # cap for the interview-prep pipeline's compact write-up (overview, key
    # concepts, practice: ~350 tokens). The full sheet above is for chat.
    research_compact_max_output_tokens: int = int(os.getenv("RESEARCH_COMPACT_MAX_OUTPUT_TOKENS", "600") or 0)

    # --- Interview prep orchestrator tuning (agents/interview_prep_orchestrator.py) ---
    # budget for one company_research/job_intelligence/skill_gap branch:
    # on a local model this can mean two serial LLM calls (a tool-use
    # decision, then synthesis) plus tool round trips — observed live
    # taking 45s+ on its own merit, not just under contention, so the
    # default has real headroom rather than matching the research agent's
    # single-LLM-call budget above
    interview_prep_branch_timeout_seconds: float = float(
        os.getenv("INTERVIEW_PREP_BRANCH_TIMEOUT_SECONDS", "90") or 90
    )
    # budget for the one LLM call that turns job postings into required
    # skills. Everything downstream depends on it (no required skills = no
    # gaps = no plan), so it gets more room than a nice-to-have call; it
    # still sits inside the branch budget above.
    job_intelligence_llm_timeout_seconds: float = float(
        os.getenv("JOB_INTELLIGENCE_LLM_TIMEOUT_SECONDS", "60") or 60
    )
    # --- Per-agent model routing ---
    # Each *_LLM picks "default" (the main model) or "fast" (FAST_LLM_*).
    # Each *_MODEL names a different model on the main provider for that
    # agent only (e.g. a smaller, quicker Ollama model for the planner's
    # short JSON answers); empty = the main model. Ignored when *_LLM=fast.
    planner_llm: str = os.getenv("PLANNER_LLM", "default").strip().lower()
    planner_model: str = os.getenv("PLANNER_MODEL", "").strip()
    job_intelligence_llm: str = os.getenv("JOB_INTELLIGENCE_LLM", "default").strip().lower()
    job_intelligence_model: str = os.getenv("JOB_INTELLIGENCE_MODEL", "").strip()
    research_model: str = os.getenv("RESEARCH_MODEL", "").strip()
    # one small call before any search: which kinds of resource (docs,
    # videos, books, papers) are worth searching for each skill gap. A soft
    # skill needs no papers; a brand-new tool has no books. Saves the
    # searches (and SerpApi credits) whose results would only be dropped.
    # "off" searches every kind; "default" / "fast" pick the model.
    research_scope_llm: str = os.getenv("RESEARCH_SCOPE_LLM", "off").strip().lower()

    # --- Skill gap (agents/skill_gap_agent.py) ---
    # which model compares the resume to the required skills: "default" or
    # "fast" (FAST_LLM_*). Note that "fast" sends the resume text to that
    # provider.
    skill_gap_llm: str = os.getenv("SKILL_GAP_LLM", "default").strip().lower()
    # most required skills compared (must-have first); 0 = all
    skill_gap_max_skills: int = int(os.getenv("SKILL_GAP_MAX_SKILLS", "12") or 0)
    # cap on the verdict list the model writes (~25 tokens per skill)
    skill_gap_max_output_tokens: int = int(os.getenv("SKILL_GAP_MAX_OUTPUT_TOKENS", "700") or 0)
    # budget for that one call; past it the verdicts come from the resume
    # text instead, well inside the stage budget above
    skill_gap_llm_timeout_seconds: float = float(os.getenv("SKILL_GAP_LLM_TIMEOUT_SECONDS", "45") or 45)
    # the closing status summary: "default", "fast", or "off" (use the
    # built-in summary sentence, no model call)
    evaluator_llm: str = os.getenv("EVALUATOR_LLM", "default").strip().lower()
    # "on" adds one research module about the target company's own platform,
    # built from its official site and GitHub (taken from the company
    # profile), and puts it first in the plan. Suits a company whose product
    # is what the role works with; "off" (default) plans skill gaps only.
    company_module: str = os.getenv("COMPANY_MODULE", "off").strip().lower()
    # how interview_prep researches the company:
    #   agent  = the tool-calling loop (the model picks the searches, one
    #            per turn, then writes a dossier): 3-4 model calls
    #   direct = both searches run straight away in parallel, then ONE small
    #            model call writes a short structured brief
    #            (agents/company_brief.py): ~2-3k tokens, fits a free tier
    company_research_mode: str = os.getenv("COMPANY_RESEARCH_MODE", "agent").strip().lower()
    # which model writes the brief in direct mode: "default" (the main
    # model) or "fast" (the FAST_LLM_* profile)
    company_research_llm: str = os.getenv("COMPANY_RESEARCH_LLM", "default").strip().lower()
    # tool-call rounds the company research agent gets inside interview_prep
    # before it must stop with what it has (see route_company_branch)
    company_research_max_tool_rounds: int = int(os.getenv("COMPANY_RESEARCH_MAX_TOOL_ROUNDS", "3") or 3)

    # --- Planner agent (agents/planner_agent.py) ---
    # every generated plan is written here as <plan_id>.json for review;
    # relative paths resolve against agents-service/ (not the cwd), and it
    # sits under .data/ so it's gitignored. Empty disables saving.
    plan_output_dir: str = os.getenv("PLAN_OUTPUT_DIR", ".data/plans").strip()
    # default plan length in days (a run can override it); split across
    # skill gaps by priority, so longer plans mean more days per gap, not
    # more research
    plan_total_days: int = int(os.getenv("PLAN_TOTAL_DAYS", "45") or 45)
    # depth over breadth: a plan covers at most this many skill gaps (highest
    # priority first; the rest are listed as not scheduled), and never more
    # than fit with PLAN_MIN_DAYS_PER_TOPIC days each. Matches
    # RESEARCH_MAX_GAPS by default, so every planned topic has references.
    plan_max_topics: int = int(os.getenv("PLAN_MAX_TOPICS", "6") or 0)
    plan_min_days_per_topic: int = int(os.getenv("PLAN_MIN_DAYS_PER_TOPIC", "3") or 1)
    # most book references placed in the day-by-day schedule of one plan
    # (nobody reads a new book for a three-day sprint); every book found
    # stays in the resource pack
    plan_max_books: int = int(os.getenv("PLAN_MAX_BOOKS", "2") or 0)
    # likewise for research papers
    plan_max_papers: int = int(os.getenv("PLAN_MAX_PAPERS", "2") or 0)
    # longest sprint; a gap with more days is split into several sprints
    plan_sprint_max_days: int = int(os.getenv("PLAN_SPRINT_MAX_DAYS", "7") or 7)
    # most days one planner LLM call writes, keeping every call small no
    # matter how long the plan is
    planner_days_per_call: int = int(os.getenv("PLANNER_DAYS_PER_CALL", "10") or 10)

    # most skill gaps researched per run (highest priority first); each costs
    # one search round + one LLM write-up, so this bounds research time and
    # SerpApi credits regardless of plan length. Gaps past it are still
    # planned, without references.
    research_max_gaps: int = int(os.getenv("RESEARCH_MAX_GAPS", "6") or 6)

    # concurrent LLM calls where a stage can fan out (research write-ups,
    # planner chunks, company+job branches). 0 = automatic: 1 for Ollama
    # (measured: neither a local model nor Ollama Cloud served parallel
    # requests faster), 4 otherwise. Raise it for an Ollama server started
    # with OLLAMA_NUM_PARALLEL.
    llm_max_concurrency: int = int(os.getenv("LLM_MAX_CONCURRENCY", "0") or 0)

    def enabled_research_kinds(self) -> tuple[str, ...]:
        return tuple(kind.strip() for kind in self.research_kinds.split(",") if kind.strip())

    def validate(self) -> None:
        if self.llm_provider not in {"openai", "ollama"}:
            raise ValueError("LLM_PROVIDER must be either 'openai' or 'ollama'")
        if self.memory_provider not in {"local", "mem0", "mem0_oss"}:
            raise ValueError("MEMORY_PROVIDER must be one of 'local', 'mem0', 'mem0_oss'")
        if not self.ollama_model:
            raise ValueError("OLLAMA_MODEL must not be empty")
        if self.ollama_reasoning not in {"", "true", "false"}:
            raise ValueError("OLLAMA_REASONING must be 'true', 'false', or empty")
        parsed_url = urlparse(self.ollama_base_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError("OLLAMA_BASE_URL must be a valid HTTP(S) URL")
        if self.llm_provider == "openai" and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        if self.llm_provider == "openai" and not self.openai_model:
            raise ValueError("OPENAI_MODEL must not be empty")
        if self.research_timeout_seconds <= 0:
            raise ValueError("RESEARCH_TIMEOUT_SECONDS must be a positive number")
        if self.research_synthesis_timeout_seconds <= 0:
            raise ValueError("RESEARCH_SYNTHESIS_TIMEOUT_SECONDS must be a positive number")
        if self.research_tool_timeout_seconds <= 0:
            raise ValueError("RESEARCH_TOOL_TIMEOUT_SECONDS must be a positive number")
        if self.serpapi_max_concurrency < 1:
            raise ValueError("SERPAPI_MAX_CONCURRENCY must be at least 1")
        if self.research_compact_max_output_tokens < 0:
            raise ValueError("RESEARCH_COMPACT_MAX_OUTPUT_TOKENS must not be negative")
        if self.serpapi_attempt_timeout_seconds <= 0 or self.serpapi_max_attempts < 1:
            raise ValueError("SERPAPI_ATTEMPT_TIMEOUT_SECONDS must be positive and SERPAPI_MAX_ATTEMPTS at least 1")
        unknown = set(self.enabled_research_kinds()) - {"docs", "videos", "books", "papers", "repos"}
        if unknown:
            raise ValueError(f"RESEARCH_KINDS has unknown kinds: {sorted(unknown)}")
        if self.interview_prep_branch_timeout_seconds <= 0:
            raise ValueError("INTERVIEW_PREP_BRANCH_TIMEOUT_SECONDS must be a positive number")
        for name in ("skill_gap_llm", "planner_llm", "job_intelligence_llm"):
            if getattr(self, name) not in {"default", "fast"}:
                raise ValueError(f"{name.upper()} must be 'default' or 'fast'")
        if self.research_scope_llm not in {"off", "default", "fast"}:
            raise ValueError("RESEARCH_SCOPE_LLM must be 'off', 'default' or 'fast'")
        if self.fast_llm_max_concurrency < 1:
            raise ValueError("FAST_LLM_MAX_CONCURRENCY must be at least 1")
        if self.evaluator_llm not in {"default", "fast", "off"}:
            raise ValueError("EVALUATOR_LLM must be 'default', 'fast' or 'off'")
        if self.skill_gap_max_skills < 0 or self.skill_gap_max_output_tokens < 0:
            raise ValueError("SKILL_GAP_MAX_SKILLS and SKILL_GAP_MAX_OUTPUT_TOKENS must not be negative")
        if self.skill_gap_llm_timeout_seconds <= 0:
            raise ValueError("SKILL_GAP_LLM_TIMEOUT_SECONDS must be a positive number")
        if self.books_source not in {"catalogue", "web"}:
            raise ValueError("BOOKS_SOURCE must be 'catalogue' or 'web'")
        if self.papers_source not in {"arxiv", "scholar"}:
            raise ValueError("PAPERS_SOURCE must be 'arxiv' or 'scholar'")
        if self.research_judge_llm not in {"off", "default", "fast"}:
            raise ValueError("RESEARCH_JUDGE_LLM must be 'off', 'default' or 'fast'")
        if self.plan_max_books < 0 or self.plan_max_papers < 0:
            raise ValueError("PLAN_MAX_BOOKS and PLAN_MAX_PAPERS must not be negative")
        if self.book_min_editions < 0 or self.book_min_readers < 0:
            raise ValueError("BOOK_MIN_EDITIONS and BOOK_MIN_READERS must not be negative")
        if self.company_module not in {"on", "off"}:
            raise ValueError("COMPANY_MODULE must be 'on' or 'off'")
        if self.company_research_mode not in {"agent", "direct"}:
            raise ValueError("COMPANY_RESEARCH_MODE must be 'agent' or 'direct'")
        if self.company_research_llm not in {"default", "fast"}:
            raise ValueError("COMPANY_RESEARCH_LLM must be 'default' or 'fast'")
        if self.job_intelligence_llm_timeout_seconds <= 0:
            raise ValueError("JOB_INTELLIGENCE_LLM_TIMEOUT_SECONDS must be a positive number")
        if self.company_research_max_tool_rounds < 1:
            raise ValueError("COMPANY_RESEARCH_MAX_TOOL_ROUNDS must be at least 1")
        if not 1 <= self.plan_total_days <= 366:
            raise ValueError("PLAN_TOTAL_DAYS must be between 1 and 366")
        if self.plan_max_topics < 0 or self.plan_min_days_per_topic < 1:
            raise ValueError("PLAN_MAX_TOPICS must not be negative and PLAN_MIN_DAYS_PER_TOPIC must be at least 1")
        if self.plan_sprint_max_days < 1 or self.planner_days_per_call < 1:
            raise ValueError("PLAN_SPRINT_MAX_DAYS and PLANNER_DAYS_PER_CALL must be at least 1")
        if self.research_max_gaps < 1:
            raise ValueError("RESEARCH_MAX_GAPS must be at least 1")
        if self.llm_max_concurrency < 0:
            raise ValueError("LLM_MAX_CONCURRENCY must not be negative")
        if not 0 <= self.research_min_relevance <= 1:
            raise ValueError("RESEARCH_MIN_RELEVANCE must be between 0 and 1")
        if self.research_cache_ttl_seconds < 0:
            raise ValueError("RESEARCH_CACHE_TTL_SECONDS must not be negative")
        if self.serpapi_fresh_cache_ttl_seconds < 0 or self.llm_cache_ttl_seconds < 0:
            raise ValueError("SERPAPI_FRESH_CACHE_TTL_SECONDS and LLM_CACHE_TTL_SECONDS must not be negative")
        if self.memory_connect_timeout_seconds <= 0:
            raise ValueError("MEMORY_CONNECT_TIMEOUT_SECONDS must be a positive number")
        if self.cache_replay_max_seconds <= 0:
            raise ValueError("CACHE_REPLAY_MAX_SECONDS must be a positive number")
        if self.research_max_output_tokens < 0:
            raise ValueError("RESEARCH_MAX_OUTPUT_TOKENS must not be negative")
        if self.log_file_max_bytes <= 0:
            raise ValueError("LOG_FILE_MAX_BYTES must be a positive number")


settings = Settings()


def fast_llm_configured(cfg: Settings | None = None) -> bool:
    cfg = cfg or settings
    return bool(cfg.fast_llm_base_url and cfg.fast_llm_model and cfg.fast_llm_api_key)


def llm_concurrency(cfg: Settings | None = None, profile: str = "default") -> int:
    """How many LLM calls may run at once (see Settings.llm_max_concurrency).
    Takes the caller's settings so modules that rebind `settings` in tests
    get their own value. profile="fast" is the fast model's own limit when
    that model is configured."""
    cfg = cfg or settings
    if profile == "fast" and fast_llm_configured(cfg):
        return cfg.fast_llm_max_concurrency
    if cfg.llm_max_concurrency > 0:
        return cfg.llm_max_concurrency
    return 1 if cfg.llm_provider == "ollama" else 4


def get_llm(temperature: float = 0.2, max_tokens: int | None = None, profile: str = "default",
            model: str | None = None):
    """Return a chat model instance based on Settings.LLM_PROVIDER.
    Every agent should call this instead of instantiating a model directly:
    it attaches the run-metrics callback (observability/metrics.py) and the
    LLM response cache (storage/llm_cache.py). `max_tokens` caps the
    generated tokens of each call (None = the model's default).

    profile="fast" returns the FAST_LLM_* model (an OpenAI-compatible
    endpoint such as Groq) when it is configured, else the main model, so
    a caller never has to check. `model` names a different model on the
    main provider (a per-agent *_MODEL setting); empty/None = the main one.
    """
    from observability.metrics import METRICS_CALLBACK
    from storage.llm_cache import llm_response_cache

    settings.validate()
    if profile == "fast" and fast_llm_configured():
        from langchain_openai import ChatOpenAI

        extra = {"reasoning_effort": settings.fast_llm_reasoning_effort} if settings.fast_llm_reasoning_effort else {}
        fast = ChatOpenAI(
            model=settings.fast_llm_model,
            api_key=settings.fast_llm_api_key,
            base_url=settings.fast_llm_base_url,
            temperature=temperature,
            # no retries: on a rate limit (429) or any other failure the
            # call goes straight to the main model below instead of
            # sitting in backoff
            max_retries=0,
            callbacks=[METRICS_CALLBACK],
            cache=llm_response_cache(
                f"fast:{settings.fast_llm_base_url}:{settings.fast_llm_model}:temperature={temperature}"
                f":max_tokens={max_tokens}:reasoning={settings.fast_llm_reasoning_effort}"
            ),
            **({"max_tokens": max_tokens} if max_tokens else {}),
            **({"extra_body": extra} if extra else {}),
        )
        # A free fast tier runs out mid-run (Groq: 1,000 output tokens a
        # minute). The same call then runs on the main model (or the
        # agent's own *_MODEL), so a rate limit costs speed, never the result.
        return fast.with_fallbacks([get_llm(temperature=temperature, max_tokens=max_tokens, model=model)])
    model = model or (settings.openai_model if settings.llm_provider == "openai" else settings.ollama_model)
    # the model's own cache key leaves out the model name and temperature
    # (ChatOllama's is just its type), so they go into the cache's key here
    cache = llm_response_cache(
        f"{settings.llm_provider}:{model}:temperature={temperature}:max_tokens={max_tokens}"
        f":reasoning={settings.ollama_reasoning}"
    )
    common = {"temperature": temperature, "callbacks": [METRICS_CALLBACK], "cache": cache}
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            **({"max_tokens": max_tokens} if max_tokens else {}),
            **common,
        )
    # default: local ollama
    from langchain_ollama import ChatOllama
    options: dict = {}
    if settings.ollama_reasoning:
        options["reasoning"] = settings.ollama_reasoning == "true"
    if max_tokens:
        options["num_predict"] = max_tokens
    return ChatOllama(
        model=model,
        base_url=settings.ollama_base_url,
        **options,
        **common,
    )
