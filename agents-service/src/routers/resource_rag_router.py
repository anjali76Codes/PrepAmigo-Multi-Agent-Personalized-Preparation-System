"""Per-user, source-cited retrieval over saved notes and plan resources."""
import asyncio
import hashlib
import logging
import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from dotenv import dotenv_values
from pydantic import BaseModel, Field

from core.auth import resolve_user_id, verify_token
from core.config import PACKAGE_ROOT, _build_llm, settings

router = APIRouter()
logger = logging.getLogger(__name__)
CHUNK_CHARS = 1800
CHUNK_OVERLAP = 180
MAX_MATCHES = 6
MIN_SCORE = 0.2
EMBED_MODEL = "llama-text-embed-v2"
EMBED_DIMENSION = 768  # must match the Pinecone index dimension


class RagDocument(BaseModel):
    source_id: str = Field(min_length=1, max_length=300)
    content_hash: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=300)
    source_type: str = Field(min_length=1, max_length=80)
    folder_path: str = Field(default="", max_length=1000)
    content: str = Field(min_length=1, max_length=100000)
    url: str = Field(default="", max_length=2048)


class ResourceRagRequest(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    query: str = Field(min_length=1, max_length=2000)
    documents: list[RagDocument] = Field(default_factory=list, max_length=1000)
    deleted_source_ids: list[str] = Field(default_factory=list, max_length=2000)


def _field(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _pinecone_config() -> tuple[str, str, str]:
    local_env = dotenv_values(PACKAGE_ROOT / ".env")
    api_key = (
        os.getenv("PINECONE_API_KEY")
        or settings.pinecone_api_key
        or local_env.get("PINECONE_API_KEY")
        or ""
    ).strip()
    index_host = (
        os.getenv("PINECONE_INDEX_HOST")
        or settings.pinecone_index_host
        or local_env.get("PINECONE_INDEX_HOST")
        or ""
    ).strip()
    namespace = (
        os.getenv("PINECONE_NAMESPACE")
        or local_env.get("PINECONE_NAMESPACE")
        or "pdf_namespace"
    ).strip() or "pdf_namespace"
    return api_key, index_host, namespace


def _pinecone_client():
    api_key, index_host, _ = _pinecone_config()
    if not api_key or not index_host:
        missing = [
            name
            for name, value in (
                ("PINECONE_API_KEY", api_key),
                ("PINECONE_INDEX_HOST", index_host),
            )
            if not value
        ]
        raise HTTPException(
            status_code=503,
            detail=f"Resource retrieval is missing configuration: {', '.join(missing)}.",
        )
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=api_key)
        index = pc.Index(host=index_host)
        return pc, index
    except Exception as exc:
        logger.error("Could not initialize Pinecone client (error type: %s)", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Could not connect to the resource index.") from exc


def _embed_texts(pc: Any, texts: list[str], input_type: str = "passage") -> list[list[float]]:
    """Embed a list of texts using Pinecone Inference API at the index dimension."""
    if not texts:
        return []
    try:
        result = pc.inference.embed(
            model=EMBED_MODEL,
            inputs=texts,
            parameters={"input_type": input_type, "truncate": "END", "dimension": EMBED_DIMENSION},
        )
        return [item.values for item in result]
    except Exception as exc:
        logger.error("Pinecone embed failed (model=%s, error=%s)", EMBED_MODEL, type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"Could not embed text via Pinecone Inference ({type(exc).__name__}): {exc}",
        ) from exc


def _split_text(text: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        stride = CHUNK_CHARS - CHUNK_OVERLAP
        pieces = [
            paragraph[index:index + CHUNK_CHARS]
            for index in range(0, len(paragraph), stride)
        ] if len(paragraph) > CHUNK_CHARS else [paragraph]
        for piece in pieces:
            candidate = f"{current}\n\n{piece}".strip() if current else piece
            if len(candidate) <= CHUNK_CHARS:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                current = piece
    if current:
        chunks.append(current)
    return chunks


def _sync_index(pc: Any, index: Any, user_id: str, documents: list[RagDocument],
                deleted_source_ids: list[str]) -> None:
    _, _, namespace = _pinecone_config()

    # Delete by metadata filter for deletions
    if deleted_source_ids:
        try:
            index.delete(
                filter={"user_id": {"$eq": user_id}, "source_id": {"$in": deleted_source_ids}},
                namespace=namespace,
            )
        except Exception:
            logger.exception("Pinecone delete failed for removed sources (namespace=%s)", namespace)
            raise

    for document in documents:
        # Delete existing chunks for this source before re-upserting
        try:
            index.delete(
                filter={"user_id": {"$eq": user_id}, "source_id": {"$eq": document.source_id}},
                namespace=namespace,
            )
        except Exception:
            logger.exception(
                "Pinecone delete failed before source refresh (namespace=%s, source=%s)",
                namespace,
                document.source_id,
            )
            raise

        # Chunk the text
        raw_text = (
            f"Title: {document.title}\nType: {document.source_type}\n"
            f"Folder: {document.folder_path}\n\n{document.content}"
        )
        chunks = _split_text(raw_text)
        if not chunks:
            continue

        # Process in batches of 96 (Pinecone embed max_batch_size)
        BATCH = 96
        for batch_start in range(0, len(chunks), BATCH):
            batch_chunks = chunks[batch_start:batch_start + BATCH]
            batch_indices = list(range(batch_start, batch_start + len(batch_chunks)))

            # Embed the batch
            embeddings = _embed_texts(pc, batch_chunks, input_type="passage")

            vectors = []
            for offset, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings)):
                chunk_index = batch_start + offset
                record_id = hashlib.sha256(
                    f"{user_id}:{document.source_id}:{document.content_hash}:{chunk_index}".encode("utf-8")
                ).hexdigest()
                vectors.append({
                    "id": record_id,
                    "values": embedding,
                    "metadata": {
                        "text": chunk,
                        "user_id": user_id,
                        "source_id": document.source_id,
                        "content_hash": document.content_hash,
                        "chunk_index": chunk_index,
                        "title": document.title,
                        "source_type": document.source_type,
                        "folder_path": document.folder_path,
                        "url": document.url,
                    },
                })

            try:
                index.upsert(vectors=vectors, namespace=namespace)
                logger.info(
                    "Upserted %d chunk(s) for source '%s' (user=%s, namespace=%s)",
                    len(vectors), document.source_id, user_id, namespace,
                )
            except Exception as exc:
                logger.exception(
                    "Pinecone upsert failed (namespace=%s, source=%s, error=%s)",
                    namespace,
                    document.source_id,
                    type(exc).__name__,
                )
                raise


def _query_index(pc: Any, index: Any, user_id: str, query: str) -> list[dict[str, Any]]:
    _, _, namespace = _pinecone_config()

    # Embed the query
    query_embeddings = _embed_texts(pc, [query], input_type="query")
    if not query_embeddings:
        return []
    query_vector = query_embeddings[0]

    result = index.query(
        namespace=namespace,
        vector=query_vector,
        top_k=MAX_MATCHES,
        include_metadata=True,
        filter={"user_id": {"$eq": user_id}},
    )

    matches = []
    for match in result.get("matches", []):
        score = float(match.get("score", 0))
        if score < MIN_SCORE:
            continue
        metadata = match.get("metadata", {}) or {}
        if metadata.get("user_id") != user_id:
            continue
        matches.append({
            "source_id": str(metadata.get("source_id", "")),
            "title": str(metadata.get("title", "Resource")),
            "source_type": str(metadata.get("source_type", "resource")),
            "folder_path": str(metadata.get("folder_path", "")),
            "url": str(metadata.get("url", "")),
            "chunk_text": str(metadata.get("text", "")),
            "score": score,
        })

    # Merge chunks from the same source, highest score wins the slot
    unique: dict[str, dict[str, Any]] = {}
    for match in matches:
        previous = unique.get(match["source_id"])
        if previous:
            previous["chunk_text"] += "\n\n" + match["chunk_text"]
        else:
            unique[match["source_id"]] = match
    return list(unique.values())


def _answer(question: str, matches: list[dict[str, Any]]) -> tuple[str, list[dict[str, str]]]:
    if not matches:
        return "I couldn't find a relevant answer in your saved resources.", []
    excerpts = "\n\n".join(
        f"[{index}] {match['title']} ({match['folder_path'] or match['source_type']})\n{match['chunk_text']}"
        for index, match in enumerate(matches, start=1)
    )
    prompt = (
        "Answer the user's question using only the provided resource excerpts. "
        "Write at most 3 short lines. Cite each factual claim with the excerpt number, like [1]. "
        "If the excerpts do not contain the answer, say that clearly and do not guess.\n\n"
        f"Question: {question}\n\nResource excerpts:\n{excerpts}"
    )
    try:
        message = _build_llm(temperature=0, max_tokens=180).invoke(prompt)
        content = getattr(message, "content", message)
        if isinstance(content, list):
            content = " ".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        lines = [line.strip() for line in str(content).splitlines() if line.strip()]
        answer = "\n".join(lines[:3])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Ollama could not answer from the retrieved resources.") from exc

    cited_numbers = {int(number) for number in re.findall(r"\[(\d+)\]", answer)}
    sources = [
        {
            "source_id": match["source_id"],
            "title": match["title"],
            "source_type": match["source_type"],
            "folder_path": match["folder_path"],
            "url": match["url"],
        }
        for number, match in enumerate(matches, start=1)
        if number in cited_numbers
    ]
    if not sources:
        sources = [
            {
                "source_id": match["source_id"],
                "title": match["title"],
                "source_type": match["source_type"],
                "folder_path": match["folder_path"],
                "url": match["url"],
            }
            for match in matches[:3]
        ]
        answer = f"{answer.rstrip()} [1]" if answer.strip() else "I couldn't find a supported answer in your resources."
        sources = sources[:1]
    return answer or "I couldn't find a supported answer in your resources.", sources


@router.post("/internal/resources/sync-and-query")
async def sync_and_query(request: ResourceRagRequest, auth_payload: Any = Depends(verify_token)) -> dict[str, Any]:
    user_id = resolve_user_id(auth_payload, request.user_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="An authenticated user is required.")
    if auth_payload is not True and user_id != request.user_id:
        raise HTTPException(status_code=403, detail="The request user does not match the authenticated user.")

    pc, index = _pinecone_client()
    stage = "index synchronization"
    try:
        await asyncio.to_thread(
            _sync_index,
            pc,
            index,
            user_id,
            request.documents,
            request.deleted_source_ids,
        )
        stage = "Pinecone semantic search"
        matches = await asyncio.to_thread(_query_index, pc, index, user_id, request.query)
        stage = "Ollama answer generation"
        answer, sources = await asyncio.to_thread(_answer, request.query, matches)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        logger.exception("Resource RAG failed during %s (error=%s)", stage, type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"Resource search failed during {stage}. Check the agents-service log for the underlying error.",
        ) from exc
    return {"success": True, "data": {"answer": answer, "sources": sources}}
