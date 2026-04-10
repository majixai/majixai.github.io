# /slideshow — Shared Slideshow Infrastructure

This directory is the single source of truth for image slideshow logic across every MajixAI sub-app.  Any page can get a full-featured auto-rotating slideshow in a few lines.

## Files

| File | Purpose |
|------|---------|
| `slideshow-core.js` | `SlideshowManager` class — auto-rotation, progress bar, counter, keyboard, touch, swipe, pause-on-hover, and two static loader factories |
| `slideshow.css` | Shared CSS classes (`.slideshow-carousel`, `.slide-img`, `.slide-progress`, `.slide-counter`, `.slide-btn`) |
| `index.html` | Live demo and full API documentation page |

---

## Quick start — adding a slideshow to any page

### 1 — Include the CSS and JS

```html
<!-- in <head> -->
<link rel="stylesheet" href="/slideshow/slideshow.css">

<!-- before </body> -->
<script src="/slideshow/slideshow-core.js"></script>
```

### 2 — Add the markup

```html
<div class="slideshow-carousel" id="myCarousel">
    <img class="slide-img" id="myImg" src="first.jpg" alt="Slide">
    <button class="slide-btn slide-btn-prev" id="myPrev">&#8249;</button>
    <button class="slide-btn slide-btn-next" id="myNext">&#8250;</button>
    <div class="slide-progress" id="myProgress"></div>
    <div class="slide-counter"  id="myCounter"></div>
</div>
```

The `slide-btn` elements are invisible until the carousel is hovered or focused — no extra JS required.

### 3 — Initialise

```js
const mgr = new SlideshowManager(
    document.getElementById('myImg'),
    ['one.jpg', 'two.jpg', 'three.jpg'],
    {
        minDelay:     2000,          // ms — minimum time per slide
        maxDelay:     6000,          // ms — maximum time per slide
        progressBar:  document.getElementById('myProgress'),
        counter:      document.getElementById('myCounter'),
        prevBtn:      document.getElementById('myPrev'),
        nextBtn:      document.getElementById('myNext'),
        container:    document.getElementById('myCarousel'),
        keyboard:     true,          // enable ← / → keys
        touch:        true,          // enable swipe
        pauseOnHover: true,          // pause while mouse is over container
    }
);
mgr.start();
```

---

## Loading images from a compressed .dat file

`.dat` files are gzip/zlib-compressed JSON arrays of URLs, used by `/best/`.  Loading them requires [pako](https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js), which must be loaded **before** `slideshow-core.js`.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
        integrity="sha512-F0nSK98Snn1dTBjRbFJTBnYdmdSWxFNcXfhb8rPXxIBqDFIJBvDdX89xmwrZJlZVePl8Fl8Jv/JSVK1+Kzlg=="
        crossorigin="anonymous"></script>
<script src="/slideshow/slideshow-core.js"></script>
```

```js
SlideshowManager.fromDatFile(
    document.getElementById('myImg'),
    '/data/images.dat',
    { progressBar: ..., counter: ..., keyboard: true, touch: true }
).then(mgr => mgr.start());
```

---

## Loading images from a plain JSON file

No compression — serve a `.json` file with an array of URL strings (or an object with an `images` array).

```json
["https://example.com/a.jpg", "https://example.com/b.jpg"]
```

```js
SlideshowManager.fromJsonUrl(
    document.getElementById('myImg'),
    '/data/images.json',
    { minDelay: 3000, maxDelay: 8000 }
).then(mgr => mgr.start());
```

---

## Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minDelay` | `number` | `2000` | Minimum ms per slide |
| `maxDelay` | `number` | `6000` | Maximum ms per slide |
| `progressBar` | `HTMLElement` | `null` | Element whose width is animated 0→100% per slide |
| `counter` | `HTMLElement` | `null` | Element showing current index as "N/M" |
| `prevBtn` | `HTMLElement` | `null` | Previous button — stops auto-rotation on click |
| `nextBtn` | `HTMLElement` | `null` | Next button — stops auto-rotation on click |
| `container` | `HTMLElement` | `null` | Element receiving keyboard/touch events (falls back to `imgElement`) |
| `keyboard` | `boolean` | `false` | Enable ← / → key navigation |
| `touch` | `boolean` | `false` | Enable touch swipe (40 px threshold) |
| `pauseOnHover` | `boolean` | `false` | Pause auto-rotation while mouse is over container |

---

## Instance methods

| Method | Description |
|--------|-------------|
| `start()` | Begin auto-rotation (no-op if fewer than 2 images or already running) |
| `stop()` | Stop auto-rotation and reset the progress bar |
| `next()` | Advance one slide |
| `prev()` | Go back one slide |
| `goTo(index)` | Jump to a specific index (wraps around) |
| `destroy()` | Remove all event listeners and clear the timer |

---

## Static factories

| Method | Returns | Description |
|--------|---------|-------------|
| `SlideshowManager.fromDatFile(imgEl, url, opts)` | `Promise<SlideshowManager>` | Load image list from a gzip-compressed `.dat` file (requires pako) |
| `SlideshowManager.fromJsonUrl(imgEl, url, opts)` | `Promise<SlideshowManager>` | Load image list from a plain JSON array file |

Both factories fall back gracefully to the `<img>` element's current `src` if the file cannot be loaded.

---

## CSS classes (slideshow.css)

| Class | Element | Description |
|-------|---------|-------------|
| `.slideshow-carousel` | wrapper `div` | `position: relative; overflow: hidden` container |
| `.slide-img` | `img` | Full-width, `object-fit: cover`, opacity fade transition |
| `.slide-progress` | `div` | Absolutely positioned bottom bar; animated width by JS |
| `.slide-counter` | `div` | Top-right badge showing "N/M" |
| `.slide-btn` | `button` | Overlay arrow button — visible on hover/focus-within |
| `.slide-btn-prev` | `button` | Positions the button on the left side |
| `.slide-btn-next` | `button` | Positions the button on the right side |

---

## Migrating from best/gamma/slideshow-manager.js

`/slideshow/slideshow-core.js` is a superset of `best/gamma/slideshow-manager.js`.  The constructor signature and all method names are identical.  To migrate:

1. Replace `<script src="slideshow-manager.js">` with `<script src="/slideshow/slideshow-core.js">`.
2. Replace `<link>` / `<style>` blocks for `.slide-progress` and `.slide-counter` with `<link rel="stylesheet" href="/slideshow/slideshow.css">`.
3. Optionally pass the new `prevBtn`, `nextBtn`, `keyboard`, `touch`, and `pauseOnHover` options to enable the extra features.
