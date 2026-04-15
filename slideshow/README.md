# /slideshow — Shared Slideshow Infrastructure

This directory is the single source of truth for image slideshow logic across every MajixAI sub-app.  Any page can get a full-featured, animated slideshow in a few lines.

## Files

| File | Purpose |
|------|---------|
| `slideshow-core.js` | `SlideshowManager` class (v2) — auto-rotation, multiple transitions, captions, dot indicators, callbacks, loop control, autoResume, preloading, and mutation methods |
| `slideshow.css` | Shared CSS classes (`.slideshow-carousel`, `.slide-img`, `.slide-progress`, `.slide-counter`, `.slide-caption`, `.slide-btn`, `.slide-dots`, `.slide-dot`) |
| `index.html` | Live demos (fade, slide, zoom, captions, dots, dynamic) and full API documentation |

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
    <div class="slide-caption"  id="myCaption"></div>
    <div class="slide-dots"     id="myDots"></div>
</div>
```

The `slide-btn` elements are invisible until the carousel is hovered or focused — no extra JS required.

### 3 — Initialise

```js
const mgr = new SlideshowManager(
    document.getElementById('myImg'),
    ['one.jpg', 'two.jpg', 'three.jpg'],
    {
        // Timing
        minDelay:         2000,          // ms — minimum time per slide
        maxDelay:         6000,          // ms — maximum time per slide
        fixedDelay:       0,             // overrides min/max when > 0
        autoResumeDelay:  4000,          // resume N ms after manual nav (0 = never)
        loop:             true,          // loop back to first slide at the end

        // Transition
        transition:         'slide',     // 'fade' | 'slide' | 'zoom' | 'none'
        transitionDuration: 350,         // ms

        // Controls
        progressBar:  document.getElementById('myProgress'),
        counter:      document.getElementById('myCounter'),
        prevBtn:      document.getElementById('myPrev'),
        nextBtn:      document.getElementById('myNext'),
        container:    document.getElementById('myCarousel'),
        keyboard:     true,              // ← / → keys
        touch:        true,              // horizontal swipe
        pauseOnHover: true,              // silent pause on mouse-enter

        // Captions & alt text
        captions:  ['First slide', 'Second slide', ''],
        captionEl: document.getElementById('myCaption'),
        alts:      ['Alt text 1', 'Alt text 2', 'Alt text 3'],

        // Dot indicators
        dotsContainer: document.getElementById('myDots'),

        // Callbacks
        onChange: (index, url, caption) => console.log('changed to', index),
        onStart:  () => console.log('started'),
        onStop:   () => console.log('stopped'),
    }
);
mgr.start();
```

---

## Transition styles

| Value | Effect |
|-------|--------|
| `'fade'` | Opacity crossfade (default) |
| `'slide'` | Image slides in from the right (next) or left (prev) |
| `'zoom'` | Current image zooms out and fades; new image fades in |
| `'none'` | Instant swap — no animation |

---

## Loading images from a compressed .dat file

`.dat` files are gzip/zlib-compressed JSON arrays of URLs, used by `/best/`.  Loading them requires [pako](https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js), which must be loaded **before** `slideshow-core.js`.

```js
SlideshowManager.fromDatFile(
    document.getElementById('myImg'),
    '/data/images.dat',
    { transition: 'slide', progressBar: ..., counter: ..., keyboard: true, touch: true }
).then(mgr => mgr.start());
```

---

## Loading images from a plain JSON file

No compression required.  Serve a `.json` file as a plain URL array, or a richer object with `images`, `captions`, and `alts` arrays.

```json
{
  "images":   ["https://example.com/a.jpg", "https://example.com/b.jpg"],
  "captions": ["A scenic mountain", "A calm lake"],
  "alts":     ["Mountain at sunrise", "Lake at dusk"]
}
```

```js
SlideshowManager.fromJsonUrl(
    document.getElementById('myImg'),
    '/data/images.json',
    { transition: 'zoom', captionEl: document.getElementById('myCaption') }
).then(mgr => mgr.start());
```

---

## Constructor options

### Timing

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minDelay` | `number` | `2000` | Minimum ms per slide (ignored when `fixedDelay > 0`) |
| `maxDelay` | `number` | `6000` | Maximum ms per slide (ignored when `fixedDelay > 0`) |
| `fixedDelay` | `number` | `0` | Fixed ms per slide — overrides min/max when > 0 |
| `autoResumeDelay` | `number` | `0` | Resume auto-rotation N ms after a manual navigation (0 = never) |
| `loop` | `boolean` | `true` | Loop back to the first slide after the last |

