# /wiki Usage Guide

This guide describes how to use the shared `MajixWiki` module in production pages
and internal tools.

## Initialization Lifecycle

1. Load `/actions/actions-core.js` if you need action dispatch integration.
2. Load `/wiki/wiki-core.js`.
3. Call `MajixWiki.init(config?)` with any per-app overrides.
4. Register action handlers and/or wiki event listeners.

`wiki-core.js` also calls `MajixWiki.init()` once at load time, so explicit app
initialization is typically used to override config and establish expected state.

## Persistence Model

- Storage backend: `window.localStorage`
- Storage key: `WIKI_CONFIG.storageKey` (default: `majixWikiPages`)
- Persist behavior: controlled by `autoPersist` (default: `true`)

If localStorage is unavailable or fails, the module emits an `error` event and
continues running in memory for the session.

## Capacity Management

`maxPages` controls maximum retained pages (default `1000`).

When exceeded:

- pages are sorted by `updatedAt` ascending,
- oldest pages are removed first,
- `pages_truncated` event is emitted,
- `page/truncated` action is dispatched when action dispatch is enabled.

## Recommended App Patterns

- Route create/update/delete through one action layer to avoid duplicate updates.
- Keep `autoDispatch: false` in demos that already dispatch through `MajixActions`.
- Use slugs for URL-like linking, IDs for internal mutation operations.
- Prefer `search(query)` for user-facing lookups and `get(idOrSlug)` for exact retrieval.

## Import/Export

- `exportPages()` returns a sorted copy of all pages.
- `importPages(pages, { replace })` normalizes incoming data and enforces `maxPages`.
- Use `{ replace: true }` to fully restore from a backup snapshot.

## Error Handling

Use `MajixWiki.on('error', handler)` to capture:

- persistence failures,
- load failures,
- action dispatch failures,
- listener callback errors.

This enables logging and graceful fallback behavior in host applications.
