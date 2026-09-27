import asyncio
import sys
import types

import pytest

from config import Settings
from memory.base import BaseMemoryInterface, BaseMemoryProvider
from memory.local_adapter import LocalMemoryProvider
from memory.mem0_adapter import Mem0MemoryProvider, Mem0UnavailableError, build_mem0_config
from memory.store import build_memory_provider


class FakeMem0Client:
    """Mimics the mem0ai 2.x Memory API surface the adapter uses."""

    def __init__(self):
        self.calls = []
        self.memories = {"m1": {"id": "m1", "memory": "Strong in React", "created_at": "2026-01-01"}}

    def add(self, messages, *, user_id=None, metadata=None):
        self.calls.append(("add", messages, user_id, metadata))
        return {"results": [{"id": "m2", "memory": "Weak in DSA", "event": "ADD"}]}

    def search(self, query, *, top_k=20, filters=None):
        self.calls.append(("search", query, top_k, filters))
        return {"results": [{**self.memories["m1"], "score": 0.91, "user_id": filters["user_id"]}]}

    def get_all(self, *, filters=None):
        self.calls.append(("get_all", filters))
        return {"results": list(self.memories.values())}

    def delete(self, memory_id):
        if memory_id not in self.memories:
            raise ValueError(f"Memory with id {memory_id} not found")
        del self.memories[memory_id]
        return {"message": "Memory deleted successfully!"}


def test_spec_interface_name_is_the_base_provider():
    assert BaseMemoryInterface is BaseMemoryProvider
    with pytest.raises(TypeError):
        BaseMemoryProvider()


# ---- mem0 adapter ----------------------------------------------------------


def test_mem0_adapter_scopes_calls_by_user_and_normalises_records():
    client = FakeMem0Client()
    provider = Mem0MemoryProvider(client=client)

    added = asyncio.run(provider.add([{"role": "user", "content": "I'm weak in DSA"}], "u1", {"k": "v"}))
    found = asyncio.run(provider.search("react", "u1", limit=3))
    everything = asyncio.run(provider.get_all("u1"))

    assert added == {
        "results": [{"id": "m2", "memory": "Weak in DSA", "user_id": "u1", "metadata": {}, "created_at": None}]
    }
    assert found == [
        {
            "id": "m1",
            "memory": "Strong in React",
            "user_id": "u1",
            "metadata": {},
            "created_at": "2026-01-01",
            "score": 0.91,
        }
    ]
    assert everything[0]["user_id"] == "u1"
    assert ("add", [{"role": "user", "content": "I'm weak in DSA"}], "u1", {"k": "v"}) in client.calls
    assert ("search", "react", 3, {"user_id": "u1"}) in client.calls
    assert ("get_all", {"user_id": "u1"}) in client.calls


def test_mem0_adapter_delete_reports_missing_ids():
    provider = Mem0MemoryProvider(client=FakeMem0Client())

    assert asyncio.run(provider.delete("m1")) is True
    assert asyncio.run(provider.delete("m1")) is False


def test_mem0_adapter_rejects_blank_user():
    provider = Mem0MemoryProvider(client=FakeMem0Client())

    with pytest.raises(ValueError, match="user_id"):
        asyncio.run(provider.search("react", "  "))


def test_mem0_config_uses_local_storage_without_qdrant_url(tmp_path):
    config = build_mem0_config(Settings(llm_provider="ollama", mem0_data_dir=str(tmp_path), mem0_qdrant_url=""))

    assert config["llm"]["provider"] == "ollama"
    assert config["embedder"]["config"]["model"] == "nomic-embed-text"
    assert config["vector_store"]["config"]["path"] == str(tmp_path / "qdrant")
    assert config["vector_store"]["config"]["embedding_model_dims"] == 768
    assert "url" not in config["vector_store"]["config"]
    assert config["history_db_path"] == str(tmp_path / "history.db")


def test_mem0_config_follows_openai_provider_and_remote_qdrant():
    config = build_mem0_config(
        Settings(
            llm_provider="openai",
            openai_api_key="sk-test",
            mem0_qdrant_url="https://qdrant.example:6333",
            mem0_qdrant_api_key="qk",
        )
    )

    assert config["llm"] == {"provider": "openai", "config": {"model": "gpt-4o-mini", "api_key": "sk-test"}}
    assert config["vector_store"]["config"]["url"] == "https://qdrant.example:6333"
    assert config["vector_store"]["config"]["api_key"] == "qk"
    assert config["vector_store"]["config"]["embedding_model_dims"] == 1536
    assert "path" not in config["vector_store"]["config"]


def test_mem0_adapter_raises_clear_error_when_package_missing(monkeypatch):
    monkeypatch.setitem(sys.modules, "mem0", None)

    with pytest.raises(Mem0UnavailableError, match="not installed"):
        Mem0MemoryProvider.from_local_config({})
    with pytest.raises(Mem0UnavailableError, match="not installed"):
        Mem0MemoryProvider.from_platform("m0-key")


# ---- hosted mem0 Platform --------------------------------------------------


class MemoryNotFoundError(Exception):
    """Stand-in for mem0.exceptions.MemoryNotFoundError (matched by name)."""


