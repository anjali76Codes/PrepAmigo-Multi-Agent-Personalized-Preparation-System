import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from main import app
from streaming.models import AgentStreamEvent, EventType
from streaming.publisher import EventPublisher
from streaming.runner import execute_agent_stream, run_dummy_agent_stream


@pytest.fixture
def client():
    # without the lifespan (no `with TestClient(...)`), startup hasn't set
    # these; the tests used to pass only when an earlier test had run it
    for name in ("graph", "publisher"):
        if not hasattr(app.state, name):
            setattr(app.state, name, None)
    return TestClient(app)


def test_internal_execute_endpoint(client):
    response = client.post(
        "/internal/agent/execute",
        json={"runId": "test-run-123", "query": "Find flights from NYC to London"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["runId"] == "test-run-123"


@pytest.mark.anyio
async def test_event_publisher_emit():
    mock_redis = AsyncMock()
    mock_pipe = MagicMock()
    mock_pipe.__aenter__ = AsyncMock(return_value=mock_pipe)
    mock_pipe.__aexit__ = AsyncMock(return_value=None)
    mock_pipe.rpush = MagicMock()
    mock_pipe.expire = MagicMock()
    mock_pipe.publish = MagicMock()
    mock_pipe.execute = AsyncMock()

    mock_redis.pipeline = MagicMock(return_value=mock_pipe)

    publisher = EventPublisher()
    publisher._redis = mock_redis

    event = AgentStreamEvent(
        runId="test-run-1",
        type=EventType.THINKING,
        payload={"message": "Thinking..."},
    )

    await publisher.emit(event)

    mock_pipe.rpush.assert_called_once()
    mock_pipe.publish.assert_called_once()
    mock_pipe.execute.assert_awaited_once()


@pytest.mark.anyio
async def test_dummy_agent_stream():
    publisher = EventPublisher()
    publisher.emit_event = AsyncMock()

    await run_dummy_agent_stream(
        run_id="run-dummy-test",
        query="Senior Python Backend Engineer at Google",
        publisher=publisher,
        thread_id="test-thread",
        step_delay=0,
    )

    assert publisher.emit_event.call_count == 7
    last_call = publisher.emit_event.call_args_list[-1]
    assert last_call.kwargs["event_type"] == EventType.COMPLETED


@pytest.mark.anyio
async def test_execute_agent_stream_handles_exceptions():
    publisher = EventPublisher()
    publisher.emit_event = AsyncMock()

    mock_graph = MagicMock()
    mock_graph.astream.side_effect = RuntimeError("Graph execution failed")

    await execute_agent_stream(
        run_id="run-err",
        query="Fail test",
        graph=mock_graph,
        publisher=publisher,
        use_dummy=False,
    )

    assert publisher.emit_event.call_count >= 2
    last_call = publisher.emit_event.call_args_list[-1]
    assert last_call.kwargs["event_type"] == EventType.FAILED
    assert "Graph execution failed" in last_call.kwargs["payload"]["error"]


@pytest.mark.anyio
async def test_execute_agent_stream_passes_user_id_into_the_graph_input(monkeypatch):
    seen_inputs = {}

    async def fake_bridge(graph, inputs, config):
        seen_inputs.update(inputs)
        return
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr("streaming.langgraph_bridge.bridge_graph_turn", fake_bridge)
    publisher = EventPublisher()
    publisher.emit_event = AsyncMock()

    await execute_agent_stream(
        run_id="run-uid",
        query="find me resources on DP",
        graph=MagicMock(),
        publisher=publisher,
        user_id="subhaan",
        use_dummy=False,
    )

    assert seen_inputs.get("user_id") == "subhaan"


@pytest.mark.anyio
async def test_the_users_token_reaches_the_plan_sync_and_never_the_graph(monkeypatch):
    """The backend saves a plan under whoever its token names: without the
    user's token it was a 401 (production) or a placeholder user."""
    from tools.plan_db_sync import PlanDBSyncClient

    seen = {}

    async def fake_bridge(graph, inputs, config):
        seen["headers"] = PlanDBSyncClient()._headers()  # what a plan sync would send
        seen["inputs"], seen["config"] = inputs, config
        return
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr("streaming.langgraph_bridge.bridge_graph_turn", fake_bridge)
    publisher = EventPublisher()
    publisher.emit_event = AsyncMock()

    await execute_agent_stream(run_id="run-auth", query="prep me", graph=MagicMock(), publisher=publisher,
                               user_id="u1", use_dummy=False, auth_token="Bearer user-jwt")

    assert seen["headers"]["Authorization"] == "Bearer user-jwt"
    assert "user-jwt" not in repr(seen["inputs"]) + repr(seen["config"])  # not checkpointed or traced
    assert "Authorization" not in PlanDBSyncClient()._headers()  # only for that run


def test_the_token_is_visible_inside_a_graph_node():
    """LangGraph runs nodes in tasks of their own; the run's token must
    still be there when the planner node syncs the plan."""
    import asyncio
    from typing import TypedDict

    from langgraph.graph import END, START, StateGraph

    from tools.plan_db_sync import PlanDBSyncClient, backend_auth

    class State(TypedDict, total=False):
        header: str

    async def planner_node(state):
        return {"header": PlanDBSyncClient()._headers().get("Authorization", "")}

    builder = StateGraph(State)
    builder.add_node("planner", planner_node)
    builder.add_edge(START, "planner")
    builder.add_edge("planner", END)
    graph = builder.compile()

    async def run():
        with backend_auth("Bearer from-backend"):
            return await graph.ainvoke({})

    assert asyncio.run(run())["header"] == "Bearer from-backend"


def test_the_execute_endpoint_passes_the_callers_token_on(client, monkeypatch):
    import main

    captured = {}

    async def fake_execute(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(main, "execute_agent_stream", fake_execute)
    response = client.post("/internal/agent/execute", json={"runId": "r1", "query": "q"},
                           headers={"Authorization": "Bearer user-jwt"})

    assert response.status_code == 200 and captured["auth_token"] == "Bearer user-jwt"


@pytest.mark.anyio
async def test_a_backend_started_run_leaves_saving_the_plan_to_the_backend(monkeypatch):
    """The backend saves the plan from the `completed` event; a second save
    from here created every plan twice."""
    from tools import plan_db_sync

    seen = {}

    async def fake_bridge(graph, inputs, config):
        seen["sync"] = await plan_db_sync.sync_generated_plan_to_db({"plan": {}}, base_url="http://unreachable.invalid")
        return
        yield  # pragma: no cover - makes this an async generator

    monkeypatch.setattr("streaming.langgraph_bridge.bridge_graph_turn", fake_bridge)
    publisher = EventPublisher()
    publisher.emit_event = AsyncMock()

    await execute_agent_stream(run_id="run-save", query="prep me", graph=MagicMock(), publisher=publisher,
                               user_id="u1", use_dummy=False)

    assert seen["sync"] == {"success": True, "mode": "delegated_to_backend"}  # no HTTP call made
