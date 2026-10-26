#!/usr/bin/env python3
"""Generate sitemap.xml from the pages on disk.

Includes every public page except those marked noindex. Articles use their
dateModified/datePublished; other pages use the date of their last git commit.
"""
from __future__ import annotations

import re
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://sila-myslenky.com/'
SKIP = {'3d-nahled.html'}  # interní náhled


def lastmod(page: Path, source: str) -> str:
    found = re.search(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})', source) or re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', source)
    if found:
        return found.group(1)
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', str(page)], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        if out:
            return out
    except (OSError, subprocess.CalledProcessError):
        pass
    return date.today().isoformat()


def url(page: Path) -> str:
    rel = page.relative_to(ROOT).as_posix()
    return SITE + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)


def main() -> None:
    root_pages = sorted(p for p in ROOT.glob('*.html') if p.name not in SKIP and p.name != 'index.html')
    articles = [p for p in (ROOT / 'blog').glob('*.html') if p.name != 'index.html']
    pages = [ROOT / 'index.html', ROOT / 'blog' / 'index.html', *root_pages, *sorted((ROOT / 'produkty').glob('*.html'))]
    entries = []
    for page in pages + articles:
        source = page.read_text(encoding='utf-8')
        if re.search(r'<meta\b[^>]*name="robots"[^>]*noindex', source, re.I):
            continue
        entries.append((url(page), lastmod(page, source), page in articles))
    # stránky v pevném pořadí, články od nejnovějšího
    entries = [e for e in entries if not e[2]] + sorted((e for e in entries if e[2]), key=lambda e: e[1], reverse=True)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += [f'  <url><loc>{loc}</loc><lastmod>{mod}</lastmod></url>' for loc, mod, _ in entries]
    lines.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
    print(f'sitemap.xml: {len(entries)} URL')


if __name__ == '__main__':
    main()