class FakePlatformClient(FakeMem0Client):
    instances = []

    def __init__(self, api_key=None, host=None):
        super().__init__()
        if api_key == "bad-key":
            raise ValueError("Error: Invalid API key")
        self.api_key, self.host = api_key, host
        FakePlatformClient.instances.append(self)

    def add(self, messages, *, user_id=None, metadata=None):
        self.calls.append(("add", messages, user_id, metadata))
        # the Platform acknowledges and extracts memories in the background
        return {"results": [{"message": "Memory processing has been queued", "status": "PENDING", "event_id": "e1"}]}

    def delete(self, memory_id):
        if memory_id not in self.memories:
            raise MemoryNotFoundError(memory_id)
        return super().delete(memory_id)


@pytest.fixture
def fake_platform(monkeypatch):
    FakePlatformClient.instances = []
    monkeypatch.setitem(sys.modules, "mem0", types.SimpleNamespace(MemoryClient=FakePlatformClient))
    return FakePlatformClient


def test_platform_provider_uses_api_key_and_host(fake_platform):
    provider = Mem0MemoryProvider.from_platform("m0-key", "https://mem0.internal")

    assert provider.name == "mem0"
    client = fake_platform.instances[0]
    assert (client.api_key, client.host) == ("m0-key", "https://mem0.internal")
    found = asyncio.run(provider.search("react", "u1"))
    assert found[0]["memory"] == "Strong in React"
    assert ("search", "react", 5, {"user_id": "u1"}) in client.calls


def test_platform_queued_adds_are_reported_as_pending(fake_platform):
    provider = Mem0MemoryProvider.from_platform("m0-key")

    assert asyncio.run(provider.add("Weak in DSA", "u1")) == {"results": [], "pending": 1}


def test_platform_delete_maps_not_found_to_false(fake_platform):
    provider = Mem0MemoryProvider.from_platform("m0-key")

    assert asyncio.run(provider.delete("m1")) is True
    assert asyncio.run(provider.delete("m1")) is False


def test_platform_requires_api_key(fake_platform):
    with pytest.raises(Mem0UnavailableError, match="MEM0_API_KEY"):
        Mem0MemoryProvider.from_platform("")


def test_platform_rejected_key_is_unavailable(fake_platform):
    with pytest.raises(Mem0UnavailableError, match="Invalid API key"):
        Mem0MemoryProvider.from_platform("bad-key")


# ---- factory ---------------------------------------------------------------


def test_factory_builds_platform_provider(fake_platform):
    provider = build_memory_provider(Settings(memory_provider="mem0", mem0_api_key="m0-key"))

    assert isinstance(provider, Mem0MemoryProvider)
    assert provider.name == "mem0"


@pytest.mark.parametrize("api_key", ["", "bad-key"])
def test_factory_falls_back_to_local_without_valid_platform_key(fake_platform, api_key):
    provider = build_memory_provider(Settings(memory_provider="mem0", mem0_api_key=api_key))

    assert isinstance(provider, LocalMemoryProvider)


def test_factory_falls_back_to_local_when_self_hosted_mem0_unavailable(monkeypatch):
    monkeypatch.setitem(sys.modules, "mem0", None)

    provider = build_memory_provider(Settings(memory_provider="mem0_oss"))

    assert isinstance(provider, LocalMemoryProvider)


def test_factory_builds_local_provider_by_default():
    assert isinstance(build_memory_provider(Settings(memory_provider="local")), LocalMemoryProvider)


def test_factory_rejects_unknown_provider():
    with pytest.raises(ValueError, match="MEMORY_PROVIDER"):
        build_memory_provider(Settings(memory_provider="redis"))


# ---- local fallback --------------------------------------------------------


def test_local_provider_ranks_relevant_memories_first():
    provider = LocalMemoryProvider()
    asyncio.run(provider.add("Candidate is weak in dynamic programming", "u1"))
    asyncio.run(provider.add("Candidate is strong in React and Node.js", "u1"))
    asyncio.run(provider.add("Candidate is weak in dynamic programming", "u2"))

    results = asyncio.run(provider.search("dynamic programming practice", "u1"))

    assert [r["memory"] for r in results] == ["Candidate is weak in dynamic programming"]
    assert results[0]["user_id"] == "u1"
    assert 0 < results[0]["score"] <= 1


def test_local_provider_splits_messages_and_skips_duplicates():
    provider = LocalMemoryProvider()
    messages = [
        {"role": "user", "content": "I have 45 days to prepare"},
        {"role": "assistant", "content": ""},
        {"role": "user", "content": "I have 45 days to prepare"},
    ]

    created = asyncio.run(provider.add(messages, "u1", {"source": "chat"}))

    assert len(created["results"]) == 1
    assert created["results"][0]["metadata"] == {"source": "chat"}
    assert len(asyncio.run(provider.get_all("u1"))) == 1


def test_local_provider_persists_to_json(tmp_path):
    path = tmp_path / "memories.json"
    first = LocalMemoryProvider(path)
    record = asyncio.run(first.add("Studying system design", "u1"))["results"][0]

    reloaded = LocalMemoryProvider(path)

    assert [r["id"] for r in asyncio.run(reloaded.get_all("u1"))] == [record["id"]]
    assert asyncio.run(reloaded.delete(record["id"])) is True
    assert asyncio.run(LocalMemoryProvider(path).get_all("u1")) == []
