from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from model_request import ModelRequest


class CommandStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("[]", encoding="utf-8")

    def _read(self) -> list[dict]:
        try:
            raw = self.path.read_text(encoding="utf-8").strip()
            return json.loads(raw) if raw else []
        except json.JSONDecodeError:
            return []

    def _write(self, items: Iterable[dict]) -> None:
        self.path.write_text(json.dumps(list(items), indent=2, ensure_ascii=False), encoding="utf-8")

    def all(self) -> list[dict]:
        return self._read()

    def recent(self, limit: int = 10) -> list[dict]:
        return list(reversed(self._read()))[:limit]

    def append(self, model_request: ModelRequest) -> dict:
        items = self._read()
        item = model_request.to_dict()
        items.append(item)
        self._write(items)
        return item
