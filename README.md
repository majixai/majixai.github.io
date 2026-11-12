# DUET Channel Clustering Demo

Client-side DUET channel clustering demo for Android Chrome and desktop browsers.

## Usage

- Open `index.html` directly in a modern browser, or host the folder as static files.
- Click **Run Clustering** to compute the channel-affinity matrix.
- The demo uses:
  - TensorFlow.js (`tf.spectral.rfft`, distance, normalization)
  - pako.js (in-browser gzip round-trip check)
  - Bootstrap 5 (UI)

## Run options

- Local file open: open `neural/duet-channel-clustering/index.html`.
- Local static server (recommended):

  ```bash
  cd /home/runner/work/majixai.github.io/majixai.github.io
  python -m http.server 8080
  ```

  then browse to:
  `http://127.0.0.1:8080/neural/duet-channel-clustering/`

- GitHub Pages: published from `neural/duet-channel-clustering/` to `gh-pages` via workflow.
