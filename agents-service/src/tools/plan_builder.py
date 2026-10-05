"""
Study-plan builder: the deterministic half of the Planner (no LLM, no I/O).

Turns skill gaps + research modules + per-day wording into the backend's
plan shape (schemas/study_plan.py: plan -> sprints -> sprint_days) and
validates it. agents/planner_agent.py only supplies the wording; every
structural decision is made here:

  plan_topics      which topics get planned, in priority order, with the
                   concepts/overview/references taken from their module
  allocate_days    how many days each topic gets (by priority weight)
  fallback_days    concept-based wording for any days the model didn't write
  assemble_plan    sprints, dates, numbering, references per day, resource
                   pack and coverage, validated against StudyPlan

Because the model never writes structure, the JSON is always valid: a
model change or a bad model answer can only change the wording of the days.
"""
import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote_plus

from schemas.study_plan import SCHEMA_VERSION, StudyPlan
from tools.relevance import canonical_url, relevance, title_key, topic_terms, youtube_video_id
from tools.text_sanitize import sanitize_data, sanitize_text

# share of the plan's days each gap gets, by the skill-gap agent's effort
# level (High = a missing skill, Medium = a partial one)
EFFORT_WEIGHTS = {"High": 2, "Medium": 1}
MINUTES_PER_EFFORT = {"High": 90, "Medium": 60}
DEFAULT_MINUTES = 60
KEY_CONCEPTS_PER_TOPIC = 8
MAX_OBJECTIVES_PER_DAY = 4

# research resource_type -> the backend's reference `type` enum
REFERENCE_TYPES = {
    "documentation": "documentation",
    "book": "book",
    "video": "video",
    "paper": "article",
}


def _section(markdown: str, heading: str) -> str:
    match = re.search(rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)", markdown, re.M | re.S | re.I)
    return match.group(1).strip() if match else ""


def key_concepts(markdown: str) -> list[str]:
    """Bullet names from a module's "## Key Concepts" section: the bold
    part of "- **Name**: detail", else the text before the first colon."""
    concepts = []
    for line in _section(markdown, "Key Concepts").splitlines():
        line = line.strip()
        if not line.startswith(("-", "*")):
            continue
        text = line.lstrip("-* ").strip()
        bold = re.match(r"\*\*(.+?)\*\*", text)
        name = bold.group(1) if bold else re.split(r"[:–—-]\s", text, maxsplit=1)[0]
        name = name.strip(" *:")
        if name:
            concepts.append(name)
    return concepts[:KEY_CONCEPTS_PER_TOPIC]


def overview(markdown: str) -> str:
    text = _section(markdown, "Overview")
    return " ".join(text.split())[:600]


