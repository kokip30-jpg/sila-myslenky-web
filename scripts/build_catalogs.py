#!/usr/bin/env python3
"""Build the public search index and listening lists from published articles."""
from __future__ import annotations

import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / 'blog'
DATA = ROOT / 'data'
AUDIO = ROOT / 'audio'


def plain(markup: str) -> str:
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', ' ', markup)).split())


def capture(pattern: str, source: str) -> str:
    match = re.search(pattern, source, re.I | re.S)
    return plain(match.group(1)) if match else ''


def fold(value: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if unicodedata.category(c) != 'Mn')


def article(page: Path) -> dict[str, str]:
    source = page.read_text(encoding='utf-8')
    title = capture(r'<h1\b[^>]*>(.*?)</h1>', source)
    if not title:
        raise ValueError(f'Article has no title: {page}')
    description = capture(r'<meta\b[^>]*name="description"[^>]*content="([^"]*)"', source)
    if not description:
        description = capture(r'<p\b[^>]*class="[^"]*\blead\b[^"]*"[^>]*>(.*?)</p>', source)
    category = capture(r'<(?:div|p)\b[^>]*class="[^"]*(?:eyebrow|tag)[^"]*"[^>]*>(.*?)</(?:div|p)>', source)
    date = capture(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"', source)
    if not date:
        date = capture(r'<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"', source)
    headings = [plain(t) for t in re.findall(r'<h2\b[^>]*>(.*?)</h2>', source, re.I | re.S)]
    paragraphs = [plain(t) for t in re.findall(r'<p\b[^>]*>(.*?)</p>', source, re.I | re.S)[:4]]
    keywords = ' '.join([title, description, category, *headings, *paragraphs])[:2500]
    return {'t': title, 'u': f'blog/{page.name}', 'tag': category, 'd': description[:280], 'k': keywords, 'date': date}


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    pages = [p for p in BLOG.glob('*.html') if p.name != 'index.html']
    articles = sorted((article(p) for p in pages), key=lambda item: (item['date'], item['u']), reverse=True)
    write_json(DATA / 'clanky.json', articles)

    available = [a for a in articles if (AUDIO / (Path(a['u']).stem + '.mp3')).is_file()]
    def entry(a: dict[str, str]) -> dict[str, str]:
        stem = Path(a['u']).stem
        return {'t': a['t'], 'u': a['u'], 'a': f'audio/{stem}.mp3'}

    night_words = ('vecer', 'noc', 'ticho', 'samota', 'smutek', 'usnout', 'unava', 'vzpominka')
    night = [a for a in available if any(word in fold(a['t']) for word in night_words)]
    if len(night) < 6:
        night.extend(a for a in available if a not in night)
    playlists = {
        '_poznamka': 'Automaticky sestaveno z článků, ke kterým existuje MP3 v audio/.',
        'nejnovejsi': [entry(a) for a in available[:6]],
        'na-noc': [entry(a) for a in night[:6]],
    }
    write_json(DATA / 'poslech.json', playlists)
    print(f'Indexed {len(articles)} articles; {len(available)} narrated; {len(playlists["na-noc"])} for the night list.')


if __name__ == '__main__':
    main()
