# Commit Advisor

Real-time commit analysis, pattern visualisation, and AI-powered recommendations for the MajixAI repository.

## Overview

Commit Advisor consists of two parts:

| Part | Location | Purpose |
|------|----------|---------|
| GitHub Actions workflow | `.github/workflows/commit_advisor.yml` | Analyses git history and writes `data/insights.json` |
| Frontend app | `commit_advisor/index.html` | Reads `data/insights.json` and renders interactive charts |

## Data pipeline

The workflow runs:

- On every push to `main`
- On a schedule every 4 hours (`cron: '0 */4 * * *'`)
- On `workflow_dispatch` (manual trigger with optional `author` and `limit` inputs)

It runs `git log` with `--name-only --diff-filter=ACDMR`, then computes:

| Field | Description |
|-------|-------------|
| `commitCount` | Total commits analysed |
| `authorFilter` | Username filter applied (or `"all"`) |
| `topDirectories` | Top-10 root directories by file-change count |
| `topFileTypes` | Top-10 file extensions by change count |
| `topAuthors` | Top-10 contributors by commit count |
| `commitsByWeekday` | Commit counts per day of the week |
| `commitsByHour` | Commit counts per UTC hour (0–23) |
| `topKeywords` | Top-20 words extracted from commit messages (stop-words removed) |
| `recommendations` | 3–7 generated recommendations with priority, category, and tags |
| `recentCommits` | Last 30 commits (sha, message, author, date, files changed) |

Output is written to `commit_advisor/data/insights.json` and committed back to the branch.

## Frontend

`index.html` is a self-contained page (Bootstrap 5 + Font Awesome 6, no build step required).

### Sections

- **Stats row** — quick summary: commits, directories, file types, authors, recommendations
- **Top Directories** — horizontal bar chart of most-changed root folders
- **Changed Extensions** — horizontal bar chart of file types
- **Commits by Weekday** — horizontal bar chart
- **Top Authors** — horizontal bar chart of top contributors
- **Commits by Hour (UTC)** — 24-cell heatmap grid
- **AI Recommendations** — filterable cards with priority colouring and per-card feedback (👍 👎 🔖 📝 stored in `localStorage`)
- **Recent Commits** — searchable list with SHA links, author, date, and file chips
- **Top Keywords** — pill cloud of the most frequent non-stop words in commit messages

### Running locally

Any static file server works:

```bash
# Python
python -m http.server 8080
# open http://localhost:8080/commit_advisor/
```

The frontend reads from `/commit_advisor/data/insights.json`.  
To populate it locally, run the workflow step manually:

```bash
python3 .github/workflows/commit_advisor_script.py
# (copy the inline Python from the workflow if needed)
```

Or trigger the workflow via GitHub Actions → **Commit Advisor – Insights & Recommendations** → **Run workflow**.

## Customising recommendations

The workflow generates recommendations based on commit patterns.  
To add a new keyword → recommendation mapping, edit the `action_map` dict in the workflow's Python block:

```python
action_map = {
    'fix':      ('Bug Fixes Trend',   '...'),
    'add':      ('Feature Growth',    '...'),
    'refactor': ('Refactoring Cycle', '...'),
    # add your own here
}
```
