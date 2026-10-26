#!/usr/bin/env python3
"""Keep newly published article markup consistent before audio generation."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"
AUDIO = ROOT / "audio"
STYLE = '<link rel="stylesheet" href="../assets/clanek.css">'
PLAYER = '<script src="../assets/prehravac.js" defer></script>'
AUDIO_BOX = re.compile(r'<div\b[^>]*class="[^"]*\barticle-audio\b[^"]*"[^>]*>.*?</div>', re.I | re.S)
AUDIO_SRC = re.compile(r'<audio\b[^>]*\bsrc="([^"]+)"', re.I | re.S)


def prepare(source: str, stem: str) -> str:
    if 'clanek.css' not in source and '</head>' in source:
        source = source.replace('</head>', STYLE + '</head>', 1)
    if 'prehravac.js' not in source and '</body>' in source:
        source = source.replace('</body>', PLAYER + '</body>', 1)

    expected = f'../audio/{stem}.mp3'

    def keep_only_current(match: re.Match[str]) -> str:
        audio = AUDIO_SRC.search(match.group())
        if audio and audio.group(1).split('?', 1)[0] == expected and (AUDIO / f'{stem}.mp3').is_file():
            return match.group()
        return ''

    return AUDIO_BOX.sub(keep_only_current, source)


def main() -> None:
    changed = 0
    for page in sorted(BLOG.glob('*.html')):
        if page.name == 'index.html':
            continue
        original = page.read_text(encoding='utf-8')
        updated = prepare(original, page.stem)
        if updated != original:
            page.write_text(updated, encoding='utf-8')
            changed += 1
    print(f'Prepared {changed} article pages.')


if __name__ == '__main__':
    main()
