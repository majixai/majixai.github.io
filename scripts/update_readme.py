"""
update_readme.py

Reads the git log to compute:
  - Recent activity (last 5 commits)
  - Biggest commit (by files changed) for: today, this week, this month,
    this quarter, and this year.
  - Repository stats (project count, workflow count)
  - Last updated timestamp

Then rewrites the corresponding <!-- marker --> sections in README.md.
"""

import os
import re
import subprocess
from datetime import datetime, timezone, timedelta

SITE_BASE_URL = "https://majixai.github.io"
REPO_COMMIT_BASE_URL = "https://github.com/majixai/majixai.github.io/commit"
FALLBACK_RECENT_ACTIVITY_URL = f"{SITE_BASE_URL}/router/"
SKIP_ACTIVITY_TOP_LEVEL_DIRS = {".github"}


# ---------------------------------------------------------------------------
# git helpers
# ---------------------------------------------------------------------------

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip()


def get_commits_since(since_iso):
    """Return list of (sha, date_str, author, subject) since the given ISO date."""
    log = run([
        "git", "log",
        f"--since={since_iso}",
        "--format=%H|%ad|%an|%s",
        "--date=short",
    ])
    if not log:
        return []
    rows = []
    for line in log.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            rows.append(parts)
    return rows


def commit_stat(sha):
    """Return (files_changed, insertions, deletions) for a commit."""
    stat = run(["git", "show", "--stat", "--format=", sha])
    # Last line looks like: "3 files changed, 120 insertions(+), 5 deletions(-)"
    for line in reversed(stat.splitlines()):
        m = re.search(r'(\d+) files? changed', line)
        if m:
            files = int(m.group(1))
            ins = int(re.search(r'(\d+) insertion', line).group(1)) if 'insertion' in line else 0
            dels = int(re.search(r'(\d+) deletion', line).group(1)) if 'deletion' in line else 0
            return files, ins, dels
    return 0, 0, 0


def biggest_commit(commits):
    """Return the commit row with the most lines changed (ins + del)."""
    if not commits:
        return None
    best = None
    best_score = -1
    for row in commits:
        sha = row[0]
        _, ins, dels = commit_stat(sha)
        score = ins + dels
        if score > best_score:
            best_score = score
            best = (row, ins, dels)
    return best


# ---------------------------------------------------------------------------
# Period boundaries (UTC)
# ---------------------------------------------------------------------------

