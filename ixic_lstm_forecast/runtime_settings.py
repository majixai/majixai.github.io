#!/usr/bin/env python3
"""Resolve IXIC runtime settings from repo CSV + env/JSON overrides."""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path
from typing import Any, Iterable, Mapping

PROJECT_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PROJECT_ROOT.parent
DEFAULT_SYMBOLS_CSV = REPO_ROOT / "actions" / "symbols.csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output"
DEFAULT_CATEGORY_LIST = ("indices", "tech_mega")
DEFAULT_MAX_SYMBOLS = 12

DEFAULT_RUNTIME_SETTINGS: dict[str, Any] = {
    "symbol": "^IXIC",
    "primary_symbol": "^IXIC",
    "seq_length": 60,
    "epochs": 3,
    "batch_size": 256,
    "log_level": "INFO",
    "train_verbose": "2",
    "output_dir": None,
}

SETTING_PROPS = {
    "primarySymbol": "IXIC_PRIMARY_SYMBOL",
    "symbolsCsv": "IXIC_SYMBOLS_CSV",
    "symbols": "IXIC_SYMBOLS",
    "symbolCategories": "IXIC_SYMBOL_CATEGORIES",
    "recipientEmails": "RECIPIENT_EMAILS",
    "geminiApiKey": "GEMINI_API_KEY",
    "geminiModel": "IXIC_GEMINI_MODEL",
    "maxDailyCalls": "IXIC_GEMINI_DAILY_LIMIT",
    "maxMonthlyCalls": "IXIC_GEMINI_MONTHLY_LIMIT",
    "maxSymbols": "IXIC_MAX_SYMBOLS",
    "sendHourLocal": "IXIC_SEND_HOUR_LOCAL",
    "marketCalendar": "IXIC_MARKET_CALENDAR",
    "timezone": "IXIC_TIMEZONE",
    "webhookSecret": "IXIC_WEBHOOK_SECRET",
    "gasWebhookUrl": "IXIC_GAS_WEBHOOK_URL",
}

SCAFFOLD_DIRS = [
    {
        "name": "yfinance",
        "repoPath": "yfinance/",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/yfinance/",
        "purpose": "Yahoo Finance acquisition and ticker alignment for IXIC symbol context.",
    },
    {
        "name": "neural",
        "repoPath": "yfinance_data/models/neural_forecaster.py",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/neural/",
        "purpose": "Neural inference hand-off for multi-timeframe signal enrichment.",
    },
    {
        "name": "ml",
        "repoPath": "ixic_lstm_forecast/",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/ml/",
        "purpose": "Primary IXIC forecasting model outputs, summaries, and compressed artifacts.",
    },
    {
        "name": "ai",
        "repoPath": "ai/",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/ai/",
        "purpose": "Gemini prompt/routing integration and AI orchestration surfaces.",
    },
    {
        "name": "gpu",
        "repoPath": "gpu/",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/gpu/",
        "purpose": "GPU-aware acceleration entry points for heavier neural retraining.",
    },
    {
        "name": "routing",
        "repoPath": "router/",
        "scaffoldPath": "ixic_lstm_forecast/scaffolding/routing/",
        "purpose": "Git/GAS webhook payload routing and route namespace coordination.",
    },
]

class SymbolRecord:
    def __init__(self, symbol: str, category: str) -> None:
        self.symbol = symbol
        self.category = category


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def load_symbol_records(csv_path: Path | str = DEFAULT_SYMBOLS_CSV) -> list[SymbolRecord]:
    path = Path(csv_path)
    records: list[SymbolRecord] = []
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                symbol = (row.get("symbol") or "").strip()
                category = (row.get("category") or "").strip() or "uncategorized"
                if symbol:
                    records.append(SymbolRecord(symbol=symbol, category=category))
    except FileNotFoundError:
        return []
    return records


