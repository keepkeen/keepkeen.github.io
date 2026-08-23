#!/usr/bin/env python3
"""Download open source copies used during the paper audit.

Large PDFs are intentionally excluded from version control.  The script writes a
SHA-256 manifest so another reader can verify that they studied the same files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import ssl
import urllib.request

import yaml


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "sources" / "catalog.yaml"
PDF_DIR = ROOT / "sources" / "pdfs"

PDF_OVERRIDES = {
    6: "https://www.cs.toronto.edu/~hinton/absps/colt93.pdf",
    8: (
        "https://proceedings.neurips.cc/paper_files/paper/2012/file/"
        "c399862d3b9d6b76c8436e924a68c45b-Paper.pdf"
    ),
    25: "https://pdf.stafforini.com/legg-2008-machine-super-intelligence.pdf",
    26: "https://www.lirmm.fr/~ashen/kolmbook-eng-scan.pdf",
}


def pdf_url(item: dict) -> str | None:
    if item["id"] in PDF_OVERRIDES:
        return PDF_OVERRIDES[item["id"]]
    arxiv = item.get("arxiv")
    if arxiv:
        return f"https://arxiv.org/pdf/{arxiv}"
    return None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "ilya30-study/0.1"})
    temporary = target.with_suffix(".part")
    context = ssl.create_default_context()
    try:
        import certifi

        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    with urllib.request.urlopen(request, timeout=90, context=context) as response, temporary.open("wb") as out:
        while block := response.read(1024 * 1024):
            out.write(block)
    temporary.replace(target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", nargs="*", type=int, help="Only fetch these item IDs")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    catalog = yaml.safe_load(CATALOG.read_text())
    selected = set(args.ids or [])
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []

    for item in catalog["items"]:
        if selected and item["id"] not in selected:
            continue
        url = pdf_url(item)
        if not url:
            continue
        target = PDF_DIR / f"{item['id']:02d}-{item['slug']}.pdf"
        if args.force or not target.exists():
            print(f"fetching {item['id']:02d}: {url}")
            try:
                download(url, target)
            except Exception as error:
                print(f"failed {item['id']:02d}: {error}")
                continue
        manifest.append(
            {
                "id": item["id"],
                "file": target.name,
                "source": url,
                "bytes": target.stat().st_size,
                "sha256": sha256(target),
            }
        )

    manifest_path = PDF_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {manifest_path} ({len(manifest)} files)")


if __name__ == "__main__":
    main()
