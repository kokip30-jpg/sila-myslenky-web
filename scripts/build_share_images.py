#!/usr/bin/env python3
"""Vytvoří obrázky ke sdílení pro každý článek a karty pro Instagram.

- media/og/<slug>.jpg            1200 × 630, náhled na Facebooku, WhatsAppu, Messengeru
- media/instagram/<slug>-1.jpg   1080 × 1350, titulní karta s nadpisem
- media/instagram/<slug>-2.jpg   1080 × 1350, citát z článku

Vizuál navazuje na úvodní stránku: noční švestkové pozadí a koule ze světelných částic.
Hotové obrázky se nepřegenerují (pro přegenerování všech: --force). Článkům, které
ještě sdílejí výchozí obrázek, nastaví og:image na vlastní. Potřebuje Pillow.
"""
from __future__ import annotations

import hashlib
import html
import math
import random
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / 'blog'
OG_DIR = ROOT / 'media' / 'og'
IG_DIR = ROOT / 'media' / 'instagram'
FONTS = Path(__file__).resolve().parent / 'fonts'
SITE = 'https://sila-myslenky.com/'
DEFAULT_OG = 'media/og-sila-myslenky-v1.png'

INK = (243, 233, 226)
MUTED = (201, 193, 216)
ROSE = (232, 180, 184)
GOLD = (243, 215, 154)
PALETTE = [(168, 148, 245), (250, 158, 184), (255, 204, 122), (255, 237, 214)]


def font(name: str, size: int, **axes: float) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS / name), size)
    if axes:
        order = {'Optical Size': 'opsz', 'Weight': 'wght', 'Softness': 'SOFT', 'Wonky': 'WONK'}
        values = []
        for axis in f.get_variation_axes():
            key = order.get(axis['name'].decode() if isinstance(axis['name'], bytes) else axis['name'])
            values.append(axes.get(key, axis['default']))
        f.set_variation_by_axes(values)
    return f


def serif(size: int, weight: int = 300, italic: bool = False) -> ImageFont.FreeTypeFont:
    return font('Fraunces-Italic.ttf' if italic else 'Fraunces.ttf', size, opsz=min(144, size), wght=weight, SOFT=50, WONK=0)


def sans(size: int, weight: int = 500) -> ImageFont.FreeTypeFont:
    return font('Figtree.ttf', size, wght=weight)


def plain(markup: str) -> str:
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', ' ', markup)).split())


