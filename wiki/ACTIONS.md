# /wiki Actions Reference

This document maps common wiki operations to shared action types used with
`/actions/actions-core.js`.

## Prerequisites

- `ACTIONS_CONFIG.namespace` should be set to your app namespace.
- `WIKI_CONFIG.autoDispatch` determines whether wiki mutations emit actions.
- Host apps can still dispatch manually even when `autoDispatch` is disabled.

## Common Action Types

### `page/create`

Create a new page.

Expected payload fields:

- `title` (required)
- `content` (optional)
- `slug` (optional)
- `tags` (optional string array)

### `page/update`

Update an existing page by ID or slug.

Expected payload fields:

- `id` (or use slug when your handler resolves by slug)
- any patch fields: `title`, `content`, `slug`, `tags`

### `page/delete`

Delete a page.

Expected payload fields:

- `id` (recommended)

### `page/search`

Search pages with a free-text query.

Expected payload fields:

- `query`

### `page/clear`

Delete all pages for the configured storage key.

Expected payload fields:

- none required

## Additional Emitted Types

### `page/import`

Emitted after successful `importPages`.

Payload:

- `count`
- `replace`

### `page/truncated`

Emitted when `maxPages` is exceeded and old pages are removed.

Payload:

- `removed`
- `kept`
- `maxPages`

## Event vs Action

- **Events** are internal (`MajixWiki.on(...)`) and remain in-process.
- **Actions** are dispatched through `MajixActions` and can be observed by any
  listeners in the same action namespace.

Use events for local state observation and actions for shared app-level workflows.
