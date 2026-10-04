"""Write JSON artifacts (e.g. generated study plans) to disk for review.

Atomic (temp file + rename), so a reader never sees a half-written file.
Paths come from config via config.service_path, so output lands under
agents-service/.data/ (gitignored) no matter where the process was started.
"""
import json
from pathlib import Path
from typing import Any


def save_json(directory: Path, name: str, payload: Any) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    tmp.replace(path)
    return path
