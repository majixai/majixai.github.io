#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PROJECT_ROOT.parent
DEFAULT_SYMBOLS_CSV = REPO_ROOT / 'actions' / 'symbols.csv'
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / 'output'
DEFAULT_CATEGORY_LIST = ('indices', 'tech_mega')
DEFAULT_MAX_SYMBOLS = 12

SETTING_PROPS = {
    'primarySymbol': 'IXIC_PRIMARY_SYMBOL',
    'symbolsCsv': 'IXIC_SYMBOLS_CSV',
    'symbols': 'IXIC_SYMBOLS',
    'symbolCategories': 'IXIC_SYMBOL_CATEGORIES',
    'recipientEmails': 'RECIPIENT_EMAILS',
    'geminiApiKey': 'GEMINI_API_KEY',
    'geminiModel': 'IXIC_GEMINI_MODEL',
    'maxDailyCalls': 'IXIC_GEMINI_DAILY_LIMIT',
    'maxMonthlyCalls': 'IXIC_GEMINI_MONTHLY_LIMIT',
    'sendHourLocal': 'IXIC_SEND_HOUR_LOCAL',
    'marketCalendar': 'IXIC_MARKET_CALENDAR',
    'timezone': 'IXIC_TIMEZONE',
    'webhookSecret': 'IXIC_WEBHOOK_SECRET',
    'gasWebhookUrl': 'IXIC_GAS_WEBHOOK_URL',
}

SCAFFOLD_DIRS = [
    {
        'name': 'yfinance',
        'repoPath': 'yfinance/',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/yfinance/',
        'purpose': 'Yahoo Finance acquisition and ticker alignment for IXIC symbol context.',
    },
    {
        'name': 'neural',
        'repoPath': 'yfinance_data/models/neural_forecaster.py',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/neural/',
        'purpose': 'Neural inference hand-off for multi-timeframe signal enrichment.',
    },
    {
        'name': 'ml',
        'repoPath': 'ixic_lstm_forecast/',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/ml/',
        'purpose': 'Primary IXIC forecasting model outputs, summaries, and compressed artifacts.',
    },
    {
        'name': 'ai',
        'repoPath': 'ai/',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/ai/',
        'purpose': 'Gemini prompt/routing integration and AI orchestration surfaces.',
    },
    {
        'name': 'gpu',
        'repoPath': 'gpu/',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/gpu/',
        'purpose': 'GPU-aware acceleration entry points for heavier neural retraining.',
    },
    {
        'name': 'routing',
        'repoPath': 'router/',
        'scaffoldPath': 'ixic_lstm_forecast/scaffolding/routing/',
        'purpose': 'Git/GAS webhook payload routing and route namespace coordination.',
    },
]


@dataclass(frozen=True)
class SymbolRecord:
    symbol: str
    category: str



def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(',') if item.strip()]



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
    with path.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            symbol = (row.get('symbol') or '').strip()
            category = (row.get('category') or '').strip() or 'uncategorized'
            if symbol:
                records.append(SymbolRecord(symbol=symbol, category=category))
    return records



def select_symbols(
    records: Iterable[SymbolRecord],
    *,
    primary_symbol: str,
    explicit_symbols: Iterable[str] = (),
    categories: Iterable[str] = (),
    max_symbols: int = DEFAULT_MAX_SYMBOLS,
) -> tuple[list[str], list[str]]:
    category_list = _dedupe([category.lower() for category in categories if category])
    selected: list[str] = [primary_symbol]
    catalog_by_symbol = {record.symbol: record for record in records}

    for symbol in explicit_symbols:
        if symbol == primary_symbol or symbol in catalog_by_symbol:
            selected.append(symbol)

    for record in records:
        if len(_dedupe(selected)) >= max_symbols:
            break
        if category_list and record.category.lower() not in category_list:
            continue
        selected.append(record.symbol)

    final = _dedupe(selected)[:max_symbols]
    return final, category_list



