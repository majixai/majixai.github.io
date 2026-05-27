import csv
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class _Columns(list):
    @property
    def size(self) -> int:
        return len(self)


class _DatetimeIndex(list):
    def __init__(self, values, name=None):
        super().__init__(values)
        self.name = name


class _DataFrame:
    def __init__(self, data=None, index=None):
        self._rows = []
        self._index_name = getattr(index, "name", None)
        self._index = list(index or [])
        if isinstance(data, dict):
            keys = list(data.keys())
            for i in range(len(next(iter(data.values()), []))):
                self._rows.append({key: data[key][i] for key in keys})
        elif data is not None:
            self._rows = list(data)

    @property
    def empty(self) -> bool:
        return not self._rows

    def __len__(self) -> int:
        return len(self._rows)

    @property
    def columns(self):
        if self._rows:
            return _Columns(list(self._rows[0].keys()))
        if self._index:
            return _Columns([self._index_name or "index"])
        return _Columns([])

    def copy(self):
        clone = _DataFrame()
        clone._rows = [row.copy() for row in self._rows]
        clone._index = list(self._index)
        clone._index_name = self._index_name
        return clone

    def reset_index(self):
        column_name = self._index_name or "index"
        rows = []
        for idx, row in enumerate(self._rows):
            new_row = {column_name: self._index[idx] if idx < len(self._index) else idx}
            new_row.update(row)
            rows.append(new_row)
        if not rows and self._index:
            rows = [{column_name: value} for value in self._index]
        self._rows = rows
        self._index = []
        self._index_name = None
        return self

    def rename(self, columns=None):
        columns = columns or {}
        if not columns:
            return self
        for row in self._rows:
            for old, new in columns.items():
                if old in row:
                    row[new] = row.pop(old)
        return self

    def insert(self, loc, column, value):
        values = list(value) if isinstance(value, list) else [value] * max(len(self._rows), 1)
        if not self._rows:
            self._rows = [{column: item} for item in values]
            return
        for row, item in zip(self._rows, values):
            row[column] = item

    def to_csv(self, path, index=False):
        with open(path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(self._rows[0].keys()))
            writer.writeheader()
            writer.writerows(self._rows)


fake_pandas = types.ModuleType("pandas")
fake_pandas.DataFrame = _DataFrame
fake_pandas.DatetimeIndex = _DatetimeIndex
sys.modules.setdefault("pandas", fake_pandas)

import fetch_ixic_timeframes as fx  # noqa: E402


class TestIxicTimeframeExport(unittest.TestCase):
    def setUp(self) -> None:
        self.frame = _DataFrame(
            {
                "Open": [1.0],
                "High": [2.0],
                "Low": [0.5],
                "Close": [1.5],
                "Volume": [100],
            },
            index=_DatetimeIndex(["2026-01-01 00:00:00"], name="Datetime"),
        )

    def test_selected_requests_are_supported(self) -> None:
        self.assertEqual(list(fx._selected_requests(["1m", "5m", "1d"])), ["1m", "5m", "1d"])

    def test_main_writes_separate_csvs_with_max_period(self) -> None:
        calls = []

        def fake_download(*args, **kwargs):
            calls.append(kwargs)
            return self.frame

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(fx, "download", side_effect=fake_download):
                exit_code = fx.main(["--output-dir", tmpdir, "--intervals", "1m", "5m"])

            self.assertEqual(exit_code, 0)
            self.assertTrue(Path(tmpdir, "IXIC_1m.csv").exists())
            self.assertTrue(Path(tmpdir, "IXIC_5m.csv").exists())
            self.assertEqual([call["period"] for call in calls], ["max", "max"])
            self.assertEqual([call["interval"] for call in calls], ["1m", "5m"])


if __name__ == "__main__":
    unittest.main()
