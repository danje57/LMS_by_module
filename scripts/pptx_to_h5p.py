#!/usr/bin/env python3
"""
PPTX → H5P.CoursePresentation converter
Usage: python3 pptx_to_h5p.py <input.pptx> <output_dir> <title>
Outputs JSON to stdout: {"slideCount": N, "width": W, "height": H}
"""

import sys
import os
import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path


def convert(pptx_path: str, output_dir: str, title: str) -> dict:
    pptx_path = Path(pptx_path).resolve()
    output_dir = Path(output_dir).resolve()
    images_dir = output_dir / "content" / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        # PPTX → PDF
        r = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf",
             "--outdir", str(tmp), str(pptx_path)],
            capture_output=True, text=True, timeout=180
        )
        pdf_path = tmp / (pptx_path.stem + ".pdf")
        if not pdf_path.exists():
            raise RuntimeError(f"LibreOffice failed: {r.stderr}")

        # PDF → PNG par page (150 dpi = bonne qualité/taille)
        subprocess.run(
            ["pdftoppm", "-r", "150", "-png", str(pdf_path), str(tmp / "slide")],
            capture_output=True, timeout=180
        )

        slides_png = sorted(tmp.glob("slide-*.png"),
                            key=lambda p: int(p.stem.split("-")[-1]))
        if not slides_png:
            raise RuntimeError("Aucune slide générée")

        from PIL import Image
        width, height = 0, 0
        for i, png in enumerate(slides_png, 1):
            with Image.open(png) as img:
                w, h = img.size
                if i == 1:
                    width, height = w, h
            shutil.copy(png, images_dir / f"slide_{i}.png")

    # content.json
    slides = []
    for i in range(1, len(slides_png) + 1):
        slides.append({
            "elements": [{
                "x": 0, "y": 0, "width": 100, "height": 100,
                "action": {
                    "library": "H5P.Image 1.1",
                    "params": {
                        "file": {
                            "path": f"images/slide_{i}.png",
                            "mime": "image/png",
                            "copyright": {"license": "U"},
                            "width": width,
                            "height": height
                        },
                        "decorative": False
                    },
                    "subContentId": str(uuid.uuid4()),
                    "metadata": {
                        "contentType": "Image",
                        "license": "U",
                        "title": f"Slide {i}"
                    }
                },
                "alwaysDisplayComments": False,
                "backgroundOpacity": 0,
                "displayAsButton": False,
                "buttonSize": "big",
                "goToSlideType": "specified",
                "invisible": False,
                "solution": ""
            }],
            "slideBackgroundSelector": {}
        })

    with open(output_dir / "content" / "content.json", "w", encoding="utf-8") as f:
        json.dump({
            "presentation": {
                "slides": slides,
                "globalBackgroundSelector": {},
                "keywordListSettings": {
                    "showKeywordListOnload": False,
                    "hideKeywordListOnPlay": False,
                    "keywordListEnabled": False
                }
            }
        }, f, ensure_ascii=False)

    # h5p.json
    with open(output_dir / "h5p.json", "w", encoding="utf-8") as f:
        json.dump({
            "title": title,
            "language": "und",
            "mainLibrary": "H5P.CoursePresentation",
            "embedTypes": ["div"],
            "license": "U",
            "defaultLanguage": "fr",
            "preloadedDependencies": [
                {"machineName": "H5P.CoursePresentation", "majorVersion": "1", "minorVersion": "25"},
                {"machineName": "FontAwesome",            "majorVersion": "4", "minorVersion": "5"},
                {"machineName": "H5P.FontIcons",          "majorVersion": "1", "minorVersion": "0"},
                {"machineName": "H5P.JoubelUI",           "majorVersion": "1", "minorVersion": "3"},
                {"machineName": "H5P.Transition",         "majorVersion": "1", "minorVersion": "0"},
                {"machineName": "H5P.Image",              "majorVersion": "1", "minorVersion": "1"}
            ]
        }, f, ensure_ascii=False, indent=2)

    return {"slideCount": len(slides_png), "width": width, "height": height}


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: pptx_to_h5p.py <input.pptx> <output_dir> <title>", file=sys.stderr)
        sys.exit(1)
    try:
        result = convert(sys.argv[1], sys.argv[2], sys.argv[3])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