def clip(text: Any, limit: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."


def split_evenly(items: list[Any], parts: int) -> list[list[Any]]:
    """Distribute items across `parts` contiguous, near-equal groups."""
    size, extra = divmod(len(items), parts)
    groups, start = [], 0
    for i in range(parts):
        end = start + size + (1 if i < extra else 0)
        groups.append(items[start:end])
        start = end
    return groups


def allocate_days(weights: list[int], total: int) -> list[int]:
    """Split `total` days across topics in proportion to `weights`
    (largest-remainder rounding, so the parts always sum to `total`), with
    at least one day each. With fewer days than topics, the first `total`
    topics (highest priority) get one day and the rest none."""
    if total < len(weights):
        return [1 if i < total else 0 for i in range(len(weights))]
    spare = total - len(weights)  # one day each is guaranteed
    weight_sum = sum(weights) or 1
    exact = [spare * w / weight_sum for w in weights]
    days = [1 + int(x) for x in exact]
    by_remainder = sorted(range(len(weights)), key=lambda i: exact[i] - int(exact[i]), reverse=True)
    for i in by_remainder[: total - sum(days)]:
        days[i] += 1
    return days


def fallback_days(topic: str, concepts: list[str], days: int) -> list[dict[str, Any]]:
    """Deterministic, non-repeating wording for `days` days of one topic,
    built from its own key concepts: learn the concepts first, then (on
    longer allocations) practice them, ending with a review/project day."""
    concepts = concepts or [topic]
    practice_days = 0 if days < 3 else max(1, days // 3)
    learn_days = min(len(concepts), days - practice_days)
    practice_days = days - learn_days

    plan = []
    for group in split_evenly(concepts, learn_days):
        plan.append({
            "title": f"{topic}: {', '.join(group[:2])}",
            "objectives": [f"Explain {concept} and when it applies" for concept in group[:3]],
        })
    for i in range(practice_days):
        if i == practice_days - 1:
            plan.append({
                "title": f"{topic}: review and mini-project",
                "objectives": [f"Review the {topic} concepts covered so far",
                               f"Build a small project that applies {topic}"],
            })
            continue
        concept = concepts[i % len(concepts)]
        round_note = f" (round {i // len(concepts) + 1})" if i >= len(concepts) else ""
        plan.append({
            "title": f"{topic} practice: {concept}{round_note}",
            "objectives": [f"Apply {concept} in a hands-on exercise", f"Note open questions about {concept}"],
        })
    if practice_days == 0:
        plan[-1]["objectives"].append(f"Apply {topic} in a small hands-on exercise")
    return plan


def parse_json_object(text: str) -> dict[str, Any]:
    """The first JSON object in a model reply, tolerating code fences and
    prose around it."""
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.I).strip()
    start = cleaned.find("{")
    if start < 0:
        raise ValueError("no JSON object in model output")
    obj, _ = json.JSONDecoder().raw_decode(cleaned[start:])
    if not isinstance(obj, dict):
        raise ValueError("model output is not a JSON object")
    return obj


def references(resources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Research resources as backend references, deduped (the same
    video/page under another URL, or found by two searches)."""
    refs, seen = [], set()
    for resource in resources:
        url = str(resource.get("url") or "").strip()
        title = clip(resource.get("title"), 300)
        if not url.startswith(("http://", "https://")) or not title:
            continue
        keys = {canonical_url(url), f"title:{title_key(title)}"}
        if keys & seen:
            continue
        seen |= keys
        resource_type = "video" if youtube_video_id(url) else resource.get("resource_type", "")
        ref = {
            "type": REFERENCE_TYPES.get(resource_type, "article"),
            "title": title,
            "url": url[:2048],
        }
        if resource.get("source"):
            ref["source"] = clip(resource["source"], 200)
        if resource.get("snippet"):
            ref["description"] = clip(resource["snippet"], 2000)
        refs.append(ref)
    return refs


def resource_pack(modules: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """All curated resources grouped by type and deduped, for the
    frontend's Resource Pack view."""
    groups: dict[str, list[dict[str, Any]]] = {}
    seen: set[str] = set()
    for module in modules:
        for resource in module.get("resources") or []:
            url = resource.get("url")
            if not url:
                continue
            name = title_key(resource.get("title", ""))
            keys = {canonical_url(url)} | ({f"title:{name}"} if name else set())
            if keys & seen:
                continue
            seen |= keys
            resource_type = "video" if youtube_video_id(url) else resource.get("resource_type", "other")
            groups.setdefault(resource_type, []).append({
                "title": resource.get("title", ""),
                "url": url,
                "snippet": resource.get("snippet", ""),
                "topic": module.get("topic", ""),
            })
    return groups


MAX_REFERENCES_PER_DAY = 3
MAX_REVISIT_REFERENCES = 2
MATCH_THRESHOLD = 0.5


def place_references(refs: list[dict[str, Any]], day_titles: list[str], topic_name: str) -> list[list[dict[str, Any]]]:
    """Each reference on the day it is about. A reference whose title or
    description covers a day's subject (the day title's words, minus the
    topic's own name, which every reference shares) goes to that day;
    general ones ("Java Tutorial") fill the emptiest days from the start
    of the topic. Dealing them out in search order put "Why Java Is So
    Hard To Learn" on the Exception Handling day.

    Days left empty are the ones nothing was written about, typically the
    closing practice and review days; revisit_references fills them."""
    days = len(day_titles)
    placed: list[list[dict[str, Any]]] = [[] for _ in range(days)]
    if not days:
        return placed
    shared = set(topic_terms(topic_name))
    subjects = [" ".join(t for t in topic_terms(title) if t not in shared) for title in day_titles]
    general = []
    for ref in refs:
        text = f"{ref.get('title', '')} {ref.get('description', '')}"
        scores = [relevance(subject, text) if subject else 0.0 for subject in subjects]
        open_days = [i for i in range(days) if len(placed[i]) < MAX_REFERENCES_PER_DAY]
        best = max(open_days, key=lambda i: (scores[i], -len(placed[i]), -i), default=None)
        if best is not None and scores[best] >= MATCH_THRESHOLD:
            placed[best].append(ref)
        else:
            general.append(ref)
    for ref in general:
        # earliest of the emptiest days: overview material belongs early
        target = min(range(days), key=lambda i: (len(placed[i]), i))
        if len(placed[target]) < MAX_REFERENCES_PER_DAY:
            placed[target].append(ref)
    return placed


def revisit_references(
    placed: list[list[dict[str, Any]]], refs: list[dict[str, Any]], day_titles: list[str], topic_name: str,
) -> list[list[dict[str, Any]]]:
    """Every day `placed` left empty (a topic's practice and review days,
    or more days than references) gets the topic's references that fit it
    best again, as optional material (is_required False): the doc or video
    to keep open while doing the exercise. Best fit is the day's subject
    as in place_references; a day with no subject of its own ("review and
    mini-project") gets the topic's leading references, which research
    returns best first."""
    if not refs:
        return placed
    shared = set(topic_terms(topic_name))
    for i, title in enumerate(day_titles):
        if placed[i]:
            continue
        subject = " ".join(t for t in topic_terms(title) if t not in shared)
        score = lambda k: relevance(subject, refs[k].get("title", ""), refs[k].get("description", "")) if subject else 0.0  # noqa: E731
        best = sorted(range(len(refs)), key=lambda k: (-score(k), k))[:MAX_REVISIT_REFERENCES]
        placed[i] = [{**refs[k], "is_required": False} for k in best]
    return placed


def _key(ref: dict[str, Any]) -> str:
    return canonical_url(ref["url"])


def _unique(refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    return [ref for ref in refs if not (_key(ref) in seen or seen.add(_key(ref)))]


def choose_references(
    placed: list[list[dict[str, Any]]], days: list[dict[str, Any]],
    allowed: list[dict[str, Any]], companions: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:
    """The planner model's per-day choice wins over word-matching placement.
    A day's wording may carry "found" (references a gap search found for
    that day) and "refs" (the topic's references the model picked for that
    day, best first); either replaces the computed placement for that day.
    Picks are kept only if they are among `allowed` (so a book past the
    plan's cap stays out), and the topic's book/paper companions stay on
    its first day. A day the model wrote without picks (concept-based
    fallback wording) keeps the computed placement."""
    permitted = {_key(ref) for ref in allowed}
    chosen = []
    for i, day in enumerate(days):
        picks = [ref for ref in day.get("refs") or [] if _key(ref) in permitted]
        refs = _unique([*(day.get("found") or []), *picks])[:MAX_REFERENCES_PER_DAY]
        if refs and i == 0:
            refs = _unique(refs + companions)
        chosen.append(refs or placed[i])
    return chosen


def mark_required(per_day: list[list[dict[str, Any]]]) -> list[list[dict[str, Any]]]:
    """is_required on each day's first reference, unless the topic already
    used it on an earlier day: a repeat is there to keep open while
    practising, not to read again. Anything else is optional."""
    seen: set[str] = set()
    marked = []
    for refs in per_day:
        day = []
        for j, ref in enumerate(refs):
            required = j == 0 and _key(ref) not in seen and ref.get("is_required", True)
            day.append({**ref, "is_required": bool(required)})
        seen |= {_key(ref) for ref in refs}
        marked.append(day)
    return marked


def borrow_references(topics: list[dict[str, Any]], modules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`topics`, each one without references of its own (its research was
    capped, failed or found nothing) given what other topics' research
    found about it (related_references), marked "borrowed". Done before the
    planner's wording calls, so the model can pick among them too."""
    pool = references([r for m in modules for r in m.get("resources") or []])
    borrowed = []
    for topic in topics:
        refs = [] if topic["references"] else related_references(topic["name"], pool)
        borrowed.append({**topic, "references": refs, "borrowed": True} if refs else topic)
    return borrowed


def related_references(topic_name: str, pool: list[dict[str, Any]], limit: int = MAX_REFERENCES_PER_DAY) -> list[dict[str, Any]]:
    """References other topics' research found that are about `topic_name`
    (every significant word of it in the title or description), for a
    topic whose own research did not run or failed."""
    return [
        ref for ref in pool
        if relevance(topic_name, ref.get("title", ""), ref.get("description", "")) >= 1.0
    ][:limit]


def search_references(topic_name: str) -> list[dict[str, Any]]:
    """Last resort for a topic nothing was found for: links to a video
    search and a documentation search on the topic. Labelled as searches,
    so they are never mistaken for a curated resource."""
    name = clip(topic_name, 150)
    return [
        {"type": "video", "title": f"{name} tutorials (YouTube search)", "source": "YouTube search",
         "url": f"https://www.youtube.com/results?search_query={quote_plus(f'{name} tutorial')}",
         "description": f"Video search for {name}; no curated resource was found for this topic."},
        {"type": "documentation", "title": f"{name} documentation (web search)", "source": "Web search",
         "url": f"https://www.google.com/search?q={quote_plus(f'{name} official documentation')}",
         "description": f"Web search for {name} documentation; no curated resource was found for this topic."},
    ]


def _topic(name: str, effort: str, module: dict[str, Any] | None) -> dict[str, Any]:
    markdown = (module or {}).get("content_markdown", "")
    return {
        "key": name.casefold(),
        "name": name,
        "effort": effort,
        "researched": module is not None,
        "concepts": key_concepts(markdown),
        "overview": overview(markdown),
        "references": references((module or {}).get("resources") or []),
        "paper_urls": {str(r.get("url") or "").strip()[:2048] for r in (module or {}).get("resources") or []
                       if r.get("resource_type") == "paper"},
    }


def plan_topics(modules: list[dict[str, Any]], priority_gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Topics in priority order: every gap (missing before partial, each
    group in the skill-gap agent's own order), then any researched module
    that matched no gap."""
    by_key = {str(m.get("topic", "")).strip().casefold(): m for m in modules if m.get("topic")}
    gaps = sorted(priority_gaps, key=lambda g: 0 if g.get("effort") == "High" else 1)
    topics, seen = [], set()
    for gap in gaps:
        name = str(gap.get("skill", "")).strip()
        key = name.casefold()
        if not name or key in seen:
            continue
        seen.add(key)
        topics.append({
            **_topic(name, gap.get("effort", "Medium"), by_key.get(key)),
            # what the candidate already has, for pitching the days' level
            "status": gap.get("status", ""),
            "evidence": clip(gap.get("evidence", ""), 200),
        })
    for key, module in by_key.items():
        if key not in seen:
            seen.add(key)
            topics.append(_topic(module["topic"], "Medium", module))
    return topics


def schedule(
    topics: list[dict[str, Any]], total_days: int, max_topics: int = 0, min_days_per_topic: int = 1,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Give each topic its day count (topic["days"]); returns (scheduled
    topics, names of the topics left out).

    Depth over breadth: at most `max_topics` topics (0 = no cap), and no
    more than fit with `min_days_per_topic` days each, highest priority
    first. 28 gaps in 45 days used to become 28 one- and two-day sprints,
    which nobody can learn from; the rest are reported as not scheduled."""
    fit = max(1, total_days // max(1, min_days_per_topic))
    keep = min(len(topics), fit, max_topics or len(topics))
    chosen, left_out = topics[:keep], topics[keep:]
    allocation = allocate_days([EFFORT_WEIGHTS.get(t["effort"], 1) for t in chosen], total_days)
    scheduled = [{**t, "days": days} for t, days in zip(chosen, allocation) if days]
    return scheduled, [t["name"] for t, days in zip(chosen, allocation) if not days] + [t["name"] for t in left_out]


def assemble_plan(
    topics: list[dict[str, Any]],
    wording: dict[str, list[dict[str, Any]]],
    *,
    modules: list[dict[str, Any]],
    role: str,
    company: str,
    start_date: date,
    sprint_max_days: int,
    narrative_source: str,
    not_scheduled: list[str] | None = None,
    user_id: str | None = None,
    max_books: int | None = None,
    max_papers: int | None = None,
) -> dict[str, Any]:
    """The full planner output: the validated plan plus resource pack,
    learning modules and coverage. `wording[topic key]` holds one
    {"title", "objectives"} per day of that topic, optionally with the
    model's "refs" and a gap search's "found" (see choose_references). Raises
    pydantic.ValidationError if the assembled plan breaks the contract (a
    bug here, never a model problem)."""
    sprints: list[dict[str, Any]] = []
    day_number = 0
    # Books and papers are companions for a whole topic, not a day's
    # reading: at most one of each per topic, on the topic's first day, and
    # at most max_books / max_papers in the plan (None = no cap; the
    # highest-priority topics get them). Every one found stays in the
    # resource pack.
    left = {"book": max_books, "paper": max_papers}
    fallbacks: dict[str, list[str]] = {"borrowed": [], "search_links": []}
    all_days: list[dict[str, Any]] = []  # every planned day in order, with its references
    for topic in borrow_references(topics, modules):
        kind_of = lambda ref: ("paper" if ref["url"] in topic["paper_urls"]  # noqa: E731
                               else "book" if ref["type"] == "book" else "")
        daily = [r for r in topic["references"] if left.get(kind_of(r)) is None]
        companions = []
        for kind in ("book", "paper"):
            found = [r for r in topic["references"] if kind_of(r) == kind]
            if left[kind] and found:
                companions.append(found[0])
                left[kind] -= 1
        days = wording[topic["key"]][: topic["days"]]
        searched = any(day.get("found") for day in days)
        if not daily and not companions and not searched:
            # nothing found, or only books/papers past the plan's cap
            daily = search_references(topic["name"])
            fallbacks["search_links"].append(topic["name"])
        elif topic.get("borrowed"):
            fallbacks["borrowed"].append(topic["name"])
        day_titles = [d["title"] for d in days]
        per_day = place_references(daily, day_titles, topic["name"])
        per_day[0] = per_day[0] + companions
        per_day = choose_references(per_day, days, daily + companions, companions)
        # a day the model and the searches left empty (a search-only topic
        # whose budget ran out) revisits what its other days found
        # material a gap search found for one day can serve a related one
        found = [ref for day in days for ref in day.get("found") or []]
        per_day = revisit_references(
            per_day, _unique(daily + found) or companions or _unique([r for d in per_day for r in d]),
            day_titles, topic["name"])
        per_day = mark_required(per_day)
        all_days.extend({"topic": topic, "wording": day, "references": refs} for day, refs in zip(days, per_day))

    # Sprints are fixed blocks of at most sprint_max_days (7) consecutive
    # days, across topic boundaries, so every sprint has the two
    # assessment/flashcard chunks (days 1-3 and 4-7) those agents expect
    parts = split_evenly(list(range(len(all_days))), -(-len(all_days) // sprint_max_days))
    for part in parts:
        sprint_start = start_date + timedelta(days=day_number)
        sprint_days = []
        for i in part:
            day_number += 1
            entry = all_days[i]
            topic, day = entry["topic"], entry["wording"]
            sprint_days.append({
                "day_number": day_number,
                "scheduled_date": (start_date + timedelta(days=day_number - 1)).isoformat(),
                "topic_title": clip(day["title"], 200),
                "topic_description": topic["overview"] or None,
                "objectives": [clip(o, 500) for o in day["objectives"] if str(o).strip()][:MAX_OBJECTIVES_PER_DAY],
                "estimated_minutes": MINUTES_PER_EFFORT.get(topic["effort"], DEFAULT_MINUTES),
                "references": entry["references"],
                "status": "pending",
                "completed_at": None,
            })
        # named after the topics it covers, in order: the roadmap shows
        # "Sprint 3: Claude & Salesforce" (a name of "Sprint 3" read
        # "Sprint 3: Sprint 3" there)
        covered = list(dict.fromkeys(all_days[i]["topic"]["name"] for i in part))
        sprints.append({
            "sprint_number": len(sprints) + 1,
            "sprint_name": clip(" & ".join(covered), 120),
            "start_date": sprint_start.isoformat(),
            "end_date": (sprint_start + timedelta(days=len(part) - 1)).isoformat(),
            "total_days": len(part),
            "sprint_days": sprint_days,
            "completion_percent": 0,
            "status": "pending",
        })

    company_name = company.strip() or "General"
    # emoji, invisible characters and typographic punctuation removed from
    # every text field before validation; URLs untouched (tools/text_sanitize.py)
    sprints = sanitize_data(sprints)
    plan = StudyPlan.model_validate({
        "user_id": user_id if user_id and re.fullmatch(r"[a-fA-F0-9]{24}", user_id) else None,
        "plan_name": clip(sanitize_text(f"{company_name} {role} Preparation Plan"), 120),
        "company": clip(sanitize_text(company_name), 200),
        "role": clip(sanitize_text(role), 200),
        "total_days": day_number,
        "start_date": start_date.isoformat(),
        "end_date": (start_date + timedelta(days=day_number - 1)).isoformat(),
        "sprints": sprints,
    })

    separated = plan.to_separated()

    return {
        "id": f"plan-{uuid.uuid4().hex[:12]}",
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "narrative_source": narrative_source,
        "plan": sanitize_data(separated["plan"]),
        "sprints": sanitize_data(separated["sprints"]),
        "sprint_days": sanitize_data(separated["sprint_days"]),
        "sprint": sanitize_data(separated["sprints"]),
        "sprintday": sanitize_data(separated["sprint_days"]),
        "nested_plan": plan.model_dump(mode="json"),
        "resource_pack": sanitize_data(resource_pack(modules)),
        "learning_modules": sanitize_data([
            {"topic": m.get("topic", ""), "depth": m.get("depth"), "content_markdown": m.get("content_markdown", "")}
            for m in modules
        ]),
        "coverage": {
            "days_per_topic": {t["name"]: t["days"] for t in topics},
            "researched": [t["name"] for t in topics if t["researched"]],
            "unresearched": [t["name"] for t in topics if not t["researched"]],
            "not_scheduled": not_scheduled or [],
            # topics whose references came from other topics' research
            # or are search links (see related_references, search_references)
            "reference_fallbacks": fallbacks,
        },
    }
