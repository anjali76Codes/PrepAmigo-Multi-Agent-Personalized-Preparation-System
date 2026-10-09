"""Per-user, source-cited retrieval over saved notes and plan resources."""
import asyncio
import hashlib
import logging
import os
import re
from typing import Any, Literal

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
SOURCE_DELETE_BATCH_SIZE = 10
SYNC_BATCH_SIZE = 96
ANSWER_TIMEOUT_SECONDS = 45


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


class ResourceSyncRequest(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    documents: list[RagDocument] = Field(default_factory=list, max_length=1000)
    deleted_source_ids: list[str] = Field(default_factory=list, max_length=2000)


class ResourceChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ResourceQueryRequest(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    query: str = Field(min_length=1, max_length=2000)
    history: list[ResourceChatMessage] = Field(default_factory=list, max_length=10)


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

    source_ids_to_replace = sorted(set(deleted_source_ids) | {doc.source_id for doc in documents})
    for batch_start in range(0, len(source_ids_to_replace), SOURCE_DELETE_BATCH_SIZE):
        source_id_batch = source_ids_to_replace[batch_start:batch_start + SOURCE_DELETE_BATCH_SIZE]
        try:
            index.delete(
                filter={"user_id": {"$eq": user_id}, "source_id": {"$in": source_id_batch}},
                namespace=namespace,
            )
        except Exception:
            logger.exception("Pinecone delete failed for changed sources (namespace=%s)", namespace)
            raise

    pending_chunks: list[tuple[RagDocument, int, str]] = []
    for document in documents:
        raw_text = (
            f"Title: {document.title}\nType: {document.source_type}\n"
            f"Folder: {document.folder_path}\n\n{document.content}"
        )
        pending_chunks.extend(
            (document, chunk_index, chunk)
            for chunk_index, chunk in enumerate(_split_text(raw_text))
        )

    for batch_start in range(0, len(pending_chunks), SYNC_BATCH_SIZE):
        batch = pending_chunks[batch_start:batch_start + SYNC_BATCH_SIZE]
        embeddings = _embed_texts(pc, [chunk for _, _, chunk in batch], input_type="passage")
        if len(embeddings) != len(batch):
            raise RuntimeError(
                f"Pinecone returned {len(embeddings)} embeddings for {len(batch)} chunks."
            )

        vectors = []
        for (document, chunk_index, chunk), embedding in zip(batch, embeddings):
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
        except Exception:
            logger.exception("Pinecone upsert failed (namespace=%s)", namespace)
            raise

    logger.info(
        "Synchronized %d source(s) into %d chunk(s) for user=%s in namespace=%s",
        len(documents),
        len(pending_chunks),
        user_id,
        namespace,
    )


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
    raw_matches = result.get("matches", [])
    
    def extract_match(match):
        metadata = match.get("metadata", {}) or {}
        if metadata.get("user_id") != user_id:
            return None
        return {
            "source_id": str(metadata.get("source_id", "")),
            "title": str(metadata.get("title", "Resource")),
            "source_type": str(metadata.get("source_type", "resource")),
            "folder_path": str(metadata.get("folder_path", "")),
            "url": str(metadata.get("url", "")),
            "chunk_text": str(metadata.get("text", "")),
            "score": float(match.get("score", 0)),
        }

    for match in raw_matches:
        if float(match.get("score", 0)) < MIN_SCORE:
            continue
        extracted = extract_match(match)
        if extracted:
            matches.append(extracted)
            
    # Fallback for general queries like "summarize my notes" that have low semantic overlap
    if not matches and raw_matches:
        for match in raw_matches:
            extracted = extract_match(match)
            if extracted:
                matches.append(extracted)

    # Merge chunks from the same source, highest score wins the slot
    unique: dict[str, dict[str, Any]] = {}
    for match in matches:
        previous = unique.get(match["source_id"])
        if previous:
            previous["chunk_text"] += "\n\n" + match["chunk_text"]
        else:
            unique[match["source_id"]] = match
    return list(unique.values())


def _answer(
    question: str,
    matches: list[dict[str, Any]],
    history: list[dict[str, str]] | None = None,
) -> tuple[str, list[dict[str, str]]]:
    conversation = [
        item for item in (history or [])
        if item.get("role") in {"user", "assistant"} and item.get("content", "").strip()
    ][-10:]
    if not matches and not conversation:
        return "This question is out of scope! I can only answer questions related to your saved notes and preparation plan.", []
    excerpts = "\n\n".join(
        f"[{index}] {match['title']} ({match['folder_path'] or match['source_type']})\n{match['chunk_text']}"
        for index, match in enumerate(matches, start=1)
    )
    transcript = "\n".join(
        f"{'User' if item['role'] == 'user' else 'Assistant'}: {item['content'][:4000]}"
        for item in conversation
    ) or "(No earlier conversation.)"
    prompt = (
        "You are a Resource Assistant. Use the conversation history to understand follow-ups and answer questions "
        "about what was previously asked or answered. For facts about the user's saved resources, use only the "
        "provided excerpts; conversation history is context, not a source of resource facts. Keep the answer to "
        "at most 3 short lines.\n"
        "- Speak directly to the user (e.g., 'Your notes say...').\n"
        "- Do NOT say 'The provided text states...'.\n"
        "- Output clean plain text. Do NOT use markdown bolding (**) or bullet points.\n"
        "- Cite resource facts with excerpt numbers like [1]. A reply about prior conversation does not need a source citation.\n"
        "- If the user asks about resources but there are no relevant excerpts, or asks an unrelated general question "
        "that does not refer to this conversation, reply EXACTLY with: 'This question is out of scope! I can only "
        "answer questions related to your saved notes and preparation plan.'\n\n"
        f"Conversation history:\n{transcript}\n\n"
        f"Current question: {question}\n\n"
        f"Resource excerpts:\n{excerpts or '(No matching resource excerpts.)'}"
    )
    try:
        message = _build_llm(temperature=0, max_tokens=180).invoke(prompt)
        content = getattr(message, "content", message)
        if isinstance(content, list):
            content = " ".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        lines = [line.strip().replace("**", "").replace("*", "") for line in str(content).splitlines() if line.strip()]
        answer = "\n".join(lines[:3])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The resource assistant could not answer from the retrieved resources.") from exc

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
    if not sources and matches and not conversation:
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
        answer = f"{answer.rstrip()} [1]" if answer.strip() else "This question is out of scope! I can only answer questions related to your saved notes and preparation plan."
        sources = sources[:1]
    return answer or "This question is out of scope! I can only answer questions related to your saved notes and preparation plan.", sources


def _validated_user_id(auth_payload: Any, requested_user_id: str | None) -> str:
    user_id = resolve_user_id(auth_payload, requested_user_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="An authenticated user is required.")
    if auth_payload is not True and user_id != requested_user_id:
        raise HTTPException(status_code=403, detail="The request user does not match the authenticated user.")
    return user_id


@router.post("/internal/resources/sync")
async def sync_resources(
    request: ResourceSyncRequest,
    auth_payload: Any = Depends(verify_token),
) -> dict[str, Any]:
    user_id = _validated_user_id(auth_payload, request.user_id)
    pc, index = _pinecone_client()
    try:
        await asyncio.to_thread(
            _sync_index,
            pc,
            index,
            user_id,
            request.documents,
            request.deleted_source_ids,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Resource indexing failed (error=%s)", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Resource indexing failed. Check the agents-service log for the underlying error.",
        ) from exc
    return {
        "success": True,
        "data": {
            "synced_sources": len(request.documents),
            "deleted_sources": len(request.deleted_source_ids),
        },
    }


@router.post("/internal/resources/query")
async def query_resources(
    request: ResourceQueryRequest,
    auth_payload: Any = Depends(verify_token),
) -> dict[str, Any]:
    user_id = _validated_user_id(auth_payload, request.user_id)
    pc, index = _pinecone_client()
    try:
        history = [
            message.model_dump() for message in request.history
            if message.content.strip()
        ][-10:]
        retrieval_query = "\n".join(
            [*(message["content"][:500] for message in history[-4:]), request.query]
        )[-2000:]
        matches = await asyncio.to_thread(_query_index, pc, index, user_id, retrieval_query)
        answer, sources = await asyncio.wait_for(
            asyncio.to_thread(_answer, request.query, matches, history),
            timeout=ANSWER_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        logger.error("Resource answer generation exceeded %d seconds", ANSWER_TIMEOUT_SECONDS)
        raise HTTPException(
            status_code=504,
            detail="Resource answer generation timed out. Your resources are indexed; please try again.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Resource search failed (error=%s)", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Resource search failed. Check the agents-service log for the underlying error.",
        ) from exc
    return {"success": True, "data": {"answer": answer, "sources": sources}}


@router.post("/internal/resources/sync-and-query")
async def sync_and_query(request: ResourceRagRequest, auth_payload: Any = Depends(verify_token)) -> dict[str, Any]:
    user_id = _validated_user_id(auth_payload, request.user_id)

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
