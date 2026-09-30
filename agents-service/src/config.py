"""
Central config. One switch (LLM_PROVIDER) decides which model backs every
agent, so swapping local <-> cloud never touches agent code.
"""
import os
from dataclasses import dataclass
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1").strip()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    serpapi_api_key: str = os.getenv("SERPAPI_API_KEY", "").strip()
    serpapi_enabled: bool = os.getenv("SERPAPI_ENABLED", "true").strip().lower() in {
        "1", "true", "yes", "on",
    }
    serpapi_dummy_data_path: str = os.getenv(
        "SERPAPI_DUMMY_DATA_PATH", ".data/serpapi_fixtures.json"
    ).strip()
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
    research_tool_timeout_seconds: float = float(os.getenv("RESEARCH_TOOL_TIMEOUT_SECONDS", "12") or 12)

    def validate(self) -> None:
        if self.llm_provider not in {"openai", "ollama"}:
            raise ValueError("LLM_PROVIDER must be either 'openai' or 'ollama'")
        if self.memory_provider not in {"local", "mem0", "mem0_oss"}:
            raise ValueError("MEMORY_PROVIDER must be one of 'local', 'mem0', 'mem0_oss'")
        if not self.ollama_model:
            raise ValueError("OLLAMA_MODEL must not be empty")
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
        if self.research_cache_ttl_seconds < 0:
            raise ValueError("RESEARCH_CACHE_TTL_SECONDS must not be negative")
        if self.log_file_max_bytes <= 0:
            raise ValueError("LOG_FILE_MAX_BYTES must be a positive number")


settings = Settings()


def get_llm(temperature: float = 0.2):
    """Return a chat model instance based on Settings.LLM_PROVIDER.
    Every agent should call this instead of instantiating a model directly.
    """
    settings.validate()
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=temperature,
        )
    # default: local ollama
    from langchain_ollama import ChatOllama
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
    )
