# `/pagination` — Centralized Pagination Module

A single, reusable pagination library for every directory on **majixai.github.io**.

## Files

| File | Purpose |
|------|---------|
| `pagination.js` | Core `Paginator` class (no dependencies) |
| `pagination.css` | Stylesheet with light/dark/size themes |
| `index.html` | Live demo & integration guide |

---

## Quick Start

Add these two tags to any page in the project:

```html
<link rel="stylesheet" href="/pagination/pagination.css">
<script src="/pagination/pagination.js"></script>
```

---

## Usage

### 1 · Data-array mode (custom render)

```js
const pager = new Paginator({
  data:         myArray,
  container:    '#my-list',   // element where items are rendered
  paginationEl: '#my-pg',     // element where page buttons are placed
  perPage:      10,
  render(item, container) {
    container.insertAdjacentHTML('beforeend', `<li>${item.name}</li>`);
  },
});
```

### 2 · Existing `<tbody>` (table rows already in DOM)

```js
const pager = Paginator.fromTable('#my-tbody', {
  paginationEl: '#my-pg',
  perPage: 10,
});
```

### 3 · Existing list (`<ul>` / `<ol>`)

```js
const pager = Paginator.fromList('#my-ul', {
  paginationEl: '#my-pg',
  perPage: 8,
});
```

### 4 · Existing card grid

```js
const pager = Paginator.fromCards('#my-cards', {
  paginationEl: '#my-pg',
  perPage: 12,
});
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data` | `Array` | `[]` | Items to paginate (data-array mode) |
| `domItems` | `Array` | — | Pre-collected DOM children (internal, set by factories) |
| `container` | `string\|HTMLElement` | — | Render target for data-array mode |
| `paginationEl` | `string\|HTMLElement` | — | Mount point for pagination buttons |
| `perPage` | `number` | `10` | Items per page |
| `maxVisible` | `number` | `7` | Max page buttons before ellipsis kicks in |
| `showFirstLast` | `boolean` | `true` | Show «/» first/last buttons |
| `showPrevNext` | `boolean` | `true` | Show ‹/› prev/next buttons |
| `urlHash` | `boolean` | `false` | Sync current page to URL hash |
| `hashParam` | `string` | `'page'` | URL hash parameter name |
| `render` | `Function` | — | `fn(item, containerEl)` — data-array mode |
| `onPageChange` | `Function` | — | `fn(page, visibleItems)` callback |

---

## Public API

```js
pager.page          // current page (1-based, read-only)
pager.pageCount     // total pages (read-only)
pager.total         // total items (read-only)
pager.currentItems  // items on current page (read-only)

pager.goTo(n)       // go to page n
pager.next()        // next page
pager.prev()        // previous page
pager.first()       // go to page 1
pager.last()        // go to last page

pager.setData(arr)     // replace data array, reset to page 1
pager.setPerPage(n)    // change items-per-page, reset to page 1
pager.destroy()        // remove event listeners, clear buttons
```

---

## CSS Themes

Apply class on the `<nav>` or any ancestor element:

```html
<!-- Default (light) -->
<nav id="pg"></nav>

<!-- Dark -->
<nav id="pg" class="pgr-dark"></nav>

<!-- Small -->
<nav id="pg" class="pgr-sm"></nav>

<!-- Large -->
<nav id="pg" class="pgr-lg"></nav>
```

### Custom colours via CSS variables

```css
#pg {
  --pgr-active-bg:     #06d6a0;
  --pgr-active-border: #06d6a0;
  --pgr-hover-bg:      #e0fdf4;
  --pgr-hover-color:   #064e3b;
}
```

---

## Migrating existing pagination

The module mirrors the pattern already used in `/requests/script.js` and `/yfinance_data/script.js`.
Replace hand-written pagination with:

```html
<!-- In your HTML -->
<div id="pagination-container"></div>

<script src="/pagination/pagination.css"></script>
<script src="/pagination/pagination.js"></script>
<script>
  // After allRows is populated:
  const pager = new Paginator({
    data:         allRows,
    container:    '#data-container',
    paginationEl: '#pagination-container',
    perPage:      10,
    render(row, container) {
      // your existing row-rendering logic
    },
  });
</script>
```
