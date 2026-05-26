import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SNIPPETS_DIR = REPO_ROOT / "tradingview_integration" / "_snippets"
EXPECTED_FILES = {
    "bayesian_snippets.pine",
    "conic_snippets.pine",
    "data_ingestion_snippets.pine",
    "gc_snippets.pine",
    "ml_kalman_snippets.pine",
    "pattern_recognition_snippets.pine",
    "poi_confluence_snippets.pine",
    "recursive_matrix_snippets.pine",
    "tensor_forecast_snippets.pine",
}


class SnippetInventoryTest(unittest.TestCase):
    def test_expected_snippet_files_exist(self):
        self.assertTrue(SNIPPETS_DIR.is_dir())
        self.assertEqual(EXPECTED_FILES, {path.name for path in SNIPPETS_DIR.glob("*.pine")})

    def test_each_snippet_file_has_origin_main_source_comments(self):
        for name in EXPECTED_FILES:
            with self.subTest(name=name):
                content = (SNIPPETS_DIR / name).read_text()
                self.assertIn("Extracted from majixai/majixai.github.io origin/main", content)
                self.assertIn("Source (origin/main): tradingview_integration/", content)


if __name__ == "__main__":
    unittest.main()
