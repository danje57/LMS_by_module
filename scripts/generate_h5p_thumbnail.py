#!/usr/bin/env python3
"""Extract a thumbnail from an H5P file (zip archive).
- For image-based H5P (Course Presentation): uses first content image.
- For video-based H5P (InteractiveVideo): extracts a frame via ffmpeg.
Usage: python3 generate_h5p_thumbnail.py <h5p_path> <output_path>
Outputs JSON to stdout: {"ok": true} or {"error": "..."}
"""

import sys
import json
import zipfile
import subprocess
import tempfile
import os
from io import BytesIO
from pathlib import Path


IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp")
VID_EXTS = (".mp4", ".webm", ".mov")


def get_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def find_content_image(zf: zipfile.ZipFile) -> bytes | None:
    names = zf.namelist()

    # Exact paths for PPTX-converted H5P (Course Presentation)
    for candidate in ["content/images/slide_1.png", "content/images/slide_1.jpg"]:
        if candidate in names:
            return zf.read(candidate)

    # First image in content/images/ (alphabetical), skip tiny icons < 5KB
    folder_imgs = sorted(
        n for n in names
        if n.startswith("content/images/") and n.lower().endswith(IMG_EXTS)
    )
    for img in folder_imgs:
        if zf.getinfo(img).file_size >= 5000:
            return zf.read(img)

    # First image directly in content/ (no sub-folder)
    root_imgs = sorted(
        n for n in names
        if n.startswith("content/") and n.lower().endswith(IMG_EXTS)
        and n.count("/") == 1 and zf.getinfo(n).file_size >= 5000
    )
    if root_imgs:
        return zf.read(root_imgs[0])

    return None


def find_content_video(zf: zipfile.ZipFile) -> str | None:
    """Returns the zip entry name of the first video in content/."""
    names = zf.namelist()
    videos = [
        n for n in names
        if n.startswith("content/") and n.lower().endswith(VID_EXTS)
    ]
    return videos[0] if videos else None


def thumbnail_from_image(img_data: bytes, output_path: str) -> bool:
    from PIL import Image
    with Image.open(BytesIO(img_data)) as img:
        img.thumbnail((800, 450), Image.LANCZOS)
        img.convert("RGB").save(output_path, "JPEG", quality=85, optimize=True)
    return True


def thumbnail_from_video_entry(zf: zipfile.ZipFile, video_entry: str, output_path: str) -> bool:
    ffmpeg = get_ffmpeg()
    with tempfile.NamedTemporaryFile(suffix=Path(video_entry).suffix, delete=False) as tmp:
        tmp.write(zf.read(video_entry))
        tmp_path = tmp.name
    try:
        for seek in ["2", "0"]:
            r = subprocess.run(
                [ffmpeg, "-y", "-ss", seek, "-i", tmp_path,
                 "-vframes", "1", "-vf", "scale=800:-2", "-q:v", "3", output_path],
                capture_output=True, timeout=60,
            )
            if Path(output_path).exists():
                return True
        return False
    finally:
        os.unlink(tmp_path)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: script <h5p_path> <output_path>"}))
        sys.exit(1)

    h5p_path, output_path = sys.argv[1], sys.argv[2]

    try:
        with zipfile.ZipFile(h5p_path, "r") as zf:
            img_data = find_content_image(zf)
            if img_data:
                thumbnail_from_image(img_data, output_path)
            else:
                video_entry = find_content_video(zf)
                if not video_entry:
                    print(json.dumps({"error": "no usable image or video in H5P"}))
                    sys.exit(1)
                if not thumbnail_from_video_entry(zf, video_entry, output_path):
                    print(json.dumps({"error": "ffmpeg failed to extract frame"}))
                    sys.exit(1)

        print(json.dumps({"ok": True}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
