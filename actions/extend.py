#!/usr/bin/env python3
"""
extend.py — MajixActions extender

Wires a target top-level directory to the shared /actions/actions-core.js runtime by:
1) patching index.html to include ACTIONS_CONFIG + script + init (if needed)
2) writing a README.md starter section for action workflow usage (if missing)

Usage:
    python3 actions/extend.py <target_dir> [--force]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_TAG = '<script src="/actions/actions-core.js"></script>'
INIT_SNIPPET = (
    "<script>\n"
    "  window.ACTIONS_CONFIG = window.ACTIONS_CONFIG || { namespace: '__NAMESPACE__' };\n"
    "  if (typeof MajixActions !== 'undefined') MajixActions.init();\n"
    "</script>\n"
)


def _derive_namespace(dir_name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", dir_name.lower()).strip("-") or "majix-app"


def _patch_index_html(index_path: Path, namespace: str, force: bool) -> bool:
    if not index_path.exists():
        print(f"  SKIP  {index_path} (missing index.html)")
        return False

    content = index_path.read_text(encoding="utf-8", errors="replace")
    original = content

    has_script = "/actions/actions-core.js" in content
    has_init = "MajixActions.init()" in content
    has_cfg = "ACTIONS_CONFIG" in content

    if not force and has_script and has_init and has_cfg:
        print(f"  KEEP  {index_path} (already wired)")
        return False

    if not has_script:
        if re.search(r"</body>", content, flags=re.IGNORECASE):
            content = re.sub(
                r"(</body>)",
                f"{SCRIPT_TAG}\n\\1",
                content,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            content = f"{content.rstrip()}\n{SCRIPT_TAG}\n"

    if not has_cfg and not has_init:
        snippet = INIT_SNIPPET.replace("__NAMESPACE__", namespace)
        if re.search(rf"{re.escape(SCRIPT_TAG)}", content):
            content = content.replace(SCRIPT_TAG, f"{snippet}{SCRIPT_TAG}", 1)
        elif re.search(r"</body>", content, flags=re.IGNORECASE):
            content = re.sub(
                r"(</body>)",
                f"{snippet}\\1",
                content,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            content = f"{content.rstrip()}\n{snippet}"
    elif has_cfg and not has_init:
        init_only = (
            "<script>\n"
            "  if (typeof MajixActions !== 'undefined') MajixActions.init();\n"
            "</script>\n"
        )
        if re.search(rf"{re.escape(SCRIPT_TAG)}", content):
            content = content.replace(SCRIPT_TAG, f"{init_only}{SCRIPT_TAG}", 1)
        elif re.search(r"</body>", content, flags=re.IGNORECASE):
            content = re.sub(
                r"(</body>)",
                f"{init_only}\\1",
                content,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            content = f"{content.rstrip()}\n{init_only}"

    if content != original:
        index_path.write_text(content, encoding="utf-8")
        print(f"  WRITE {index_path} (actions wired)")
        return True

    print(f"  SKIP  {index_path} (already wired)")
    return False


def _write_readme(readme_path: Path, dir_name: str, namespace: str, force: bool) -> bool:
    if readme_path.exists() and not force:
        print(f"  SKIP  {readme_path} (already exists)")
        return False

    title = dir_name.replace("-", " ").replace("_", " ").title()
    content = (
        f"# {title}\n\n"
        "This directory is action-enabled through the shared `/actions` runtime.\n\n"
        "## Action Workflow\n\n"
        "- Uses `/actions/actions-core.js` as the central action dispatcher.\n"
        f"- Default namespace: `{namespace}`.\n"
        "- `MajixActions.init()` is auto-wired from `index.html`.\n"
        "- Register handlers with `MajixActions.on(...)` and dispatch with `MajixActions.dispatch(...)`.\n\n"
        "## Notes\n\n"
        "- Keep action names scoped by feature, e.g. `search/run`, `data/load`, `ui/refresh`.\n"
        "- See `/actions/README.md` for full API and middleware patterns.\n"
    )
    readme_path.write_text(content, encoding="utf-8")
    print(f"  WRITE {readme_path}")
    return True


def extend_directory(target: Path, force: bool = False) -> bool:
    if not target.is_dir():
        print(f"ERROR: target '{target}' is not a directory.", file=sys.stderr)
        return False

    namespace = _derive_namespace(target.name)
    wrote_index = _patch_index_html(target / "index.html", namespace, force)
    wrote_readme = _write_readme(target / "README.md", target.name, namespace, force)
    return wrote_index or wrote_readme


def main() -> int:
    parser = argparse.ArgumentParser(description="Extend a directory with MajixActions wiring.")
    parser.add_argument("target_dir", help="Directory to extend with actions workflow")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files when applicable")
    args = parser.parse_args()

    target = Path(args.target_dir).resolve()
    print(f"Extending actions into: {target}")
    wrote = extend_directory(target, force=args.force)
    if wrote:
        print("Done — actions integration updated.")
    else:
        print("Done — nothing changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
