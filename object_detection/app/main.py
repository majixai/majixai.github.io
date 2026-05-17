"""FastAPI service for browser-based object detection over WebSockets."""

from __future__ import annotations

import base64
import json
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .detector import Detector

WEB_DIR = Path(__file__).parent / "web"

app = FastAPI(title="Object Detection Scaffold")
app.mount("/web", StaticFiles(directory=str(WEB_DIR)), name="web")

_detector = Detector()


@app.get("/")
async def root() -> FileResponse:
    """Serve the browser frontend."""
    return FileResponse(WEB_DIR / "index.html")


@app.get("/health")
async def health() -> JSONResponse:
    """Simple health endpoint for tests and CI."""
    return JSONResponse({"status": "ok"})


def _decode_frame(frame_payload: str) -> np.ndarray:
    """Decode a raw base64 or data URL JPEG payload into a BGR image."""
    if "," in frame_payload:
        _, frame_payload = frame_payload.split(",", 1)

    binary = base64.b64decode(frame_payload)
    array = np.frombuffer(binary, dtype=np.uint8)
    frame = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Unable to decode image frame")
    return frame


def _encode_frame(frame: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".jpg", frame)
    if not ok:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Receive browser frames and return detections with optional preview frame."""
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_text()
            payload = json.loads(message)
            if payload.get("type") != "frame":
                continue

            frame_data = payload.get("data", "")
            frame = _decode_frame(frame_data)
            detections = _detector.detect(frame)
            annotated = _detector.draw_detections(frame, detections)

            await websocket.send_json(
                {
                    "type": "result",
                    "detections": detections,
                    "annotated": _encode_frame(annotated),
                }
            )
    except (WebSocketDisconnect, ValueError, json.JSONDecodeError):
        await websocket.close()
