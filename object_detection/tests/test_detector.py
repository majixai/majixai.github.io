import numpy as np
from fastapi.testclient import TestClient

from object_detection.app.detector import Detector
from object_detection.app.main import app


def test_detector_returns_list_for_blank_image() -> None:
    detector = Detector()
    image = np.zeros((64, 64, 3), dtype=np.uint8)
    detections = detector.detect(image)

    assert isinstance(detections, list)
    for detection in detections:
        assert isinstance(detection, dict)
        assert {"x1", "y1", "x2", "y2", "conf", "class"}.issubset(set(detection.keys()))


def test_health_endpoint_returns_200() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json().get("status") == "ok"