def build_directory_scaffold() -> dict:
    entries = []
    for item in SCAFFOLD_DIRS:
        repo_path = REPO_ROOT / item['repoPath']
        scaffold_path = REPO_ROOT / item['scaffoldPath']
        entries.append(
            {
                **item,
                'repoPath': item['repoPath'],
                'scaffoldPath': item['scaffoldPath'],
                'exists': repo_path.exists(),
                'scaffoldExists': scaffold_path.exists(),
            }
        )
    return {
        'project': 'ixic_lstm_forecast',
        'projectRoot': str(PROJECT_ROOT),
        'entries': entries,
    }


def default_symbols_csv_url(env: dict[str, str]) -> str:
    repository = env.get('GITHUB_REPOSITORY', 'majixai/majixai.github.io')
    ref_name = env.get('GITHUB_REF_NAME', 'main') or 'main'
    return f'https://raw.githubusercontent.com/{repository}/{ref_name}/actions/symbols.csv'



def load_runtime_settings(env: dict[str, str] | None = None) -> dict:
    env = dict(os.environ if env is None else env)
    symbols_csv_path = Path(env.get('IXIC_SYMBOLS_CSV', DEFAULT_SYMBOLS_CSV)).expanduser().resolve()
    records = load_symbol_records(symbols_csv_path)
    primary_symbol = (env.get('IXIC_SYMBOL') or env.get('IXIC_PRIMARY_SYMBOL') or '^IXIC').strip() or '^IXIC'
    explicit_symbols = _split_csv(env.get('IXIC_SYMBOLS'))
    categories = _split_csv(env.get('IXIC_SYMBOL_CATEGORIES', ','.join(DEFAULT_CATEGORY_LIST)))
    max_symbols = max(1, int(env.get('IXIC_MAX_SYMBOLS', str(DEFAULT_MAX_SYMBOLS))))
    selected_symbols, selected_categories = select_symbols(
        records,
        primary_symbol=primary_symbol,
        explicit_symbols=explicit_symbols,
        categories=categories,
        max_symbols=max_symbols,
    )

    output_dir = Path(env.get('IXIC_OUTPUT_DIR', DEFAULT_OUTPUT_DIR)).expanduser().resolve()
    runtime_dir = output_dir / 'runtime'
    webhook_dir = output_dir / 'webhooks'
    runtime_dir.mkdir(parents=True, exist_ok=True)
    webhook_dir.mkdir(parents=True, exist_ok=True)

    settings = {
        'project': 'ixic_lstm_forecast',
        'primary_symbol': primary_symbol,
        'selected_symbols': selected_symbols,
        'selected_categories': selected_categories,
        'symbols_csv_path': str(symbols_csv_path),
        'symbols_csv_url': env.get('IXIC_SYMBOLS_CSV_URL', default_symbols_csv_url(env)),
        'symbols_in_catalog': len(records),
        'schedule': {
            'send_hour_local': int(env.get('IXIC_SEND_HOUR_LOCAL', '22')),
            'timezone': env.get('IXIC_TIMEZONE', 'America/New_York'),
            'market_calendar': env.get('IXIC_MARKET_CALENDAR', 'US_EQUITIES'),
            'webhook_event': env.get('IXIC_WEBHOOK_EVENT', 'ixic-nightly-forecast'),
        },
        'gemini': {
            'model': env.get('IXIC_GEMINI_MODEL', 'gemini-2.5-flash'),
            'daily_limit': int(env.get('IXIC_GEMINI_DAILY_LIMIT', '20')),
            'monthly_limit': int(env.get('IXIC_GEMINI_MONTHLY_LIMIT', '400')),
        },
        'routing': {
            'route_namespace': env.get('IXIC_ROUTE_NAMESPACE', '/ixic_lstm_forecast/'),
            'router_manifest': str((REPO_ROOT / 'router' / 'routes.json').resolve()),
            'packet_router_module': str((REPO_ROOT / 'ai' / 'packet-router.js').resolve()),
        },
        'directories': build_directory_scaffold(),
        'setting_props': SETTING_PROPS,
        'output': {
            'output_dir': str(output_dir),
            'runtime_dir': str(runtime_dir),
            'webhook_dir': str(webhook_dir),
            'runtime_settings_json': str(runtime_dir / 'ixic_runtime_settings.json'),
            'directory_scaffold_json': str(runtime_dir / 'ixic_directory_scaffold.json'),
            'webhook_payload_json': str(webhook_dir / 'ixic_gas_payload.json'),
            'summary_json': str(output_dir / 'ixic_summary.json'),
        },
        'git': {
            'repository': env.get('GITHUB_REPOSITORY', 'majixai/majixai.github.io'),
            'ref': env.get('GITHUB_REF_NAME') or env.get('GITHUB_REF', ''),
            'sha': env.get('GITHUB_SHA', ''),
            'actor': env.get('GITHUB_ACTOR', ''),
        },
        'security': {
            'gemini_api_key': 'SET_IN_GAS_SCRIPT_PROPERTIES',
            'github_token': 'SET_IN_GITHUB_ACTIONS_OR_GAS_SECRETS',
            'webhook_secret': 'SET_IN_GAS_SCRIPT_PROPERTIES',
        },
    }
    return settings



