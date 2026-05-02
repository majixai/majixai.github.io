# go — Goals Operations Manager

> **Central hub for tracking and managing all future goals and operational tasks across the majixai.github.io repository.**

Live URL: [https://majixai.github.io/go/](https://majixai.github.io/go/)

---

## Overview

The `go/` module is a browser-based Goals Operations (GoOps) manager that lets you:

- **Create, update, and delete goals** with title, description, status, priority, category, linked project, due date, tags, and notes.
- **Filter and search** goals by any combination of status, priority, category, tag, or overdue state.
- **Sort** by updated date, created date, due date, priority, or title.
- **Track progress** with a live stats bar (total, by-status counts, overdue alerts, completion rate).
- **Export** to JSON (machine-readable), Markdown (human-readable reports), or CSV.
- **Import** a JSON array of goals from file.
- **Undo / redo** all mutations (configurable history depth, default 100 steps).
- **Persist** everything to `localStorage` — no server required.
- **Integrate** with `MajixActions` (optional): goal mutations are dispatched as `goal/<op>` events when `window.MajixActions` is present.

---

## File Structure

```
go/
├── go-core.js    Core library (IIFE, zero dependencies)
├── go.css        Dark-theme stylesheet
├── index.html    Full dashboard UI
└── README.md     This file
```

---

## Quick Start

### Use the dashboard

Open [https://majixai.github.io/go/](https://majixai.github.io/go/) in any modern browser.

### Embed the core library

```html
<script src="/go/go-core.js"></script>
<script>
  // optional config (merged with defaults)
  window.GO_CONFIG = {
    storageKey:   'majixGoals',
    historyLimit: 100,
    autoDispatch: true,   // emit MajixActions events
  };
  // MajixGo is auto-initialised on load; call init() again only to change config
  MajixGo.init();

  // Create a goal
  var g = MajixGo.add({
    title:         'Implement Phase B provenance pipeline',
    status:        'pending',
    priority:      'high',
    category:      'finance',
    linkedProject: 'tradingview_integration',
    dueDate:       '2026-06-01',
    tags:          ['phase-b', 'backend'],
  });
  console.log(g.id);   // UUID

  // Update status
  MajixGo.setStatus(g.id, 'in-progress');

  // Query
  var open = MajixGo.list({ status: 'in-progress' });
  console.log(open);

  // Stats
  console.log(MajixGo.stats());
  // { total: 1, byStatus: { pending: 0, 'in-progress': 1, … }, overdue: 0, completionRate: 0 }
</script>
```

---

## Goal Schema

| Field           | Type       | Description                                                        |
|-----------------|------------|--------------------------------------------------------------------|
| `id`            | `string`   | UUID v4, auto-assigned                                             |
| `title`         | `string`   | Short goal title (**required**)                                    |
| `description`   | `string`   | Full description / acceptance criteria                             |
| `status`        | `string`   | `pending` \| `in-progress` \| `done` \| `cancelled` \| `blocked` |
| `priority`      | `string`   | `low` \| `medium` \| `high` \| `critical`                        |
| `category`      | `string`   | Matches `projects.json` category (finance, tools, ai, …)          |
| `tags`          | `string[]` | Arbitrary labels                                                   |
| `linkedProject` | `string`   | Project path key, e.g. `tradingview_integration`                  |
| `createdAt`     | `string`   | ISO-8601, auto-set                                                 |
| `updatedAt`     | `string`   | ISO-8601, auto-set on every write                                  |
| `dueDate`       | `string`   | ISO-8601 date (optional)                                           |
| `notes`         | `string`   | Freeform progress log                                              |
| `completedAt`   | `string`   | ISO-8601, auto-set when `status` → `done`                         |

---

## API Reference

```js
MajixGo.add(data)                 // → goal   — create and persist a new goal
MajixGo.update(id, patch)         // → goal   — partial update
MajixGo.remove(id)                // → bool   — delete
MajixGo.get(id)                   // → goal | null
MajixGo.list(filter?)             // → goal[] — filter by status/priority/category/tag/overdue
MajixGo.setStatus(id, status)     // → goal   — shortcut for update({ status })
MajixGo.search(query)             // → goal[] — full-text across title/desc/notes/tags
MajixGo.stats()                   // → { total, byStatus, byPriority, byCategory, overdue, completionRate }
MajixGo.export('json'|'csv'|'md') // → string
MajixGo.importJSON(jsonStr)       // → { added, skipped }
MajixGo.clear()                   // → void   — wipe all goals (undoable)
MajixGo.undo()                    // → snapshot | null
MajixGo.redo()                    // → snapshot | null
MajixGo.on(event, fn)             // → this   — subscribe to 'add'|'update'|'remove'|'status'|'clear'|'import'
MajixGo.off(event, fn)            // → this   — unsubscribe
```

---

## Keyboard Shortcuts

| Shortcut | Action        |
|----------|---------------|
| `Ctrl+S` | Save goal     |

---

## Integration with MajixActions

If `/actions/actions-core.js` is loaded before `go-core.js`, every mutation dispatches a `goal/<op>` action (e.g. `goal/add`, `goal/update`, `goal/remove`). Set `autoDispatch: false` in `GO_CONFIG` to opt out.

---

## Storage

All data is persisted in `localStorage` under the `storageKey` (default: `majixGoals`). No network requests are made. The dashboard works fully offline.
