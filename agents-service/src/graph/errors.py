"""
One place to turn a raised exception into a message a client can be
shown. Used by both /api/chat (main.py) and the Redis-backed SSE runner
(streaming/runner.py) so the two transports report the same failures the
same way instead of drifting apart.

Deliberately never includes a traceback or the raw exception text beyond
a recognised case: that belongs in the server log (logger.exception),
not in a payload a frontend renders to the user.
"""


def friendly_error_detail(exc: Exception) -> str:
    error_text = str(exc).lower()
    if "model" in error_text and ("not found" in error_text or "404" in error_text):
        return (
            "The configured LLM model is unavailable. "
            "Check OLLAMA_MODEL or install the model in Ollama."
        )
    if "serpapi" in error_text:
        return "Search is unavailable because SERPAPI_API_KEY is not configured."
    return "The agent service could not complete the request. Check the service logs."
