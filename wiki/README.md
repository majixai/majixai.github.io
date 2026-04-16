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

## Action Integration Notes

- Shared dispatcher: `/actions/actions-core.js`
- Typical wiki action types:
  - `page/create`
  - `page/update`
  - `page/delete`
  - `page/search`
  - `page/clear`
- Keep wiki action names feature-scoped and namespaced through `ACTIONS_CONFIG`.
