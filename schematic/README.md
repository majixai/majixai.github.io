# Schematics Integration

This folder contains a lightweight schematics workflow that generates a simple diagram and serves it through a browser UI.

## Files

- `.github/workflows/schematic_action.yml` runs the generator automatically on pushes touching the schematics folder.
- `schematics/generate_schematics.py` creates SVG and JSON assets in `schematics/output/`.
- `schematics/index.html` renders the generated schematic in a simple viewer page.

## Local usage

```bash
python schematics/generate_schematics.py
python3 -m http.server 8000
```

Then open `http://localhost:8000/schematics/`.
