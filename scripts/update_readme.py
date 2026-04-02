"""
update_readme.py

Reads the git log to compute:
  - Recent activity (last 5 commits)
  - Biggest commit (by files changed) for: today, this week, this month,
    this quarter, and this year.

Then rewrites the corresponding <!-- marker --> sections in README.md.
"""

import re
import subprocess
from datetime import datetime, timezone, timedelta


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
        "--format=%h -- %ad -- %an -- %s",
        "--date=short",
    ])
    lines = [f"- {l}" for l in log.splitlines()] if log else ["- _No commits found_"]
    return "\n".join(lines)


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
