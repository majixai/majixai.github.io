# ai/

General-purpose AI prompt solver for MajixAI.

## Overview

The `ai/` module provides a clean browser interface where users can enter any prompt and receive an AI-generated response powered by Google Gemini (`gemini-1.5-flash-latest`).

**URL:** `https://majixai.github.io/ai/`

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI – API key entry, chat history, prompt textarea |
| `script.js`  | Google GenAI integration – streaming response, markdown rendering |
| `style.css`  | Message bubble styles |
| `README.md`  | This document |

## Usage

1. Open `ai/index.html` in a browser (or navigate to the hosted URL).
2. Paste your **Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/app/apikey)).
3. Type a prompt in the text area and press **Send** (or `Ctrl+Enter`).
4. The AI response streams in real-time and is rendered as Markdown.

## Dependencies (CDN, no build step)

- [`@google/genai`](https://www.npmjs.com/package/@google/genai) – via `esm.sh`
- [`marked`](https://www.npmjs.com/package/marked) – Markdown renderer via `esm.sh`
- [W3.CSS](https://www.w3schools.com/w3css/) + Bootstrap 5 – layout
- Font Awesome 6 – icons

## Notes

- The API key is stored only in the browser's memory for the current session; it is never sent anywhere except directly to the Gemini API.
- Streaming is used so responses appear incrementally as the model generates them.
