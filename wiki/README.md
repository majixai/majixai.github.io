# /wiki — Shared Wiki Management Module

This root-level directory centralizes wiki storage and wiki-page management for
MajixAI apps.

It is action-enabled via the shared modular dispatcher at
`/actions/actions-core.js`.

## Files

| File | Purpose |
|------|---------|
| `wiki-core.js` | Global `MajixWiki` API for wiki CRUD, search, import/export, localStorage persistence |
| `index.html` | Browser demo for creating, editing, deleting, and searching wiki pages with action dispatch |
| `USAGE.md` | Extended usage patterns, lifecycle behavior, and persistence notes |
| `ACTIONS.md` | Action integration reference and event/action mapping |

## Quick Start

```html
<script>
  window.ACTIONS_CONFIG = { namespace: 'wiki' };
  window.WIKI_CONFIG = {
    namespace: 'wiki',
    storageKey: 'majixWikiPages',
    autoDispatch: false
  };
</script>
<script src="/actions/actions-core.js"></script>
<script src="/wiki/wiki-core.js"></script>
<script>
  MajixActions.init();
  MajixWiki.init();

  MajixActions.on('page/create', function (payload) { MajixWiki.create(payload); });
  MajixActions.dispatch('page/create', { title: 'Home', content: 'Welcome' });
</script>
```

## `WIKI_CONFIG` Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `namespace` | `string` | `'wiki'` | Logical namespace value for app-level wiki usage |
| `storageKey` | `string` | `'majixWikiPages'` | localStorage key used for persisted wiki pages |
| `maxPages` | `number` | `1000` | Maximum wiki pages retained in storage |
| `autoPersist` | `boolean` | `true` | Persist changes to localStorage automatically |
| `autoDispatch` | `boolean` | `true` | Dispatch actions (`page/create`, `page/update`, etc.) when wiki changes |

## `MajixWiki` API

- `MajixWiki.init(config?)`
- `MajixWiki.list()`
- `MajixWiki.get(idOrSlug)`
- `MajixWiki.create({ title, content?, slug?, tags? })`
- `MajixWiki.update(idOrSlug, patch)`
- `MajixWiki.remove(idOrSlug)`
- `MajixWiki.search(query)`
- `MajixWiki.clear()`
- `MajixWiki.importPages(pages, { replace? })`
- `MajixWiki.exportPages()`
- `MajixWiki.count()`
- `MajixWiki.on(eventName, handler)` / `MajixWiki.off(eventName, handler?)`

## Page Shape

Each stored page follows this structure:

- `id` (`string`) — unique page identifier
- `title` (`string`) — user-facing title (required)
- `slug` (`string`) — URL/key-friendly identifier derived from title or provided slug
- `content` (`string`) — page body content
- `tags` (`string[]`) — arbitrary tags for filtering/search
- `createdAt` (`string`) — ISO timestamp of creation
- `updatedAt` (`string`) — ISO timestamp of latest update

## Core Behavior Notes

- Slugs are normalized to lowercase kebab-case and made unique automatically.
- `list()` returns pages sorted by descending `updatedAt` (most recent first).
- `search(query)` matches against title, slug, content, and tags.
- `maxPages` capacity is enforced by removing the oldest updated pages first.
- `importPages()` validates the input array and normalizes imported values.
- `init()` merges defaults with `window.WIKI_CONFIG` and call-time config.

## Events

`MajixWiki` emits internal events via `on/off`:

- `init`
- `create`
- `update`
- `remove`
- `clear`
- `import`
- `pages_truncated`
- `error`

## Action Integration Notes

- Shared dispatcher: `/actions/actions-core.js`
- Typical wiki action types:
  - `page/create`
  - `page/update`
  - `page/delete`
  - `page/search`
  - `page/clear`
- Additional emitted action:
  - `page/import`
- Optional emitted action when page limit is exceeded:
  - `page/truncated`
- Keep wiki action names feature-scoped and namespaced through `ACTIONS_CONFIG`.

## Additional Docs

- See `/wiki/USAGE.md` for lifecycle and operational usage guidance.
- See `/wiki/ACTIONS.md` for action wiring and payload conventions.
