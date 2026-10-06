import logging

from core.config import Settings
import observability.logging_config as logging_config


def reset():
    logging_config._configured = False
    logging.getLogger().handlers.clear()


def test_configure_logging_writes_to_the_configured_file(tmp_path, monkeypatch):
    reset()
    log_file = tmp_path / "logs" / "agents.log"
    monkeypatch.setattr(logging_config, "settings", Settings(log_file=str(log_file), log_level="INFO"))

    logging_config.configure_logging()
    logging.getLogger("agents.research_agent").info("hello from a step")

    assert log_file.exists()
    assert "hello from a step" in log_file.read_text()
    reset()


def test_configure_logging_is_idempotent(tmp_path, monkeypatch):
    reset()
    log_file = tmp_path / "agents.log"
    monkeypatch.setattr(logging_config, "settings", Settings(log_file=str(log_file)))

    logging_config.configure_logging()
    handlers_after_first = list(logging.getLogger().handlers)
    logging_config.configure_logging()

    assert logging.getLogger().handlers == handlers_after_first
    reset()


def test_empty_log_file_means_console_only(tmp_path, monkeypatch):
    reset()
    monkeypatch.setattr(logging_config, "settings", Settings(log_file=""))

    logging_config.configure_logging()

    assert len(logging.getLogger().handlers) == 1
    assert isinstance(logging.getLogger().handlers[0], logging.StreamHandler)
    reset()


def test_relative_data_paths_resolve_to_the_service_root_not_src():
    """config.py moving into src/core/ once sent logs, plans and caches to
    src/.data/ instead of agents-service/.data/."""
    from pathlib import Path

    from core.config import SERVICE_ROOT, service_path

    assert (SERVICE_ROOT / "pyproject.toml").is_file() and (SERVICE_ROOT / "src").is_dir()
    assert service_path(".data/plans") == SERVICE_ROOT / ".data" / "plans"
    assert service_path("/tmp/x") == Path("/tmp/x")
