import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from main import app
from streaming.models import AgentStreamEvent, EventType
from streaming.publisher import EventPublisher
from streaming.runner import execute_agent_stream, run_dummy_agent_stream


@pytest.fixture
def client():
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
