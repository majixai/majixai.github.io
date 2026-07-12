#!/usr/bin/env python3
"""Generate a simple schematic diagram and metadata for the GitHub Pages UI."""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

COMPONENTS = [
    {"id": "input", "label": "Input", "x": 40, "y": 80},
    {"id": "processor", "label": "Processor", "x": 220, "y": 80},
    {"id": "output", "label": "Output", "x": 400, "y": 80},
]

component_markup = []
for component in COMPONENTS:
    component_markup.append(
        f'<rect x="{component["x"]}" y="{component["y"]}" width="120" height="72" rx="12" fill="#2563eb" stroke="#60a5fa" stroke-width="2" />'
        f'<text x="{component["x"] + 60}" y="{component["y"] + 42}" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">{component["label"]}</text>'
    )

svg_content = dedent(
    f"""
    <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"640\" height=\"240\" viewBox=\"0 0 640 240\" role=\"img\" aria-label=\"Generated schematic\">
      <rect x=\"0\" y=\"0\" width=\"640\" height=\"240\" fill=\"#0f172a\" rx=\"16\" />
      <text x=\"32\" y=\"40\" fill=\"#f8fafc\" font-family=\"Arial, sans-serif\" font-size=\"22\">Generated Schematic</text>
      <text x=\"32\" y=\"68\" fill=\"#cbd5e1\" font-family=\"Arial, sans-serif\" font-size=\"14\">This diagram was created by the schematics generator.</text>
      {''.join(component_markup)}
      <line x1=\"160\" y1=\"116\" x2=\"220\" y2=\"116\" stroke=\"#38bdf8\" stroke-width=\"4\" />
      <line x1=\"340\" y1=\"116\" x2=\"400\" y2=\"116\" stroke=\"#38bdf8\" stroke-width=\"4\" />
      <circle cx=\"160\" cy=\"116\" r=\"6\" fill=\"#38bdf8\" />
      <circle cx=\"340\" cy=\"116\" r=\"6\" fill=\"#38bdf8\" />
    </svg>
    """
).strip() + "\n"

manifest = {
    "title": "Schematics Preview",
    "generatedAt": "2026-07-12",
    "components": COMPONENTS,
    "image": "schematic.svg",
}

(OUTPUT_DIR / "schematic.svg").write_text(svg_content, encoding="utf-8")
(OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print(f"Generated schematic assets in {OUTPUT_DIR}")
