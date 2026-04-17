# Jinx

This directory is action-enabled through the shared `/actions` runtime.

## Action Workflow

- Uses `/actions/actions-core.js` as the central action dispatcher.
- Default namespace: `jinx`.
- `MajixActions.init()` is auto-wired from `index.html`.
- Register handlers with `MajixActions.on(...)` and dispatch with `MajixActions.dispatch(...)`.

## Notes

- Keep action names scoped by feature, e.g. `search/run`, `data/load`, `ui/refresh`.
- See `/actions/README.md` for full API and middleware patterns.