def wrap(text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, line = [], ''
    for word in text.split():
        test = f'{line} {word}'.strip()
        if f.getlength(test) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def fit(text: str, width: int, max_lines: int, sizes: range, **kw) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    for size in sizes:
        f = serif(size, **kw)
        lines = wrap(text, f, width)
        if len(lines) <= max_lines:
            return f, lines
    f = serif(sizes[-1], **kw)
    lines = wrap(text, f, width)[:max_lines]
    lines[-1] = lines[-1].rstrip(',.;:') + '…'
    return f, lines


def background(w: int, h: int, cx: float, cy: float, r: float, seed: str) -> Image.Image:
    """Noční pozadí s koulí ze světelných částic (jako v hero na úvodní stránce)."""
    img = Image.new('RGB', (w, h), (22, 20, 42))
    glow = Image.new('RGB', (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for k in range(40, 0, -1):                      # měkká radiální záře
        t = k / 40
        col = tuple(int(a * (1 - t) + b * t) for a, b in zip((86, 62, 118), (22, 20, 42)))
        gd.ellipse([cx - r * 3 * t, cy - r * 3 * t, cx + r * 3 * t, cy + r * 3 * t], fill=col)
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(r * .5)), .9)

    rnd = random.Random(int(hashlib.md5(seed.encode()).hexdigest()[:8], 16))
    dots = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for _ in range(int(w * h / 900)):                # rozptýlené „myšlenky" v pozadí
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        s = rnd.uniform(.6, 1.8)
        c = rnd.choice(PALETTE)
        dd.ellipse([x - s, y - s, x + s, y + s], fill=(*c, rnd.randint(40, 120)))
    for _ in range(2600):                            # koule
        u, th = rnd.uniform(-1, 1), rnd.uniform(0, 2 * math.pi)
        rr = r * (1 + rnd.uniform(-.03, .03)) if rnd.random() < .7 else r * rnd.random() ** (1 / 3) * .95
        q = math.sqrt(1 - u * u)
        x, y, z = cx + q * math.cos(th) * rr, cy + u * rr, q * math.sin(th)
        s = rnd.uniform(.7, 2.4) * (1 + .25 * z)
        c = rnd.choice(PALETTE)
        dd.ellipse([x - s, y - s, x + s, y + s], fill=(*c, int(110 + 110 * (z + 1) / 2)))
    halo = dots.filter(ImageFilter.GaussianBlur(3))
    img = img.convert('RGBA')
    img.alpha_composite(halo)
    img.alpha_composite(dots)
    core = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse([cx - r * .55, cy - r * .55, cx + r * .55, cy + r * .55], fill=(255, 226, 190, 70))
    img.alpha_composite(core.filter(ImageFilter.GaussianBlur(r * .35)))
    return img


def shade_left(img: Image.Image, until: float) -> Image.Image:
    """Ztmaví levou stranu, aby text zůstal čitelný."""
    w, h = img.size
    mask = Image.linear_gradient('L').rotate(90, expand=True).resize((w, h))
    mask = mask.point(lambda v: int(max(0, min(255, (v / 255 - (1 - until)) / until * 210))))
    dark = Image.new('RGBA', (w, h), (22, 20, 42, 255))
    dark.putalpha(mask)
    img.alpha_composite(dark)
    return img


def kicker(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, size: int) -> None:
    f = sans(size, 600)
    draw.line([x, y + size * .6, x + size * 2.2, y + size * .6], fill=ROSE, width=2)
    draw.text((x + size * 2.9, y), text.upper()[:48], font=f, fill=ROSE, spacing=0)


def og_image(a: dict, out: Path) -> None:
    w, h = 1200, 630
    img = shade_left(background(w, h, 905, 315, 210, a['slug']), .75)
    d = ImageDraw.Draw(img)
    kicker(d, 72, 92, a['tag'] or 'Síla myšlenky', 19)
    f, lines = fit(a['title'], 640, 4, range(68, 38, -2))
    y = 150
    for line in lines:
        d.text((72, y), line, font=f, fill=INK)
        y += int(f.size * 1.08)
    d.line([72, h - 112, 132, h - 112], fill=GOLD, width=2)
    d.text((72, h - 96), 'Síla myšlenky', font=serif(30, 400), fill=INK)
    d.text((72, h - 56), 'sila-myslenky.com', font=sans(20, 500), fill=MUTED)
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)


def ig_cover(a: dict, out: Path) -> None:
    w, h = 1080, 1350
    img = background(w, h, 770, 360, 250, a['slug'] + '1')
    shade = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([0, 560, w, h], fill=(22, 20, 42, 150))
    img.alpha_composite(shade.filter(ImageFilter.GaussianBlur(120)))
    d = ImageDraw.Draw(img)
    kicker(d, 84, 690, a['tag'] or 'Síla myšlenky', 24)
    f, lines = fit(a['title'], 900, 5, range(96, 54, -3))
    y = 750
    for line in lines:
        d.text((84, y), line, font=f, fill=INK)
        y += int(f.size * 1.06)
    d.text((84, h - 120), 'Síla myšlenky', font=serif(36, 400), fill=INK)
    d.text((84, h - 74), '@sila_myslenky_', font=sans(26, 500), fill=MUTED)
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)


