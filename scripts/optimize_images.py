#!/usr/bin/env python3
"""Create lighter WebP copies of PNG/JPG images in assets/ and point pages at them.

Run locally after adding a new image (needs Pillow: pip install Pillow).
The originals stay in place, so older templates that still use .png keep working;
scripts/prepare_articles.py switches new articles to the WebP copy automatically.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
MAX_WIDTH = 1600
QUALITY = 80
PAGES = [*ROOT.glob('*.html'), *(ROOT / 'blog').glob('*.html'), *(ROOT / 'produkty').glob('*.html'), *ASSETS.glob('*.css')]


def convert(src: Path) -> Path:
    dst = src.with_suffix('.webp')
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    with Image.open(src) as im:
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=QUALITY, method=6)
    print(f'{src.relative_to(ROOT)}: {src.stat().st_size // 1024} kB -> {dst.stat().st_size // 1024} kB')
    return dst


def main() -> None:
    sources = [p for p in [*ASSETS.glob('*'), *(ASSETS / 'products').glob('*')] if p.suffix.lower() in ('.png', '.jpg', '.jpeg')]
    names = {}
    for src in sources:
        dst = convert(src)
        names[src.relative_to(ROOT).as_posix()] = dst.relative_to(ROOT).as_posix()
    pattern = re.compile('|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)))
    changed = 0
    for page in PAGES:
        text = page.read_text(encoding='utf-8')
        updated = pattern.sub(lambda m: names[m.group(0)], text)
        if updated != text:
            page.write_text(updated, encoding='utf-8', newline='')
            changed += 1
    print(f'Updated image references in {changed} files.')


if __name__ == '__main__':
    main()
