# ai/

Self-aware, structure-scanning AI prompt solver for MajixAI.

## Overview

The `ai/` module provides a browser-first assistant that can:

- route prompts through current repository structure metadata,
- reason about category intent using a large taxonomy,
- expose self-profile diagnostics (confidence, categories, intent hints),
- run local slash-command tooling without requiring an API key.

**URL:** `https://majixai.github.io/ai/`

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI shell and controls for self-aware/taxonomy routing |
| `script.js` | Application controller, local commands, model request orchestration |
| `packet-router.js` | Structure-aware routing engine with taxonomy-driven scoring |
| `structure-taxonomy.js` | Large static lexical taxonomy and hint corpus |
| `style.css` | UI styles for status chips, diagnostics, explainability panels |
| `README.md` | This document |

## Key capabilities

1. **Structure-aware routing**
   - Loads `router/routes.json` and `projects.json`.
   - Scores relevant route/project nodes for each prompt.
   - Generates a routing context block prepended to model requests.

2. **Taxonomy-driven intent matching**
   - Uses `structure-taxonomy.js` for category synonyms, bigrams, intent phrases, and routing hints.
   - Adds semantic boosts in `packet-router.js` based on taxonomy token matches.

3. **Self-aware diagnostics**
   - Confidence score, routed node count, category set, top intents, taxonomy version/category counts.
   - Explainability stream listing why top nodes were selected.

4. **Local command interface (no API required)**
   - `/help`
   - `/self`
   - `/scan <terms>`
   - `/routes <terms>`
   - `/taxonomy <query>`
   - `/taxonomy stats`
   - `/explain <prompt>`
   - `/browse [category]`
   - `/memory clear`
   - `/history`

5. **Optional short-term memory**
   - Maintains bounded local turn history when memory toggle is enabled.

## Usage

1. Open `ai/index.html` (or hosted URL).
2. Optionally provide a Gemini API key.
3. Configure response profile, routing budget, and toggles.
4. Enter either:
   - a **normal prompt** (sent to Gemini with enriched routing context), or
   - a **local slash command** (resolved entirely client-side).

## Routing data sources

- `/router/routes.json`
- `/projects.json`
- `/ai/structure-taxonomy.js`

## Security notes

- Local command output and model output are rendered as plain text in chat bubbles.
- User input is never inserted into DOM as HTML.
- API key is only used client-side to call Gemini.

## Dependencies (CDN, no build step)

- [`@google/genai`](https://www.npmjs.com/package/@google/genai) – via `esm.sh`
- [W3.CSS](https://www.w3schools.com/w3css/) + Bootstrap 5 – layout
- Font Awesome 6 – icons

## Validation notes

This repository currently has no npm script targets in `package.json`, so validation for this module is done with direct syntax checks:

- `node --check ai/script.js`
- `node --check ai/packet-router.js`
- `node --check ai/structure-taxonomy.js`
