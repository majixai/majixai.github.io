"""Shared repository-root integration helpers for bitcoin_miner."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

FEATURED_ROOT_DIRS = (
    "actions",
    "ai",
    "hash",
    "pwa",
    "router",
    "tensor",
    "yfinance_data",
    "gpu",
    "metatrader5",
    "tradingview_integration",
)


def _load_json_file(path: Path, default: Any):
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return default


def _load_projects_and_routes(repo_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    projects = _load_json_file(repo_root / "projects.json", [])
    routes_raw = _load_json_file(repo_root / "router" / "routes.json", {})

    if not isinstance(projects, list):
        projects = []
    routes = routes_raw.get("routes", routes_raw) if isinstance(routes_raw, dict) else routes_raw
    if not isinstance(routes, list):
        routes = []

    clean_projects = [project for project in projects if isinstance(project, dict)]
    clean_routes = [route for route in routes if isinstance(route, dict)]
    return clean_projects, clean_routes


def build_repo_integration_snapshot(repo_root: Path) -> dict[str, Any]:
    projects, routes = _load_projects_and_routes(repo_root)
    project_by_name = {
        str(project.get("name", "")).strip(): project
        for project in projects
        if project.get("name")
    }
    route_by_path = {
        str(route.get("path", "")).strip().lower(): route
        for route in routes
        if route.get("path")
    }
    categories = sorted({
        str(project.get("category", "")).strip()
        for project in projects
        if project.get("category")
    })

    featured_roots = []
    for name in FEATURED_ROOT_DIRS:
        route_path = f"/{name.strip('/')}/"
        project = project_by_name.get(name, {})
        route = route_by_path.get(route_path.lower(), {})
        local_dir = repo_root / name
        featured_roots.append({
            "name": name,
            "path": route_path,
            "category": project.get("category") or route.get("category") or "root",
            "desc": project.get("desc") or route.get("desc") or "",
            "has_index": (local_dir / "index.html").exists(),
            "has_readme": (local_dir / "README.md").exists(),
            "has_route": bool(route),
        })

    try:
        root_dir_count = sum(
            1 for entry in repo_root.iterdir()
            if entry.is_dir() and not entry.name.startswith(".")
        )
    except OSError:
        root_dir_count = 0

    return {
        "project_count": len(projects),
        "route_count": len(routes),
        "category_count": len(categories),
        "root_dir_count": root_dir_count,
        "featured_count": len(featured_roots),
        "featured_roots": featured_roots,
    }


def build_root_directory_summary(repo_root: Path) -> dict[str, Any]:
    snapshot = build_repo_integration_snapshot(repo_root)
    return {
        "project_count": snapshot["project_count"],
        "route_count": snapshot["route_count"],
        "featured_count": snapshot["featured_count"],
        "featured_roots": [
            {
                "name": root["name"],
                "path": root["path"],
                "category": root["category"],
                "has_route": root["has_route"],
                "has_index": root["has_index"],
                "has_readme": root["has_readme"],
            }
            for root in snapshot["featured_roots"]
        ],
    }