def period_starts():
    now = datetime.now(timezone.utc)
    # Day: midnight today
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Week: last Monday
    week_start = day_start - timedelta(days=now.weekday())
    # Month: 1st of current month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Quarter: first day of current quarter
    q_month = ((now.month - 1) // 3) * 3 + 1
    quarter_start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    # Year: Jan 1st
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return day_start, week_start, month_start, quarter_start, year_start


# ---------------------------------------------------------------------------
# Markdown builders
# ---------------------------------------------------------------------------

def fmt_biggest(label, result):
    if result is None:
        return f"- **{label}:** _No commits found_"
    row, ins, dels = result
    sha, date, author, subject = row
    short_sha = sha[:7]
    total = ins + dels
    return (
        f"- **{label}:** `{short_sha}` — {date} — **{author}** — {subject}  \n"
        f"  _{total} lines changed ({ins}+ / {dels}-)_"
    )


def build_recent_activity():
    log = run([
        "git", "log", "-5",
        "--format=%H|%h|%ad|%an|%s",
        "--date=short",
    ])
    if not log:
        return "- _No commits found_"

    lines = []
    for raw in log.splitlines():
        parts = raw.split("|", 4)
        if len(parts) != 5:
            continue
        sha, short_sha, date, author, subject = parts
        commit_url = f"{REPO_COMMIT_BASE_URL}/{sha}"
        site_url = commit_site_url(sha)
        lines.append(
            f"- [`{short_sha}`]({commit_url}) -- {date} -- {author} -- {subject} -- [Open page]({site_url})"
        )

    if not lines:
        return "- _No commits found_"
    return "\n".join(lines)


def commit_site_url(sha):
    """
    Choose a GitHub Pages URL for a commit by inspecting changed files.
    Prefers the first top-level project directory touched by the commit.
    Falls back to /router/ when no project directory can be inferred.
    """
    changed_files = run([
        "git", "show", "--name-only", "--pretty=format:", sha
    ])
    if not changed_files:
        return FALLBACK_RECENT_ACTIVITY_URL

    for rel_path in changed_files.splitlines():
        rel_path = rel_path.strip()
        if not rel_path:
            continue
        parts = rel_path.split("/", 1)
        if len(parts) < 2:
            # Root-level files do not map to a project page.
            continue
        top_level = parts[0]
        if top_level in SKIP_ACTIVITY_TOP_LEVEL_DIRS:
            continue
        if os.path.isdir(top_level):
            return f"{SITE_BASE_URL}/{top_level}/"

    return FALLBACK_RECENT_ACTIVITY_URL


def build_biggest_updates():
    day_start, week_start, month_start, quarter_start, year_start = period_starts()

    day_commits     = get_commits_since(day_start.isoformat())
    week_commits    = get_commits_since(week_start.isoformat())
    month_commits   = get_commits_since(month_start.isoformat())
    quarter_commits = get_commits_since(quarter_start.isoformat())
    year_commits    = get_commits_since(year_start.isoformat())

    lines = [
        fmt_biggest("Biggest update today",       biggest_commit(day_commits)),
        fmt_biggest("Biggest update this week",   biggest_commit(week_commits)),
        fmt_biggest("Biggest update this month",  biggest_commit(month_commits)),
        fmt_biggest("Biggest update this quarter", biggest_commit(quarter_commits)),
        fmt_biggest("Biggest update this year",   biggest_commit(year_commits)),
    ]
    return "\n".join(lines)


def build_last_updated():
    now = datetime.now(timezone.utc)
    return f"_Last updated: {now.strftime('%Y-%m-%d %H:%M UTC')}_"


def build_repo_stats():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Count top-level project directories (ignore hidden dirs and __pycache__)
    try:
        dirs = [
            d for d in os.listdir(root)
            if os.path.isdir(os.path.join(root, d))
            and not d.startswith('.')
            and d not in ('__pycache__',)
        ]
        project_count = len(dirs)
    except OSError:
        project_count = 0

    # Count workflow files
    workflows_dir = os.path.join(root, '.github', 'workflows')
    try:
        workflow_count = len([
            f for f in os.listdir(workflows_dir)
            if f.endswith('.yml') or f.endswith('.yaml')
        ])
    except OSError:
        workflow_count = 0

    # Total commits in repo
    total_commits = run(["git", "rev-list", "--count", "HEAD"])
    try:
        total_commits = int(total_commits)
    except (ValueError, TypeError):
        total_commits = 0

    lines = [
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| 📁 Project Directories | {project_count} |",
        f"| ⚙️ GitHub Actions Workflows | {workflow_count} |",
        f"| 📝 Total Commits | {total_commits} |",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# README rewriter
# ---------------------------------------------------------------------------

def replace_section(content, start_marker, end_marker, new_body):
    pattern = re.compile(
        rf"({re.escape(start_marker)}).*?({re.escape(end_marker)})",
        re.DOTALL,
    )
    return pattern.sub(rf"\1\n{new_body}\n\2", content, count=1)


def main():
    readme_path = "README.md"

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Last updated timestamp
    content = replace_section(
        content,
        "<!-- START_LAST_UPDATED -->",
        "<!-- END_LAST_UPDATED -->",
        build_last_updated(),
    )

    # Repository stats
    content = replace_section(
        content,
        "<!-- START_REPO_STATS -->",
        "<!-- END_REPO_STATS -->",
        build_repo_stats(),
    )

    # Recent activity
    content = replace_section(
        content,
        "<!-- START_RECENT_ACTIVITY -->",
        "<!-- END_RECENT_ACTIVITY -->",
        build_recent_activity(),
    )

    # Biggest updates
    content = replace_section(
        content,
        "<!-- START_BIGGEST_UPDATES -->",
        "<!-- END_BIGGEST_UPDATES -->",
        build_biggest_updates(),
    )

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("README.md updated.")


if __name__ == "__main__":
    main()
