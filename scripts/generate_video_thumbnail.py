#!/usr/bin/env python3
"""Extract a thumbnail frame from a video file at ~2 seconds.
Usage: python3 generate_video_thumbnail.py <video_path> <output_path>
Outputs JSON to stdout: {"ok": true} or {"error": "..."}
"""

import sys
import subprocess
import json
from pathlib import Path


def get_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def extract(video_path: str, output_path: str) -> bool:
    ffmpeg = get_ffmpeg()
    for seek in ["2", "0"]:
        r = subprocess.run(
            [ffmpeg, "-y", "-ss", seek, "-i", video_path,
             "-vframes", "1", "-vf", "scale=800:-2", "-q:v", "3", output_path],
            capture_output=True, timeout=60,
        )
        if Path(output_path).exists():
            return True
    return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: script <video_path> <output_path>"}))
        sys.exit(1)
    try:
        ok = extract(sys.argv[1], sys.argv[2])
        if ok:
            print(json.dumps({"ok": True}))
        else:
            print(json.dumps({"error": "no frame extracted"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
