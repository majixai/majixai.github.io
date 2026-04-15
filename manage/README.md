# `/manage` — Centralized README Processing Library

A shared library for parsing, rendering, editing, and batch-processing
Markdown README files across **majixai.github.io**.

Follows the same drop-in pattern as `/pagination`, `/pwa`, and the other
shared modules: include two lines of HTML and call `MajixManage.init()`.

---

## Files

| File | Purpose |
|------|---------|
| `manage-core.js` | Browser-side `MajixManage` global IIFE — parse/render/edit/history |
| `manage.css` | CSS-variable-driven styles (light / dark, responsive) |
| `manage-cli.js` | Node.js CLI — batch README processing, scanning, stats |
| `index.html` | Live demo: preview, editor, split view, section cards, history |

---

## Quick Start

### Browser

```html
<link rel="stylesheet" href="/manage/manage.css">
<script src="/manage/manage-core.js"></script>
```

```js
window.MANAGE_CONFIG = {
  namespace:    'my-app',
  storageKey:   'my-app-doc',   // persists doc in localStorage
  historyLimit: 50,
  onChange: (sectionName, newContent) => console.log(sectionName, newContent),
};

MajixManage.init();

// Load a remote README
MajixManage.load('/README.md').then(() => {
  const sections = MajixManage.listSections();  // ['LAST_UPDATED', 'REPO_STATS', …]
  const stats    = MajixManage.getSection('REPO_STATS');
  MajixManage.render(null, document.querySelector('#preview'));
});
```

### Node.js CLI

```bash
# List all marker sections in a README
node manage/manage-cli.js list .

# Get a section's content
node manage/manage-cli.js get . --section REPO_STATS

# Replace a section
node manage/manage-cli.js set . --section LAST_UPDATED --content "2026-04-15"

# Add a new section (appended by default)
node manage/manage-cli.js add . --section CHANGELOG --content "## v1.0\n- Initial release"

# Remove a section
node manage/manage-cli.js remove . --section CHANGELOG

# Scan all directories for READMEs
node manage/manage-cli.js scan . --pattern "*/README.md"

# Convert a README to HTML
node manage/manage-cli.js render pagination --out /tmp/pagination.html

# Print stats across all READMEs
node manage/manage-cli.js stats .
```

---

## Marker Convention

Sections are delimited by HTML comments:

```markdown
<!-- START_SECTION_NAME -->
…content…
<!-- END_SECTION_NAME -->
```

Section names are stored uppercase.  The library is case-insensitive on
input (`repo_stats`, `REPO_STATS`, and `Repo_Stats` all resolve to the
same section).

This is the same convention used by `scripts/update_readme.py`.

---

## `MANAGE_CONFIG` Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `namespace` | `string` | `'majix-manage'` | Logical namespace (used in events) |
| `storageKey` | `string` | `'majix-manage-doc'` | `localStorage` key for auto-save; `null` to disable |
| `historyLimit` | `number` | `100` | Maximum undo/redo entries |
| `onChange` | `function(name, content)` | `null` | Called after every section mutation |
| `onLoad` | `function(url, text)` | `null` | Called after `load()` resolves |
| `onRender` | `function(el)` | `null` | Called after `render()` |

---

## API Reference

### Lifecycle

```js
MajixManage.init(config?)   // initialise; merges with window.MANAGE_CONFIG
```

### Parsing

```js
const { sections, source } = MajixManage.parse(markdownString);
// sections: Map<NAME, { content, raw, startIdx, endIdx }>
// source: the string that was parsed
```

### Section CRUD

```js
MajixManage.listSections()                        // → string[]
MajixManage.getSection('REPO_STATS')              // → string | null
MajixManage.setSection('REPO_STATS', newContent)  // → updated doc string
MajixManage.addSection('NEW_SECTION', content, position?)  // position: number | 'start' | 'end'
MajixManage.removeSection('OLD_SECTION')          // → updated doc string
```

### Rendering

```js
// Render the full document into an element
MajixManage.render(markdownString?, '#preview')

// Render a single section
MajixManage.renderSection('FEATURES', '#features-div')
```

`render()` returns the element so you can chain or store it.

### Remote I/O

```js
// Fetch & parse a remote README
MajixManage.load('/README.md').then(text => { … })

// Trigger browser download of the current document
MajixManage.save()
MajixManage.save(customContent, 'my-readme.md')
```

### History (undo / redo)

```js
MajixManage.history()   // → [{timestamp, section, old, new}, …]
MajixManage.undo()      // → updated doc string | null
MajixManage.redo()      // → updated doc string | null
```

### Export

```js
MajixManage.export()           // 'markdown' — returns current source
MajixManage.export('html')     // full HTML string
MajixManage.export('json')     // { source, sections: { NAME: content, … } }
```

### Events

```js
MajixManage.on('change',  (name, newContent, oldContent) => {})
MajixManage.on('add',     (name, content) => {})
MajixManage.on('remove',  (name) => {})
MajixManage.on('parse',   ({ sections, source }) => {})
MajixManage.on('load',    (url, text) => {})
MajixManage.on('render',  (el) => {})
MajixManage.on('save',    (filename) => {})
MajixManage.on('init',    (config) => {})
MajixManage.off(event, fn)
```

---

## CLI Reference

```
node manage/manage-cli.js <command> [dir] [options]

Commands:
  list   [dir]                           List all sections in README.md
  get    [dir]  --section NAME           Print a section's content
  set    [dir]  --section NAME
                --content TEXT           Replace section content
  add    [dir]  --section NAME
                --content TEXT
                [--position N|start|end] Add a new section
  remove [dir]  --section NAME           Remove a section
  scan   [root] [--pattern GLOB]         Find READMEs and list their sections
  render [dir]  [--out FILE]             Convert README.md to HTML
  stats  [root]                          README statistics across all dirs
```

---

## Integration with `scripts/update_readme.py`

`manage-core.js` and `manage-cli.js` use the **same marker convention** as
the existing Python script, so they can read and write the same
`<!-- START_X --> … <!-- END_X -->` blocks without any migration.

Example: keep the root README up to date from a GitHub Actions workflow:

```yaml
- name: Update LAST_UPDATED section
  run: |
    node manage/manage-cli.js set . \
      --section LAST_UPDATED \
      --content "_Last updated: $(date -u '+%Y-%m-%d %H:%M UTC')_"
```

---

## Demo

Open [`index.html`](index.html) for a live editor featuring:

- **Preview** — rendered Markdown view
- **Editor** — raw source textarea with live sync
- **Split** — side-by-side source + preview
- **Sections** — card overview of every marker section
- **History** — full undo/redo audit trail
- **About** — feature summary and usage guide
