import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / 'ixic_lstm_forecast' / 'runtime_settings.py'
SCRIPT_PATH = REPO_ROOT / 'ixic_lstm_forecast' / 'bash' / 'export_runtime_env.sh'


def _load_runtime_settings_module():
    spec = importlib.util.spec_from_file_location('ixic_runtime_settings', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules['ixic_runtime_settings'] = module
    spec.loader.exec_module(module)
    return module


class TestRuntimeSettings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime_settings = _load_runtime_settings_module()

    def test_uses_repository_symbols_csv_by_default(self):
        settings = self.runtime_settings.load_runtime_settings({'IXIC_OUTPUT_DIR': str(REPO_ROOT / 'ixic_lstm_forecast' / 'output')})
        self.assertTrue(settings['symbols_csv_path'].endswith('actions/symbols.csv'))
        self.assertIn('^IXIC', settings['selected_symbols'])
        self.assertGreater(settings['symbols_in_catalog'], 10)

    def test_explicit_symbols_preserve_primary_and_catalog_entries(self):
        settings = self.runtime_settings.load_runtime_settings({
            'IXIC_SYMBOL': '^IXIC',
            'IXIC_SYMBOLS': 'NVDA,MSFT,^IXIC',
            'IXIC_SYMBOL_CATEGORIES': 'tech_mega',
            'IXIC_MAX_SYMBOLS': '5',
            'IXIC_OUTPUT_DIR': str(REPO_ROOT / 'ixic_lstm_forecast' / 'output'),
        })
        self.assertEqual(settings['selected_symbols'][0], '^IXIC')
        self.assertIn('NVDA', settings['selected_symbols'])
        self.assertIn('MSFT', settings['selected_symbols'])
        self.assertLessEqual(len(settings['selected_symbols']), 5)

    def test_webhook_payload_keeps_secret_placeholders(self):
        settings = self.runtime_settings.load_runtime_settings({'IXIC_OUTPUT_DIR': str(REPO_ROOT / 'ixic_lstm_forecast' / 'output')})
        payload = self.runtime_settings.build_webhook_payload(settings)
        self.assertEqual(payload['security']['gemini_api_key'], 'SET_IN_GAS_SCRIPT_PROPERTIES')
        self.assertEqual(payload['security']['github_token'], 'SET_IN_GITHUB_ACTIONS_OR_GAS_SECRETS')

    def test_empty_category_override_falls_back_to_defaults(self):
        settings = self.runtime_settings.load_runtime_settings({
            'IXIC_SYMBOL_CATEGORIES': '',
            'IXIC_OUTPUT_DIR': str(REPO_ROOT / 'ixic_lstm_forecast' / 'output'),
        })
        self.assertEqual(settings['selected_categories'], ['indices', 'tech_mega'])

    def test_bash_export_script_generates_json_and_gzip_artifacts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            env_file = Path(tmpdir) / 'github.env'
            env = os.environ.copy()
            env['IXIC_OUTPUT_DIR'] = str(Path(tmpdir) / 'output')
            subprocess.run(['bash', str(SCRIPT_PATH), str(env_file)], check=True, cwd=REPO_ROOT, env=env)

            runtime_json = Path(env['IXIC_OUTPUT_DIR']) / 'runtime' / 'ixic_runtime_settings.json'
            scaffold_gz = Path(env['IXIC_OUTPUT_DIR']) / 'runtime' / 'ixic_directory_scaffold.dat.gz'
            webhook_json = Path(env['IXIC_OUTPUT_DIR']) / 'webhooks' / 'ixic_gas_payload.json'

            self.assertTrue(runtime_json.exists())
            self.assertTrue(scaffold_gz.exists())
            self.assertTrue(webhook_json.exists())
            self.assertTrue(env_file.exists())
            self.assertIn('IXIC_SYMBOLS=', env_file.read_text(encoding='utf-8'))

            payload = json.loads(runtime_json.read_text(encoding='utf-8'))
            self.assertIn('selected_symbols', payload)
            self.assertIn('routing', payload)


if __name__ == '__main__':
    unittest.main()
