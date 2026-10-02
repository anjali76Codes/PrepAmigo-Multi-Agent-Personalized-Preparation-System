"""
One call, made once at process start (main.py for the API, cli.py for the
CLI), that makes every module's `logging.getLogger(__name__)` calls
actually show up somewhere — including observability.timing.log_step,
which is how step/tool-call durations become inspectable.

Without this, Python's logging defaults to WARNING-with-no-handler, so
every agent's INFO-level step/tool logs are silently dropped: LOG_LEVEL in
.env would set a value nothing reads. `force`-clearing existing handlers
makes this authoritative over whatever a library (uvicorn included)
configured first.

Logs go to two places: the console (as before), and a rotating file
(LOG_FILE, default .data/logs/agents-service.log) so a run's step timings
and errors are still there to grep after the terminal has scrolled past
them. .data/ is gitignored, so the log file is never committed. Set
LOG_FILE="" to disable the file and keep console-only output.
"""
import logging
import logging.handlers

from core.config import settings

_LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
_BACKUP_COUNT = 3

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)
    root = logging.getLogger()
    root.setLevel(settings.log_level)
    # drop any handler a library already attached to root, so our
    # format/level/file target are authoritative (mirrors basicConfig(force=True))
    root.handlers.clear()

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)

    if settings.log_file:
        path = service_path(settings.log_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            path, maxBytes=settings.log_file_max_bytes, backupCount=_BACKUP_COUNT, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
        logging.getLogger(__name__).info("Logging to %s (level=%s)", path, settings.log_level)

    _configured = True