def _parse_json_settings(raw: str, source: str) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid IXIC runtime settings JSON from {source}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"IXIC runtime settings from {source} must decode to an object.")

    mapping = {
        "symbol": "symbol",
        "seq_length": "seq_length",
        "epochs": "epochs",
        "batch_size": "batch_size",
        "log_level": "log_level",
        "train_verbose": "train_verbose",
        "output_dir": "output_dir",
    }
    resolved: dict[str, Any] = {}
    for raw_key, canonical_key in mapping.items():
        if raw_key in parsed:
            resolved[canonical_key] = _coerce_value(canonical_key, parsed[raw_key])
    return resolved


def _coerce_value(key: str, value: Any) -> Any:
    if value in ("", None):
        return None if key == "output_dir" else DEFAULT_RUNTIME_SETTINGS.get(key)
    if key in {"seq_length", "epochs", "batch_size"}:
        return int(value)
    if key == "output_dir":
        return str(value)
    if key in {"log_level", "train_verbose", "symbol", "primary_symbol"}:
        return str(value)
    return value


def select_symbols(
    records: Iterable[SymbolRecord],
    *,
    primary_symbol: str,
    explicit_symbols: Iterable[str] = (),
    categories: Iterable[str] = (),
    max_symbols: int = DEFAULT_MAX_SYMBOLS,
) -> tuple[list[str], list[str]]:
    category_list = _dedupe([category.lower() for category in categories if category])
    catalog_by_symbol = {record.symbol: record for record in records}
    selected: list[str] = [primary_symbol]

    for symbol in explicit_symbols:
        if symbol and symbol != primary_symbol and symbol in catalog_by_symbol:
            selected.append(symbol)

    matched_records = records
    if category_list:
        matched_records = [
            record for record in records if record.category.lower() in category_list
        ]

    for record in matched_records:
        if len(_dedupe(selected)) >= max_symbols:
            break
        selected.append(record.symbol)

    final = _dedupe(selected)[:max_symbols]
    return final, category_list


def build_directory_scaffold() -> dict:
    entries = []
    for item in SCAFFOLD_DIRS:
        repo_path = REPO_ROOT / item["repoPath"]
        scaffold_path = REPO_ROOT / item["scaffoldPath"]
        entries.append(
            {
                **item,
                "repoPath": item["repoPath"],
                "scaffoldPath": item["scaffoldPath"],
                "exists": repo_path.exists(),
                "scaffoldExists": scaffold_path.exists(),
            }
        )
    return {
        "project": "ixic_lstm_forecast",
        "projectRoot": str(PROJECT_ROOT),
        "entries": entries,
    }


def default_symbols_csv_url(env: Mapping[str, str]) -> str:
    repository = env.get("GITHUB_REPOSITORY", "majixai/majixai.github.io")
    ref_name = env.get("GITHUB_REF_NAME", "main") or "main"
    return f"https://raw.githubusercontent.com/{repository}/{ref_name}/actions/symbols.csv"


