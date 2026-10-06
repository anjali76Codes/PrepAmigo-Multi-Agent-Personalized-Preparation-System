"""
Sequential database synchronization client for storing LLM-generated study plans in MongoDB
via the backend API endpoints (Plan -> Sprint -> SprintDays).
"""
import contextvars
import logging
from contextlib import contextmanager
from typing import Any, Iterator, Optional
import httpx

from core.config import settings

logger = logging.getLogger(__name__)

# The requesting user's backend token for this run. The backend's plan
# routes (requireAuth) save a plan under whoever the token names: without
# one they answer 401 in production, and in development save it under a
# placeholder "Local developer" account the user never sees. Kept in a
# context variable for the run, never in graph state (checkpointed) or
# graph config (copied into tracing metadata).
_backend_token: contextvars.ContextVar[str | None] = contextvars.ContextVar("backend_token", default=None)


@contextmanager
def backend_auth(authorization: str | None) -> Iterator[None]:
    """Use the caller's token (an Authorization header value or a bare
    token) for every plan sync inside the block."""
    token = (authorization or "").strip()
    token = token[7:].strip() if token.lower().startswith("bearer ") else token
    reset = _backend_token.set(token or None)
    try:
        yield
    finally:
        _backend_token.reset(reset)


class PlanDBSyncError(Exception):
    """Raised when plan synchronization to MongoDB fails."""
    pass


