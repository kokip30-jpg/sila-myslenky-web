#!/usr/bin/env python3
"""Keep newly published article markup consistent before audio generation."""
from __future__ import annotations

import html
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"
AUDIO = ROOT / "audio"
ASSETS = ROOT / "assets"
STYLE = '<link rel="stylesheet" href="../assets/clanek.css">'
APP = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#1C1B33"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">'
PLAYER = '<script src="../assets/prehravac.js" defer></script>'
AUDIO_BOX = re.compile(r'<div\b[^>]*class="[^"]*\barticle-audio\b[^"]*"[^>]*>.*?</div>', re.I | re.S)
AUDIO_SRC = re.compile(r'<audio\b[^>]*\bsrc="([^"]+)"', re.I | re.S)
IMAGE = re.compile(r'assets/([A-Za-z0-9_/-]+)\.(?:png|jpe?g)')
DESC_LEN = 160

# Úvodní obraz článku je snímek ze 3D cesty (cesta.html), ze zastávky, ke které článek patří.
STOPS = {'ticho': ('I', 'Ticho'), 'stesk': ('II', 'Stesk'), 'jasno': ('III', 'Jasno'),
         'navrat': ('IV', 'Návrat k sobě'), 'zacatek': ('V', 'Nový začátek')}
OLD_COVER = re.compile(r'<div\b[^>]*class="[^"]*\barticle-cover\b[^"]*"[^>]*>\s*</div>', re.I)
CESTA_COVER = re.compile(r'<a\b[^>]*class="cesta-cover"[^>]*>.*?</a>', re.I | re.S)
# série na blogu (štítek nad nadpisem) → zastávka na cestě
SERIES = [('navrat k sobe', 'zacatek'), ('samota', 'navrat'), ('duvera v sebe', 'navrat'),
          ('sebeucta', 'jasno'), ('hranice', 'jasno'), ('vzpominky', 'stesk'), ('smutek', 'stesk'), ('pustit', 'ticho')]
# slova v nadpisu, která článek posunou na konkrétní zastávku i uvnitř série
TITLE_WORDS = [(('napsat', 'ozval', 'stysk', 'chce vratit', 'vzpomin', 'hezk'), 'stesk'),
               (('signal', 'hranic', 'manipul'), 'jasno'), (('samot',), 'navrat')]


def plain(markup: str) -> str:
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', ' ', markup)).split())


def fold(value: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if unicodedata.category(c) != 'Mn' and c.isalnum())


def summary(source: str) -> str:
    """Úvodní odstavec článku zkrácený na celé slovo, vhodný pro popisek ve vyhledávání a při sdílení."""
    match = (re.search(r'<p\b[^>]*class="[^"]*\blead\b[^"]*"[^>]*>(.*?)</p>', source, re.I | re.S)
             or re.search(r'<article\b.*?<p\b[^>]*>(.*?)</p>', source, re.I | re.S))
    text = plain(match.group(1)) if match else ''
    if len(text) <= DESC_LEN:
        return text
    cut = text[:DESC_LEN].rsplit(' ', 1)[0].rstrip(',;:–-')
    return cut + '…'


def describe(source: str) -> str:
    """Doplní meta description a nahradí popisky pro sdílení, které jen opakují nadpis."""
    text = summary(source)
    if not text:
        return source
    title = plain(re.search(r'<title>(.*?)</title>', source, re.I | re.S).group(1)) if '<title>' in source else ''
    attr = html.escape(text, quote=True)

    def replace(match: re.Match[str]) -> str:
        current = html.unescape(match.group(2))
        if current and fold(current) not in fold(title):
            return match.group(0)            # ručně napsaný popisek necháme být
        return f'{match.group(1)}{attr}{match.group(3)}'

    source = re.sub(r'(<meta\b[^>]*(?:property|name)="(?:og|twitter):description"[^>]*content=")([^"]*)(")', replace, source)
    if not re.search(r'<meta\b[^>]*name="description"', source):
        source = source.replace('</title>', f'</title><meta name="description" content="{attr}">', 1)
    return source


def webp(source: str) -> str:
    """Obrázky z assets/ přepne na lehčí WebP kopii, pokud existuje (viz scripts/optimize_images.py)."""
    return IMAGE.sub(lambda m: f'assets/{m.group(1)}.webp' if (ASSETS / f'{m.group(1)}.webp').is_file() else m.group(0), source)


def ascii_fold(value: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if unicodedata.category(c) != 'Mn')


def journey_links() -> dict[str, str]:
    """Články, které cesta.html sama ukazuje u některé zastávky, patří právě k ní."""
    page = ROOT / 'cesta.html'
    links: dict[str, str] = {}
    if not page.is_file():
        return links
    for stop, body in re.findall(r'<section\b[^>]*class="chapter"[^>]*id="(\w+)"[^>]*>(.*?)</section>', page.read_text(encoding='utf-8'), re.S):
        for slug in re.findall(r'href="blog/([\w-]+)\.html"', body):
            links.setdefault(slug, stop)
    return links


JOURNEY = journey_links()


def stop_for(source: str, stem: str) -> str:
    if stem in JOURNEY:
        return JOURNEY[stem]
    h1 = re.search(r'<h1\b[^>]*>(.*?)</h1>', source, re.I | re.S)
    title = ascii_fold(plain(h1.group(1))) if h1 else ''
    for words, stop in TITLE_WORDS:
        if any(w in title for w in words):
            return stop
    eyebrow = re.search(r'<article\b[^>]*>\s*<div class="eyebrow">(.*?)</div>', source, re.I | re.S)
    series = ascii_fold(plain(eyebrow.group(1))) if eyebrow else ''
    for words, stop in SERIES:
        if words in series:
            return stop
    return 'ticho'


def cover(source: str, stem: str) -> str:
    """Nahradí starý ilustrační obraz (nebo doplní chybějící) snímkem ze zastávky na cestě."""
    stop = stop_for(source, stem)
    num, name = STOPS[stop]
    tag = (f'<a class="cesta-cover" href="../cesta.html#{stop}" style="--cover:url(../assets/cesta/{stop}.webp)" '
           f'aria-label="Zastávka {num}, {name}: ukázat na cestě zpátky k sobě">'
           f'<span><b>{num}</b>{name}</span><em>Ukázat na cestě →</em></a>')
    if CESTA_COVER.search(source):
        return CESTA_COVER.sub(lambda m: tag, source, count=1)
    if OLD_COVER.search(source):
        return OLD_COVER.sub(lambda m: tag, source, count=1)
    return re.sub(r'(</h1>)', lambda m: m.group(1) + tag, source, count=1, flags=re.I)


def prepare(source: str, stem: str) -> str:
    if 'clanek.css' not in source and '</head>' in source:
        source = source.replace('</head>', STYLE + '</head>', 1)
    if 'manifest.webmanifest' not in source and '</head>' in source:
        source = source.replace('</head>', APP + '</head>', 1)
    if 'prehravac.js' not in source and '</body>' in source:
        source = source.replace('</body>', PLAYER + '</body>', 1)
    source = cover(describe(webp(source)), stem)

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