def load_runtime_settings(env: Mapping[str, str] | None = None) -> dict[str, Any]:
    env = dict(os.environ if env is None else env)

    resolved = dict(DEFAULT_RUNTIME_SETTINGS)
    source = "defaults"

    settings_path = (env.get("IXIC_RUNTIME_SETTINGS_PATH") or "").strip()
    if settings_path:
        path = Path(settings_path)
        resolved.update(_parse_json_settings(path.read_text(encoding="utf-8"), f"file:{path}"))
        source = f"file:{path}"

    settings_json = (env.get("IXIC_RUNTIME_SETTINGS_JSON") or "").strip()
    if settings_json:
        resolved.update(_parse_json_settings(settings_json, "IXIC_RUNTIME_SETTINGS_JSON"))
        source = "IXIC_RUNTIME_SETTINGS_JSON"

    for env_key, canonical_key in {
        "IXIC_SYMBOL": "symbol",
        "IXIC_SEQ_LENGTH": "seq_length",
        "IXIC_EPOCHS": "epochs",
        "IXIC_BATCH_SIZE": "batch_size",
        "IXIC_LOG_LEVEL": "log_level",
        "IXIC_TRAIN_VERBOSE": "train_verbose",
        "IXIC_OUTPUT_DIR": "output_dir",
    }.items():
        raw_value = env.get(env_key)
        if raw_value not in (None, ""):
            resolved[canonical_key] = _coerce_value(canonical_key, raw_value)
            source = env_key

    symbols_csv_path = Path(env.get("IXIC_SYMBOLS_CSV", DEFAULT_SYMBOLS_CSV)).expanduser().resolve()
    records = load_symbol_records(symbols_csv_path)
    primary_symbol = (
        env.get("IXIC_PRIMARY_SYMBOL")
        or resolved.get("symbol")
        or env.get("IXIC_SYMBOL")
        or "^IXIC"
    ).strip() or "^IXIC"
    explicit_symbols = _split_csv(env.get("IXIC_SYMBOLS"))
    categories = _split_csv(env.get("IXIC_SYMBOL_CATEGORIES") or ",".join(DEFAULT_CATEGORY_LIST))
    max_symbols = max(1, int(env.get("IXIC_MAX_SYMBOLS", str(DEFAULT_MAX_SYMBOLS))))
    selected_symbols, selected_categories = select_symbols(
        records,
        primary_symbol=primary_symbol,
        explicit_symbols=explicit_symbols,
        categories=categories,
        max_symbols=max_symbols,
    )

    output_dir = Path(resolved.get("output_dir") or DEFAULT_OUTPUT_DIR).expanduser().resolve()
    runtime_dir = output_dir / "runtime"
    webhook_dir = output_dir / "webhooks"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    webhook_dir.mkdir(parents=True, exist_ok=True)

    settings: dict[str, Any] = {
        **resolved,
        "project": "ixic_lstm_forecast",
        "symbol": primary_symbol,
        "primary_symbol": primary_symbol,
        "selected_symbols": selected_symbols,
        "selected_categories": selected_categories,
        "symbols_csv_path": str(symbols_csv_path),
        "symbols_csv_url": env.get("IXIC_SYMBOLS_CSV_URL", default_symbols_csv_url(env)),
        "symbols_in_catalog": len(records),
        "max_symbols": max_symbols,
        "schedule": {
            "send_hour_local": int(env.get("IXIC_SEND_HOUR_LOCAL", "22")),
            "timezone": env.get("IXIC_TIMEZONE", "America/New_York"),
            "market_calendar": env.get("IXIC_MARKET_CALENDAR", "US_EQUITIES"),
            "webhook_event": env.get("IXIC_WEBHOOK_EVENT", "ixic-nightly-forecast"),
        },
        "gemini": {
            "model": env.get("IXIC_GEMINI_MODEL", "gemini-2.5-flash"),
            "daily_limit": int(env.get("IXIC_GEMINI_DAILY_LIMIT", "20")),
            "monthly_limit": int(env.get("IXIC_GEMINI_MONTHLY_LIMIT", "400")),
        },
        "routing": {
            "route_namespace": env.get("IXIC_ROUTE_NAMESPACE", "/ixic_lstm_forecast/"),
            "router_manifest": str((REPO_ROOT / "router" / "routes.json").resolve()),
            "packet_router_module": str((REPO_ROOT / "ai" / "packet-router.js").resolve()),
        },
        "directories": build_directory_scaffold(),
        "setting_props": SETTING_PROPS,
        "output": {
            "output_dir": str(output_dir),
            "runtime_dir": str(runtime_dir),
            "webhook_dir": str(webhook_dir),
            "runtime_settings_json": str(runtime_dir / "ixic_runtime_settings.json"),
            "directory_scaffold_json": str(runtime_dir / "ixic_directory_scaffold.json"),
            "webhook_payload_json": str(webhook_dir / "ixic_gas_payload.json"),
            "summary_json": str(output_dir / "ixic_summary.json"),
        },
        "git": {
            "repository": env.get("GITHUB_REPOSITORY", "majixai/majixai.github.io"),
            "ref": env.get("GITHUB_REF_NAME") or env.get("GITHUB_REF", ""),
            "sha": env.get("GITHUB_SHA", ""),
            "actor": env.get("GITHUB_ACTOR", ""),
        },
        "security": {
            "gemini_api_key": "SET_IN_GAS_SCRIPT_PROPERTIES",
            "github_token": "SET_IN_GITHUB_ACTIONS_OR_GAS_SECRETS",
            "webhook_secret": "SET_IN_GAS_SCRIPT_PROPERTIES",
        },
        "settings_source": source,
    }
    return settings


