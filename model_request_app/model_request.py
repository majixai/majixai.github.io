from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4


DEFAULT_REQUEST_VALUES = {
    "model": "openai/gpt-4.1",
    "system_prompt": "You are a helpful assistant.",
    "temperature": "1.0",
    "top_p": "1.0",
    "prompt": "What is the capital of France?",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _shell_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _normalize_decimal(value: object, field_name: str) -> str:
    try:
        decimal_value = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError) as exc:
        raise ValueError(f"{field_name} must be numeric.") from exc

    text = format(decimal_value, "f").rstrip("0").rstrip(".")
    return text if "." in text else f"{text}.0"


@dataclass(slots=True)
class ModelRequest:
    model: str = DEFAULT_REQUEST_VALUES["model"]
    system_prompt: str = DEFAULT_REQUEST_VALUES["system_prompt"]
    temperature: str = DEFAULT_REQUEST_VALUES["temperature"]
    top_p: str = DEFAULT_REQUEST_VALUES["top_p"]
    prompt: str = DEFAULT_REQUEST_VALUES["prompt"]
    request_id: str = field(default_factory=lambda: uuid4().hex)
    created_at: str = field(default_factory=_utc_now)

    @classmethod
    def default(cls) -> "ModelRequest":
        return cls()

    @classmethod
    def from_mapping(cls, mapping: dict) -> "ModelRequest":
        model = str(mapping.get("model", DEFAULT_REQUEST_VALUES["model"])).strip() or DEFAULT_REQUEST_VALUES["model"]
        system_prompt = str(mapping.get("system_prompt", DEFAULT_REQUEST_VALUES["system_prompt"])).strip()
        prompt = str(mapping.get("prompt", DEFAULT_REQUEST_VALUES["prompt"])).strip()
        temperature = _normalize_decimal(mapping.get("temperature", DEFAULT_REQUEST_VALUES["temperature"]), "temperature")
        top_p = _normalize_decimal(mapping.get("top_p", DEFAULT_REQUEST_VALUES["top_p"]), "top_p")

        if not prompt:
            raise ValueError("prompt is required.")
        if not system_prompt:
            raise ValueError("system_prompt is required.")

        return cls(
            model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            prompt=prompt,
        )

    def command(self) -> str:
        parts = [
            "gh",
            "models",
            "run",
            self.model,
            "--system-prompt",
            _shell_quote(self.system_prompt),
            "--temperature",
            self.temperature,
            "--top-p",
            self.top_p,
            _shell_quote(self.prompt),
        ]
        return " ".join(parts)

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["command"] = self.command()
        return payload