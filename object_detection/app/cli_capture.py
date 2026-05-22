"""CLI camera and screen capture loops with OpenCV preview."""

from __future__ import annotations

import cv2
import numpy as np
from mss import mss

from .detector import Detector


def run_camera(detector: Detector) -> None:
    """Run live camera capture and render detections."""
    capture = cv2.VideoCapture(0)
    if not capture.isOpened():
        raise RuntimeError("Unable to open camera device")

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            detections = detector.detect(frame)
            annotated = detector.draw_detections(frame, detections)
            cv2.imshow("Object Detection - Camera", annotated)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        capture.release()
        cv2.destroyAllWindows()


def run_screen(detector: Detector, monitor_index: int = 1) -> None:
    """Run screen capture loop and render detections."""
    with mss() as sct:
        monitors = sct.monitors
        if monitor_index < 1 or monitor_index >= len(monitors):
            raise ValueError(
                f"Invalid monitor_index={monitor_index}; available 1..{len(monitors)-1}"
            )

        monitor = monitors[monitor_index]

        while True:
            shot = sct.grab(monitor)
            frame = np.array(shot)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            detections = detector.detect(frame)
            annotated = detector.draw_detections(frame, detections)
            cv2.imshow("Object Detection - Screen", annotated)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cv2.destroyAllWindows()