def ig_quote(a: dict, out: Path) -> None:
    w, h = 1080, 1350
    img = background(w, h, 540, 1720, 420, a['slug'] + '2')
    shade = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([0, h - 220, w, h], fill=(22, 20, 42, 170))
    img.alpha_composite(shade.filter(ImageFilter.GaussianBlur(60)))
    d = ImageDraw.Draw(img)
    d.text((78, 60), '„', font=serif(240, 300, italic=True), fill=GOLD)
    f, lines = fit(a['quote'], 900, 8, range(64, 38, -2), italic=True)
    y = 430
    for line in lines:
        d.text((84, y), line, font=f, fill=INK)
        y += int(f.size * 1.32)
    d.line([84, y + 40, 150, y + 40], fill=GOLD, width=3)
    d.text((84, y + 64), a['title'], font=sans(26, 500), fill=MUTED) if len(a['title']) < 60 else None
    d.text((84, h - 120), 'Celý text najdeš na sila-myslenky.com', font=sans(26, 500), fill=MUTED)
    d.text((84, h - 74), '@sila_myslenky_', font=sans(26, 600), fill=ROSE)
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)


def quote_of(source: str) -> str:
    """Citát pro Instagram: zvýrazněný citát z článku, jinak první dvě věty úvodu."""
    m = re.search(r'<div\b[^>]*class="[^"]*\bquote\b[^"]*"[^>]*>(.*?)</div>', source, re.I | re.S)
    if m:
        return plain(m.group(1)).strip('„“"')
    m = re.search(r'<p\b[^>]*class="[^"]*\blead\b[^"]*"[^>]*>(.*?)</p>', source, re.I | re.S)
    text = plain(m.group(1)) if m else ''
    sentences = re.split(r'(?<=[.!?])\s+', text)
    out = ''
    for s in sentences:
        if len(out) + len(s) > 190 and out:
            break
        out = f'{out} {s}'.strip()
    return out


def article(page: Path) -> dict | None:
    source = page.read_text(encoding='utf-8')
    title = re.search(r'<h1\b[^>]*>(.*?)</h1>', source, re.I | re.S)
    if not title:
        return None
    tag = re.search(r'<(?:div|p)\b[^>]*class="[^"]*(?:eyebrow|tag)[^"]*"[^>]*>(.*?)</(?:div|p)>', source, re.I | re.S)
    return {'slug': page.stem, 'title': plain(title.group(1)), 'tag': plain(tag.group(1)) if tag else '',
            'quote': quote_of(source), 'source': source, 'page': page}


def point_og(a: dict) -> None:
    """Nastaví článku vlastní obrázek ke sdílení, pokud zatím používá výchozí."""
    src = a['source']
    if DEFAULT_OG not in src:
        return
    url = f'{SITE}media/og/{a["slug"]}.jpg'
    src = src.replace(f'{SITE}{DEFAULT_OG}', url)
    src = re.sub(r'(<meta\b[^>]*og:image:width"[^>]*content=")\d+', r'\g<1>1200', src)
    src = re.sub(r'(<meta\b[^>]*og:image:height"[^>]*content=")\d+', r'\g<1>630', src)
    alt = html.escape(a['title'], quote=True)
    src = re.sub(r'(<meta\b[^>]*og:image:alt"[^>]*content=")[^"]*', lambda m: m.group(1) + alt, src)
    a['page'].write_text(src, encoding='utf-8', newline='')


def main() -> None:
    force = '--force' in sys.argv
    OG_DIR.mkdir(parents=True, exist_ok=True)
    IG_DIR.mkdir(parents=True, exist_ok=True)
    made = 0
    for page in sorted(BLOG.glob('*.html')):
        if page.name == 'index.html':
            continue
        a = article(page)
        if not a:
            continue
        targets = [(OG_DIR / f'{a["slug"]}.jpg', og_image), (IG_DIR / f'{a["slug"]}-1.jpg', ig_cover)]
        if a['quote']:
            targets.append((IG_DIR / f'{a["slug"]}-2.jpg', ig_quote))
        for out, make in targets:
            if force or not out.exists():
                make(a, out)
                made += 1
        point_og(a)
    print(f'Share images created: {made}')


if __name__ == '__main__':
    main()
