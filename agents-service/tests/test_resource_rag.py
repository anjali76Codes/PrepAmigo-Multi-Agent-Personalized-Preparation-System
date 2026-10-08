from types import SimpleNamespace

from routers import resource_rag_router as rag


def test_chunking_keeps_text_and_respects_size_limit():
    text = "First paragraph.\n\n" + ("long content " * 400)

    chunks = rag._split_text(text)

    assert len(chunks) > 1
    assert all(len(chunk) <= rag.CHUNK_CHARS for chunk in chunks)
    assert "First paragraph." in chunks[0]
    assert "long content" in chunks[-1]


def test_user_namespace_defaults_to_pdf_namespace():
    assert rag._pinecone_config()[2] == "pdf_namespace"


def test_pinecone_config_reads_local_env_after_service_start(monkeypatch, tmp_path):
    monkeypatch.setattr(rag, "PACKAGE_ROOT", tmp_path)
    monkeypatch.setattr(
        rag,
        "settings",
        SimpleNamespace(pinecone_api_key="", pinecone_index_host=""),
    )
    monkeypatch.setattr(
        rag,
        "dotenv_values",
        lambda _path: {
            "PINECONE_API_KEY": "test-key",
            "PINECONE_INDEX_HOST": "test-index.example",
            "PINECONE_NAMESPACE": "custom_namespace",
        },
    )
    monkeypatch.delenv("PINECONE_API_KEY", raising=False)
    monkeypatch.delenv("PINECONE_INDEX_HOST", raising=False)
    monkeypatch.delenv("PINECONE_NAMESPACE", raising=False)

    assert rag._pinecone_config() == ("test-key", "test-index.example", "custom_namespace")


def test_pinecone_client_initializes_with_configured_host(monkeypatch):
    class FakeIndex:
        pass

    class FakePinecone:
        def __init__(self, *, api_key):
            assert api_key == "test-key"

        def Index(self, *, host):
            assert host == "test-index.example"
            return FakeIndex()

    monkeypatch.setattr(rag, "_pinecone_config", lambda: ("test-key", "test-index.example", "pdf_namespace"))
    monkeypatch.setitem(__import__("sys").modules, "pinecone", SimpleNamespace(Pinecone=FakePinecone))

    pc, index = rag._pinecone_client()

    assert isinstance(pc, FakePinecone)
    assert isinstance(index, FakeIndex)


def test_sync_indexes_searchable_source_metadata(monkeypatch):
    class FakeIndex:
        def __init__(self):
            self.deleted = []
            self.upserted = []

        def delete(self, **kwargs):
            self.deleted.append(kwargs)

        def upsert(self, *, namespace, vectors):
            self.upserted.append((namespace, vectors))

    index = FakeIndex()
    monkeypatch.setattr(rag, "_pinecone_config", lambda: ("test-key", "test-index.example", "pdf_namespace"))
    monkeypatch.setattr(rag, "_embed_texts", lambda _pc, texts, input_type: [[0.1, 0.2] for _ in texts])
    document = rag.RagDocument(
        source_id="note:one",
        content_hash="a" * 64,
        title="Caching",
        source_type="note",
        folder_path="Interview Prep / Systems",
        content="Cache invalidation notes",
    )

    rag._sync_index(None, index, "user-a", [document], ["note:old"])

    namespace, vectors = index.upserted[0]
    assert namespace == "pdf_namespace"
    assert vectors[0]["values"] == [0.1, 0.2]
    assert vectors[0]["metadata"]["text"].startswith("Title: Caching")
    assert vectors[0]["metadata"]["user_id"] == "user-a"
    assert vectors[0]["metadata"]["source_id"] == "note:one"
    assert len(index.deleted) == 1


def test_sync_fails_if_stale_vectors_cannot_be_deleted(monkeypatch):
    class FakeIndex:
        def delete(self, **_kwargs):
            raise RuntimeError("Pinecone delete failed")

    monkeypatch.setattr(rag, "_pinecone_config", lambda: ("test-key", "test-index.example", "pdf_namespace"))

    try:
        rag._sync_index(None, FakeIndex(), "user-a", [], ["note:old"])
    except RuntimeError as exc:
        assert str(exc) == "Pinecone delete failed"
    else:
        raise AssertionError("A failed Pinecone deletion must fail synchronization.")


def test_sync_batches_sources_for_embedding_and_upsert(monkeypatch):
    class FakeIndex:
        def __init__(self):
            self.deleted = []
            self.upsert_batches = []

        def delete(self, **kwargs):
            self.deleted.append(kwargs)

        def upsert(self, *, namespace, vectors):
            self.upsert_batches.append((namespace, vectors))

    embedded_batches = []

    def fake_embed(_pc, texts, input_type):
        embedded_batches.append((texts, input_type))
        return [[0.1, 0.2] for _ in texts]

    monkeypatch.setattr(rag, "_pinecone_config", lambda: ("test-key", "test-index.example", "pdf_namespace"))
    monkeypatch.setattr(rag, "_embed_texts", fake_embed)
    documents = [
        rag.RagDocument(
            source_id=f"note:{index}",
            content_hash=f"{index:064x}",
            title=f"Note {index}",
            source_type="note",
            content=f"Saved note content {index}",
        )
        for index in range(37)
    ]
    index = FakeIndex()

    rag._sync_index(None, index, "user-a", documents, [])

    assert len(index.deleted) == 4
    assert len(embedded_batches) == 1
    assert len(embedded_batches[0][0]) == len(documents)
    assert len(index.upsert_batches) == 1
    assert len(index.upsert_batches[0][1]) == len(documents)


def test_query_uses_only_the_requested_user_namespace(monkeypatch):
    class FakeIndex:
        def query(self, **kwargs):
            assert kwargs["namespace"] == "pdf_namespace"
            assert kwargs["vector"] == [0.1, 0.2]
            assert kwargs["filter"] == {"user_id": {"$eq": "user-a"}}
            return {"matches": [
                {"score": 0.9, "metadata": {
                    "user_id": "user-a", "source_id": "note:one", "title": "One",
                    "text": "Matching text",
                }},
                {"score": 0.99, "metadata": {
                    "user_id": "user-b", "source_id": "note:two", "title": "Two",
                    "text": "Other user's text",
                }},
            ]}

    monkeypatch.setattr(rag, "_pinecone_config", lambda: ("test-key", "test-index.example", "pdf_namespace"))
    monkeypatch.setattr(rag, "_embed_texts", lambda _pc, _texts, input_type: [[0.1, 0.2]])

    results = rag._query_index(None, FakeIndex(), "user-a", "question")

    assert [result["source_id"] for result in results] == ["note:one"]


def test_answer_returns_only_cited_sources_and_caps_lines(monkeypatch):
    class FakeModel:
        def invoke(self, _prompt):
            return type("Message", (), {"content": "First fact [2].\nSecond fact [2].\nThird fact [1].\nFourth fact [1]."})()

    monkeypatch.setattr(rag, "_build_llm", lambda **_kwargs: FakeModel())
    matches = [
        {"source_id": "note:a", "title": "A", "source_type": "note", "folder_path": "Notes", "url": "", "chunk_text": "a"},
        {"source_id": "note:b", "title": "B", "source_type": "note", "folder_path": "Notes", "url": "", "chunk_text": "b"},
    ]

    answer, sources = rag._answer("What is known?", matches)

    assert answer.count("\n") == 2
    assert {source["source_id"] for source in sources} == {"note:a", "note:b"}


def test_answer_has_a_clear_empty_retrieval_response():
    answer, sources = rag._answer("unmatched", [])

    assert "couldn't find" in answer
    assert sources == []