def build_webhook_payload(settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "operation": "upsertForecastSettings",
        "project": settings["project"],
        "primarySymbol": settings["primary_symbol"],
        "symbols": settings["selected_symbols"],
        "symbolSource": {
            "csvPath": settings["symbols_csv_path"],
            "csvUrl": settings["symbols_csv_url"],
            "categories": settings["selected_categories"],
            "maxSymbols": settings["max_symbols"],
        },
        "runtime": {
            "symbol": settings["symbol"],
            "seqLength": settings["seq_length"],
            "epochs": settings["epochs"],
            "batchSize": settings["batch_size"],
            "logLevel": settings["log_level"],
            "trainVerbose": settings["train_verbose"],
            "outputDir": settings["output"]["output_dir"],
        },
        "schedule": settings["schedule"],
        "gemini": settings["gemini"],
        "routing": settings["routing"],
        "directories": settings["directories"]["entries"],
        "settingProps": settings["setting_props"],
        "git": settings["git"],
        "security": settings["security"],
        "notes": [
            "Populate secret values in Google Apps Script Script Properties or GitHub Actions secrets.",
            "The webhook payload intentionally contains placeholders only; it never embeds real credentials.",
        ],
    }


def env_lines(settings: dict[str, Any]) -> list[str]:
    return [
        f"IXIC_SYMBOL={settings['symbol']}",
        f"IXIC_PRIMARY_SYMBOL={settings['primary_symbol']}",
        f"IXIC_SEQ_LENGTH={settings['seq_length']}",
        f"IXIC_EPOCHS={settings['epochs']}",
        f"IXIC_BATCH_SIZE={settings['batch_size']}",
        f"IXIC_LOG_LEVEL={settings['log_level']}",
        f"IXIC_TRAIN_VERBOSE={settings['train_verbose']}",
        f"IXIC_OUTPUT_DIR={settings['output']['output_dir']}",
        f"IXIC_SYMBOLS={','.join(settings['selected_symbols'])}",
        f"IXIC_SYMBOLS_CSV={settings['symbols_csv_path']}",
        f"IXIC_SYMBOLS_CSV_URL={settings['symbols_csv_url']}",
        f"IXIC_SYMBOL_CATEGORIES={','.join(settings['selected_categories'])}",
        f"IXIC_MAX_SYMBOLS={settings['max_symbols']}",
        f"IXIC_RUNTIME_SETTINGS_PATH={settings['output']['runtime_settings_json']}",
        f"IXIC_DIRECTORY_SCAFFOLD_JSON={settings['output']['directory_scaffold_json']}",
        f"IXIC_GAS_WEBHOOK_PAYLOAD_JSON={settings['output']['webhook_payload_json']}",
        f"IXIC_SUMMARY_JSON={settings['output']['summary_json']}",
        f"IXIC_ROUTE_NAMESPACE={settings['routing']['route_namespace']}",
    ]


def _emit_payload(settings: dict[str, Any], output_format: str) -> str:
    if output_format == "json":
        payload = settings
    elif output_format == "scaffold":
        payload = settings["directories"]
    elif output_format == "webhook":
        payload = build_webhook_payload(settings)
    elif output_format == "env":
        return "\n".join(env_lines(settings))
    else:
        raise ValueError(f"Unsupported format: {output_format}")
    return json.dumps(payload, indent=2, sort_keys=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve IXIC runtime settings from repo CSV + env.")
    parser.add_argument("--format", choices=("json", "env", "scaffold", "webhook"), default="json")
    args = parser.parse_args()
    print(_emit_payload(load_runtime_settings(), args.format))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