class PlanDBSyncClient:
    """Client that communicates sequentially with the backend API to persist study plans."""

    def __init__(self, base_url: str | None = None, auth_token: str | None = None, timeout: float = 30.0):
        self.base_url = (base_url or getattr(settings, "backend_api_url", "http://localhost:3000")).rstrip("/")
        self.auth_token = auth_token or _backend_token.get()
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def create_plan(self, plan_data: dict[str, Any], client: Optional[httpx.AsyncClient] = None) -> str:
        """
        Step 1: POST /api/plans
        Body: { plan_name, company, role, total_days, start_date, end_date }
        Returns: generated planId / _id
        """
        url = f"{self.base_url}/api/plans"
        # Only send required Plan fields according to schema
        body = {
            "plan_name": plan_data.get("plan_name"),
            "company": plan_data.get("company"),
            "role": plan_data.get("role"),
            "total_days": plan_data.get("total_days"),
            "start_date": plan_data.get("start_date"),
            "end_date": plan_data.get("end_date"),
        }

        async def _call(c: httpx.AsyncClient):
            res = await c.post(url, json=body, headers=self._headers())
            if res.status_code not in (200, 201):
                raise PlanDBSyncError(f"Failed to create Plan: HTTP {res.status_code} - {res.text}")
            data = res.json()
            plan_id = data.get("planId") or data.get("plan_id") or data.get("id") or (data.get("data") or {}).get("_id")
            if not plan_id:
                raise PlanDBSyncError(f"Plan creation did not return a valid planId: {data}")
            return str(plan_id)

        if client:
            return await _call(client)
        async with httpx.AsyncClient(timeout=self.timeout) as http_c:
            return await _call(http_c)

    async def create_sprint(
        self, plan_id: str, sprint_data: dict[str, Any], client: Optional[httpx.AsyncClient] = None
    ) -> str:
        """
        Step 2: POST /api/sprints
        Body: { planId, sprint_number, sprint_name, start_date, end_date, total_days }
        Returns: generated sprintId / _id
        """
        url = f"{self.base_url}/api/sprints"
        body = {
            "planId": plan_id,
            "plan_id": plan_id,
            "sprint_number": sprint_data.get("sprint_number"),
            "sprint_name": sprint_data.get("sprint_name"),
            "start_date": sprint_data.get("start_date"),
            "end_date": sprint_data.get("end_date"),
            "total_days": sprint_data.get("total_days"),
        }

        async def _call(c: httpx.AsyncClient):
            res = await c.post(url, json=body, headers=self._headers())
            if res.status_code not in (200, 201):
                raise PlanDBSyncError(f"Failed to create Sprint {sprint_data.get('sprint_number')}: HTTP {res.status_code} - {res.text}")
            data = res.json()
            sprint_id = data.get("sprintId") or data.get("sprint_id") or data.get("id") or (data.get("data") or {}).get("_id")
            if not sprint_id:
                raise PlanDBSyncError(f"Sprint creation did not return a valid sprintId: {data}")
            return str(sprint_id)

        if client:
            return await _call(client)
        async with httpx.AsyncClient(timeout=self.timeout) as http_c:
            return await _call(http_c)

    async def create_sprint_days(
        self, sprint_id: str, days_data: list[dict[str, Any]], client: Optional[httpx.AsyncClient] = None
    ) -> list[str]:
        """
        Step 3: POST /api/sprint-days
        Body: { sprintId, days: [ { day_number, scheduled_date, topic_title, topic_description, objectives, estimated_minutes, references } ] }
        Returns: list of created sprint_day_ids
        """
        url = f"{self.base_url}/api/sprint-days"
        # Sanitize days according to schema
        cleaned_days = []
        for d in days_data:
            cleaned_days.append({
                "sprint_id": sprint_id,
                "sprintId": sprint_id,
                "day_number": d.get("day_number"),
                "scheduled_date": d.get("scheduled_date"),
                "topic_title": d.get("topic_title"),
                "topic_description": d.get("topic_description"),
                "objectives": d.get("objectives", []),
                "estimated_minutes": d.get("estimated_minutes"),
                "references": d.get("references", []),
            })

        body = {
            "sprintId": sprint_id,
            "sprint_id": sprint_id,
            "days": cleaned_days,
        }

        async def _call(c: httpx.AsyncClient):
            res = await c.post(url, json=body, headers=self._headers())
            if res.status_code not in (200, 201):
                raise PlanDBSyncError(f"Failed to create Sprint Days for sprint {sprint_id}: HTTP {res.status_code} - {res.text}")
            data = res.json()
            ids = data.get("ids") or data.get("dayIds") or data.get("sprint_day_ids") or []
            return [str(i) for i in ids]

        if client:
            return await _call(client)
        async with httpx.AsyncClient(timeout=self.timeout) as http_c:
            return await _call(http_c)

    async def sync_plan(self, plan_output: dict[str, Any]) -> dict[str, Any]:
        """
        Execute the complete sequential flow:
          1. Create Plan -> get planId
          2. For each Sprint: Create Sprint -> get sprintId
          3. For each Sprint: Create SprintDays associated with sprintId
        """
        plan_dict = plan_output.get("plan") or {}
        sprints_list = plan_output.get("sprints") or plan_output.get("sprint") or []
        days_list = plan_output.get("sprint_days") or plan_output.get("sprintday") or []

        # If days are nested in sprints
        if not days_list and sprints_list:
            for s in sprints_list:
                if "sprint_days" in s:
                    for d in s["sprint_days"]:
                        d_copy = dict(d)
                        d_copy.setdefault("sprint_number", s.get("sprint_number", 1))
                        days_list.append(d_copy)

        days_by_sprint_num: dict[int, list[dict[str, Any]]] = {}
        for d in days_list:
            s_num = d.get("sprint_number", 1)
            days_by_sprint_num.setdefault(s_num, []).append(d)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # 1. Create Plan
            plan_id = await self.create_plan(plan_dict, client=client)
            logger.info("Created Plan in MongoDB: %s", plan_id)

            sprint_results = []
            total_days_created = 0

            # 2. Sequential Sprint and SprintDays creation
            for sprint in sprints_list:
                s_num = sprint.get("sprint_number", 1)
                sprint_id = await self.create_sprint(plan_id, sprint, client=client)
                logger.info("Created Sprint %d in MongoDB: %s", s_num, sprint_id)

                sprint_days = days_by_sprint_num.get(s_num, [])
                created_day_ids = await self.create_sprint_days(sprint_id, sprint_days, client=client)
                logger.info("Created %d Sprint Days for Sprint %d (%s)", len(created_day_ids), s_num, sprint_id)
                total_days_created += len(created_day_ids)

                sprint_results.append({
                    "sprint_number": s_num,
                    "sprint_name": sprint.get("sprint_name"),
                    "sprint_id": sprint_id,
                    "days_count": len(created_day_ids),
                    "day_ids": created_day_ids,
                })

            return {
                "success": True,
                "plan_id": plan_id,
                "planId": plan_id,
                "sprints_count": len(sprint_results),
                "total_days_created": total_days_created,
                "sprints": sprint_results,
            }


async def sync_generated_plan_to_db(
    plan_output: dict[str, Any],
    base_url: str | None = None,
    auth_token: str | None = None,
) -> dict[str, Any] | None:
    """Convenience helper to sync a generated study plan to MongoDB if backend is running."""
    # When authentication is enabled and no explicit auth token is supplied,
    # plan persistence is handled directly by the Node.js backend streaming listener.
    if getattr(settings, "enable_auth", False) and not auth_token:
        logger.debug(
            "Skipping Python-side direct DB sync because ENABLE_AUTH is true and persistence is delegated to the Express backend."
        )
        return {"success": True, "mode": "delegated_to_backend"}

    client = PlanDBSyncClient(base_url=base_url, auth_token=auth_token)
    try:
        result = await client.sync_plan(plan_output)
        return result
    except Exception as exc:
        hint = ""
        if "HTTP 401" in str(exc):
            hint = (" (the backend needs the user's login token: runs started through the backend carry it;"
                    " a CLI run has none)")
        logger.warning("Automated DB sync failed: %s%s", str(exc)[:300], hint)
        return {"success": False, "error": str(exc)[:300] + hint}