### Transition

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transition` | `string` | `'fade'` | `'fade'` \| `'slide'` \| `'zoom'` \| `'none'` |
| `transitionDuration` | `number` | `300` | Transition animation duration in ms |

### Controls

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `progressBar` | `HTMLElement` | `null` | Element whose width is animated 0 → 100% per slide |
| `counter` | `HTMLElement` | `null` | Element showing current index as "N/M" |
| `prevBtn` | `HTMLElement` | `null` | Previous button |
| `nextBtn` | `HTMLElement` | `null` | Next button |
| `container` | `HTMLElement` | `null` | Element receiving keyboard/touch events (falls back to `imgElement`) |
| `keyboard` | `boolean` | `false` | Enable ← / → key navigation |
| `touch` | `boolean` | `false` | Enable horizontal touch-swipe navigation |
| `pauseOnHover` | `boolean` | `false` | Silently pause while mouse is over container; resume on mouse-leave |

### Captions & alt text

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `captions` | `string[]` | `[]` | Caption strings aligned with `images[]`. Empty string → overlay hidden. |
| `captionEl` | `HTMLElement` | `null` | Element that receives caption text (auto-shown/hidden) |
| `alts` | `string[]` | `[]` | Alt text strings aligned with `images[]` |

### Dots, preload & callbacks

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dotsContainer` | `HTMLElement` | `null` | Container element; one clickable dot button per slide is auto-generated |
| `preload` | `boolean` | `true` | Preload the next image in background |
| `onChange` | `Function` | `null` | Called on every slide change: `(index, url, caption)` |
| `onStart` | `Function` | `null` | Called when `start()` begins auto-rotation |
| `onStop` | `Function` | `null` | Called when `stop()` ends auto-rotation |

---

## Instance methods

| Method | Description |
|--------|-------------|
| `start()` | Begin auto-rotation (no-op if fewer than 2 images or already running) |
| `stop()` | Stop auto-rotation and reset the progress bar |
| `next()` | Advance one slide |
| `prev()` | Go back one slide |
| `goTo(index)` | Jump to a specific index (direction-aware for slide transitions) |
| `addImages(urls, captions?, alts?)` | Append images to the end; rebuilds dots |
| `setImages(urls, captions?, alts?)` | Replace all images and reset to index 0 |
| `removeImage(index)` | Remove image at the given index; rebuilds dots |
| `getState()` | Returns `{ index, total, url, caption, alt, isRunning }` |
| `destroy()` | Remove all event listeners and clear the timer |

---

## Static factories

| Method | Returns | Description |
|--------|---------|-------------|
| `SlideshowManager.fromDatFile(imgEl, url, opts)` | `Promise<SlideshowManager>` | Load image list from a gzip-compressed `.dat` file (requires pako) |
| `SlideshowManager.fromJsonUrl(imgEl, url, opts)` | `Promise<SlideshowManager>` | Load from plain JSON — array or `{ images, captions, alts }` object |

Both factories fall back gracefully to the `<img>` element's current `src` if the file cannot be loaded.

---

## CSS classes (slideshow.css)

| Class | Element | Description |
|-------|---------|-------------|
| `.slideshow-carousel` | wrapper `div` | `position: relative; overflow: hidden` container |
| `.slide-img` | `img` | Full-width, `object-fit: cover`, opacity/transform transition |
| `.slide-progress` | `div` | Absolutely positioned bottom bar (3 px); animated by JS |
| `.slide-counter` | `div` | Top-right badge showing "N/M" |
| `.slide-caption` | `div` | Bottom gradient overlay for caption text (auto-shown/hidden by JS) |
| `.slide-btn` | `button` | Overlay arrow button — visible on hover/focus-within |
| `.slide-btn-prev` | `button` | Positions the button on the left side |
| `.slide-btn-next` | `button` | Positions the button on the right side |
| `.slide-dots` | `div` | Dot container — flex row. Inside `.slideshow-carousel`: absolute overlay at bottom-centre. |
| `.slide-dot` | `button` | Individual dot; gains `.active` class for current slide |

---

## Migrating from best/gamma/slideshow-manager.js

`/slideshow/slideshow-core.js` is a superset of `best/gamma/slideshow-manager.js`.  The constructor signature and all v1 method names are identical.  To migrate:

1. Replace `<script src="slideshow-manager.js">` with `<script src="/slideshow/slideshow-core.js">`.
2. Replace inline `slide-progress` / `slide-counter` styles with `<link rel="stylesheet" href="/slideshow/slideshow.css">`.
3. Optionally pass the new `transition`, `captions`, `captionEl`, `dotsContainer`, `autoResumeDelay`, `onChange`, etc. options to enable the extra features.
