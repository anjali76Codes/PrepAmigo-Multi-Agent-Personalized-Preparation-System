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
    log_level: str = os.getenv("LOG_LEVEL", "INFO").strip().upper()

    def validate(self) -> None:
        if self.llm_provider not in {"openai", "ollama"}:
            raise ValueError("LLM_PROVIDER must be either 'openai' or 'ollama'")
        if not self.ollama_model:
            raise ValueError("OLLAMA_MODEL must not be empty")
        parsed_url = urlparse(self.ollama_base_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError("OLLAMA_BASE_URL must be a valid HTTP(S) URL")
        if self.llm_provider == "openai" and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        if self.llm_provider == "openai" and not self.openai_model:
            raise ValueError("OPENAI_MODEL must not be empty")


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
