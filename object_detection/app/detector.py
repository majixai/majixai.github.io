"""Detector abstractions used by CLI and web inference paths."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


class Detector:
    """Small wrapper around YOLO with a safe fallback stub mode."""

    def __init__(self, model_path: str | None = None, conf: float = 0.25) -> None:
        self.model_path = model_path
        self.conf = conf
        self._model = None
        self._labels: dict[int, str] = {}
        self.using_stub = True

        if model_path:
            try:
                from ultralytics import YOLO

                self._model = YOLO(model_path)
                self._labels = getattr(self._model, "names", {}) or {}
                self.using_stub = False
            except Exception:
                # Keep startup resilient when model/runtime is unavailable.
                self._model = None
                self._labels = {}
                self.using_stub = True

    def detect(self, frame: np.ndarray) -> list[dict[str, Any]]:
        """Run detection and return normalized detection dictionaries."""
        if frame is None or frame.size == 0:
            return []

        if self._model is None:
            return self._stub_detect(frame)

        try:
            results = self._model(frame, verbose=False, conf=self.conf)
        except Exception:
            return self._stub_detect(frame)

        detections: list[dict[str, Any]] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            xyxy = (
                boxes.xyxy.cpu().numpy() if boxes.xyxy is not None else np.empty((0, 4))
            )
            confs = (
                boxes.conf.cpu().numpy() if boxes.conf is not None else np.empty((0,))
            )
            classes = (
                boxes.cls.cpu().numpy() if boxes.cls is not None else np.empty((0,))
            )

            for i, box in enumerate(xyxy):
                cls_id = int(classes[i]) if i < len(classes) else -1
                detections.append(
                    {
                        "x1": float(box[0]),
                        "y1": float(box[1]),
                        "x2": float(box[2]),
                        "y2": float(box[3]),
                        "conf": float(confs[i]) if i < len(confs) else 0.0,
                        "class": cls_id,
                        "label": self._labels.get(cls_id, str(cls_id)),
                    }
                )
        return detections

    def _stub_detect(self, frame: np.ndarray) -> list[dict[str, Any]]:
        """Return a simple bright-region bounding box in fallback mode."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        _, threshold = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(
            threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        detections: list[dict[str, Any]] = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w * h < 64:
                continue
            detections.append(
                {
                    "x1": float(x),
                    "y1": float(y),
                    "x2": float(x + w),
                    "y2": float(y + h),
                    "conf": 0.5,
                    "class": 0,
                    "label": "bright-region",
                }
            )
        return detections

    def draw_detections(
        self,
        frame: np.ndarray,
        detections: list[dict[str, Any]],
        labels: dict[int, str] | None = None,
    ) -> np.ndarray:
        """Draw detections onto a copy of `frame`."""
        rendered = frame.copy()
        label_map = labels or self._labels

        for detection in detections:
            x1 = int(detection.get("x1", 0))
            y1 = int(detection.get("y1", 0))
            x2 = int(detection.get("x2", 0))
            y2 = int(detection.get("y2", 0))
            conf = float(detection.get("conf", 0.0))
            cls_id = int(detection.get("class", -1))
            label = detection.get("label") or label_map.get(cls_id, str(cls_id))

            cv2.rectangle(rendered, (x1, y1), (x2, y2), (0, 255, 0), 2)
            text = f"{label} {conf:.2f}"
            cv2.putText(
                rendered,
                text,
                (x1, max(15, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
            )

        return rendered
