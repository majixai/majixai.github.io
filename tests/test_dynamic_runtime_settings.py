import json
import importlib.util
import tempfile
import unittest
from pathlib import Path

def _load_email_runtime_config_module():
    path = Path(__file__).resolve().parents[1] / "email" / "runtime_config.py"
    spec = importlib.util.spec_from_file_location("email_runtime_config_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_ixic_runtime_settings_module():
    path = Path(__file__).resolve().parents[1] / "ixic_lstm_forecast" / "runtime_settings.py"
    spec = importlib.util.spec_from_file_location("ixic_runtime_settings_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeSettingsTests(unittest.TestCase):
    def test_ixic_runtime_settings_json_and_env_override(self):
        mod = _load_ixic_runtime_settings_module()
        settings = mod.load_runtime_settings(
            {
                "IXIC_RUNTIME_SETTINGS_JSON": json.dumps(
                    {"symbol": "^NDX", "seq_length": 90, "epochs": 7}
                ),
                "IXIC_BATCH_SIZE": "64",
            }
        )
        self.assertEqual(settings["symbol"], "^NDX")
        self.assertEqual(settings["seq_length"], 90)
        self.assertEqual(settings["epochs"], 7)
        self.assertEqual(settings["batch_size"], 64)
        self.assertEqual(settings["settings_source"], "IXIC_BATCH_SIZE")

    def test_ixic_runtime_settings_file(self):
        mod = _load_ixic_runtime_settings_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "ixic-settings.json"
            path.write_text(json.dumps({"output_dir": "custom-output"}), encoding="utf-8")
            settings = mod.load_runtime_settings({"IXIC_RUNTIME_SETTINGS_PATH": str(path)})
        self.assertEqual(settings["output_dir"], "custom-output")
        self.assertTrue(settings["settings_source"].startswith("file:"))

    def test_email_runtime_settings_json(self):
        mod = _load_email_runtime_config_module()
        config = mod.load_email_runtime_config(
            {
                "EMAIL_RUNTIME_SETTINGS_JSON": json.dumps(
                    {
                        "transport": "gas",
                        "recipients": "alpha@example.com,beta@example.com",
                        "gasWebhookUrl": "https://example.test/gas",
                    }
                )
            }
        )
        self.assertEqual(config["transport"], "gas")
        self.assertEqual(
            mod.get_runtime_value(config, "recipients", env={}, env_key="RECIPIENT_EMAILS"),
            "alpha@example.com,beta@example.com",
        )
        self.assertEqual(
            mod.get_runtime_value(config, "gasWebhookUrl", env={}, env_key="EMAIL_GAS_WEBHOOK_URL"),
            "https://example.test/gas",
        )


if __name__ == "__main__":
    unittest.main()
