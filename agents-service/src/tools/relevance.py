"""
Deterministic result hygiene shared by the research agents: is a search
result actually about the topic, and are two links the same resource.

Kept free of any LLM call on purpose: it runs on every result of every
search, so it has to be instant and predictable. It catches the failure
modes seen in real plans: a query whose topic words Google dropped
("Voting Assistance Guide" for a pre-sales query, the Wikipedia "Book"
page for "best books to learn Claude"), and the same video returned twice
under slightly different URLs.
"""
import re
from urllib.parse import parse_qs, urlencode, urlparse

_STOPWORDS = {
    "a", "an", "and", "the", "of", "for", "in", "on", "to", "with", "by", "or", "at", "as", "vs",
}
# query parameters that never change which resource a URL points at
_TRACKING_PARAMS = {"vl", "si", "feature", "ref", "ref_src", "fbclid", "gclid", "t", "pp"}
_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def _words(text: str) -> list[str]:
    # hyphenated/apostrophe compounds become one word: "Pre-Sales" -> "presales"
    joined = re.sub(r"(?<=\w)[-'’](?=\w)", "", text.casefold())
    return re.findall(r"[a-z0-9+#]+", joined)


def topic_terms(topic: str) -> list[str]:
    return [w for w in dict.fromkeys(_words(topic)) if w not in _STOPWORDS]


def _matches(term: str, words: set[str], squashed: str) -> bool:
    if len(term) <= 3:
        return term in words  # short terms ("ai", "go", "sql") only as whole words
    # longer terms also match inside compounds and inflections: "sales" in
    # "presales", "engineering" via "engineer" in "engineers"
    return term[: max(4, len(term) - 3)] in squashed


def relevance(topic: str, *texts: str) -> float:
    """Fraction of the topic's significant words that appear in `texts`."""
    terms = topic_terms(topic)
    if not terms:
        return 1.0
    words = _words(" ".join(t for t in texts if t))
    found, squashed = set(words), "".join(words)
    return sum(1 for term in terms if _matches(term, found, squashed)) / len(terms)


def youtube_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.casefold().removeprefix("www.").removeprefix("m.")
    if host == "youtu.be":
        candidate = parsed.path.lstrip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        candidate = parse_qs(parsed.query).get("v", [""])[0]
    else:
        return None
    return candidate if _VIDEO_ID.fullmatch(candidate or "") else None


def canonical_url(url: str) -> str:
    """A key that is equal for two links to the same resource: one key per
    YouTube video whatever the URL form, otherwise host + path + the query
    parameters that matter (tracking/locale parameters and fragments dropped)."""
    video_id = youtube_video_id(url)
    if video_id:
        return f"youtube:{video_id}"
    parsed = urlparse(url.strip())
    host = parsed.netloc.casefold().removeprefix("www.")
    query = {
        k: v for k, v in parse_qs(parsed.query).items()
        if k.casefold() not in _TRACKING_PARAMS and not k.casefold().startswith("utm_")
    }
    path = parsed.path.rstrip("/") or "/"
    return f"{host}{path}" + (f"?{urlencode(sorted(query.items()), doseq=True)}" if query else "")


def title_key(title: str) -> str:
    """Case-, punctuation- and spacing-insensitive: "Step-by-Step" and
    "step by step" give the same key."""
    return "".join(_words(title))


# ---- is this page something to study from? --------------------------------
# Signals of page *kinds* that are never learning material, whatever the
# topic. Deliberately about the kind of page (a job advert, a sales page),
# never about a particular company, site or subject.
_JOB_HOST = re.compile(r"(^|[.\-])(jobs?|careers?|hiring|recruit\w*|placement\w*|vacanc\w*|talents?)([.\-]|$)")
# a listing under the section ("/job/330/..."), not a page that is merely
# named after the word ("/docs/.../controllers/job/")
_JOB_PATH = re.compile(r"/(jobs?|job-search|careers?|vacanc\w*|job-?openings?)/[^/]")
_DOCS_URL = re.compile(r"(^docs?\.|/docs?/|/documentation/|/reference/|/manual/)")
_JOB_TITLE = re.compile(
    r"\b(job (vacanc\w+|information|description|openings?)|vacanc(y|ies)|we(?:'re| are) hiring|apply now|"
    r"hiring now|job in\b|jobs in\b)", re.I)
_SALES_TEXT = re.compile(
    r"\b(request a demo|book a (demo|call|consultation)|get a quote|free consultation|contact (us|sales)|"
    r"our (services|solutions|consultants)|pricing plans?|schedule a (demo|call))\b", re.I)


def not_learning_material(url: str, title: str = "", snippet: str = "") -> str:
    """Why a search result is not study material ("job posting", "sales
    page"), or "" when nothing says it isn't. Catches what topic matching
    cannot: a job advert for the skill mentions the skill in every line."""
    parsed = urlparse(url)
    host, path = parsed.netloc.casefold().removeprefix("www."), parsed.path.casefold()
    is_docs = bool(_DOCS_URL.search(host) or _DOCS_URL.search(path))
    if _JOB_HOST.search(host) or (not is_docs and _JOB_PATH.search(path)) or _JOB_TITLE.search(title):
        return "job posting"
    if _SALES_TEXT.search(f"{title} {snippet}"):
        return "sales page"
    return ""
