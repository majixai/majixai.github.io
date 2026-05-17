# Object Detection Scaffold

This directory provides a Python object detection scaffold with three run modes:

- **Web backend + browser frontend** (FastAPI + WebSocket)
- **Local camera capture** (OpenCV)
- **Local screen capture** (`mss` + OpenCV)

The detector uses Ultralytics YOLO when available and automatically falls back to a lightweight stub detector if YOLO cannot be loaded.

## Features

- FastAPI server with:
  - `GET /health` for health checks
  - `GET /` for web UI
  - `WS /ws` for browser frame streaming and inference
- Browser app that captures webcam frames and streams JPEG frames over WebSocket
- CLI camera/screen loops with annotated preview windows
- Docker image support
- Pytest unit/integration tests
- GitHub Actions for linting, tests, Docker build, and browser integration smoke test

## Quickstart (Local)

```bash
cd object_detection
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Run web mode (backend + browser UI)

```bash
python -m app.run --source web --host 0.0.0.0 --port 8000
```

Open <http://127.0.0.1:8000> in your browser.

### Run camera mode

```bash
python -m app.run --source camera
```

### Run screen mode

```bash
python -m app.run --source screen --monitor-index 1
```

## Quickstart (Docker)

From repository root:

```bash
docker build -f object_detection/Dockerfile -t object-detection:local object_detection
docker run --rm -p 8000:8000 object-detection:local
```

Then open <http://127.0.0.1:8000>.

## Running tests and lint

From repository root:

```bash
pip install -r object_detection/requirements.txt
black --check object_detection/app object_detection/tests
flake8 object_detection/app object_detection/tests
PYTHONPATH=. pytest object_detection/tests -v
```

## GitHub Actions

- `.github/workflows/python-ci.yml`
  - lint (`black --check`, `flake8`)
  - unit tests (`pytest`) with coverage artifact upload
  - Docker build job with conditional push to GHCR
  - Playwright integration smoke test against a running `uvicorn` server
- `.github/workflows/docker-build.yml`
  - manual (`workflow_dispatch`) and default-branch push Docker build/push
