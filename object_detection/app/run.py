"""Command line entrypoint for web/camera/screen object detection modes."""

from __future__ import annotations

import argparse

import uvicorn

from .cli_capture import run_camera, run_screen
from .detector import Detector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Object detection scaffold runner")
    parser.add_argument("--source", choices=["camera", "screen", "web"], default="web")
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model path/name")
    parser.add_argument(
        "--conf", type=float, default=0.25, help="Detection confidence threshold"
    )
    parser.add_argument(
        "--monitor-index",
        type=int,
        default=1,
        help="Screen monitor index for screen mode",
    )
    parser.add_argument(
        "--host", default="0.0.0.0", help="Web server host for web mode"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Web server port for web mode"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    detector = Detector(model_path=args.model, conf=args.conf)

    if args.source == "camera":
        run_camera(detector)
    elif args.source == "screen":
        run_screen(detector, monitor_index=args.monitor_index)
    else:
        uvicorn.run("app.main:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