def build_webhook_payload(settings: dict) -> dict:
    return {
        'operation': 'upsertForecastSettings',
        'project': settings['project'],
        'primarySymbol': settings['primary_symbol'],
        'symbols': settings['selected_symbols'],
        'symbolSource': {
            'csvPath': settings['symbols_csv_path'],
            'csvUrl': settings['symbols_csv_url'],
            'categories': settings['selected_categories'],
        },
        'schedule': settings['schedule'],
        'gemini': settings['gemini'],
        'routing': settings['routing'],
        'directories': settings['directories']['entries'],
        'settingProps': settings['setting_props'],
        'git': settings['git'],
        'security': settings['security'],
        'notes': [
            'Populate secret values in Google Apps Script Script Properties or GitHub Actions secrets.',
            'The webhook payload intentionally contains placeholders only; it never embeds real credentials.',
        ],
    }



def env_lines(settings: dict) -> list[str]:
    return [
        f"IXIC_SYMBOL={settings['primary_symbol']}",
        f"IXIC_SYMBOLS={','.join(settings['selected_symbols'])}",
        f"IXIC_SYMBOLS_CSV={settings['symbols_csv_path']}",
        f"IXIC_SYMBOL_CATEGORIES={','.join(settings['selected_categories'])}",
        f"IXIC_RUNTIME_SETTINGS_JSON={settings['output']['runtime_settings_json']}",
        f"IXIC_DIRECTORY_SCAFFOLD_JSON={settings['output']['directory_scaffold_json']}",
        f"IXIC_GAS_WEBHOOK_PAYLOAD_JSON={settings['output']['webhook_payload_json']}",
        f"IXIC_SUMMARY_JSON={settings['output']['summary_json']}",
        f"IXIC_ROUTE_NAMESPACE={settings['routing']['route_namespace']}",
    ]



def _emit_payload(settings: dict, output_format: str) -> str:
    if output_format == 'json':
        payload = settings
    elif output_format == 'scaffold':
        payload = settings['directories']
    elif output_format == 'webhook':
        payload = build_webhook_payload(settings)
    elif output_format == 'env':
        return '\n'.join(env_lines(settings))
    else:
        raise ValueError(f'Unsupported format: {output_format}')
    return json.dumps(payload, indent=2, sort_keys=False)



def main() -> int:
    parser = argparse.ArgumentParser(description='Resolve IXIC runtime settings from repo CSV + env.')
    parser.add_argument('--format', choices=('json', 'env', 'scaffold', 'webhook'), default='json')
    args = parser.parse_args()
    print(_emit_payload(load_runtime_settings(), args.format))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
