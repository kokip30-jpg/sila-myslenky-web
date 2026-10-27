#!/usr/bin/env python3
"""Ikony aplikace (PWA) a favicon: zářivá koule na nočním švestkovém pozadí. Potřebuje Pillow."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'icons'
BG = (35, 29, 60)


def orb(size: int, inset: float, rounded: bool) -> Image.Image:
    s = size * 4                                   # kreslíme větší a zmenšíme kvůli hladkým hranám
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * .22), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)
    c, r = s / 2, s * (.5 - inset)
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([c - r * 1.25, c - r * 1.25, c + r * 1.25, c + r * 1.25], fill=(168, 140, 230, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(r * .35)))
    body = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    steps = 60
    for k in range(steps, 0, -1):                   # radiální přechod: zlatobílý střed → růžová → lila okraj
        t = k / steps
        if t > .55:
            a, b, u = (250, 158, 184), (150, 128, 225), (t - .55) / .45
        else:
            a, b, u = (255, 236, 205), (250, 158, 184), t / .55
        col = tuple(int(a[i] * (1 - u) + b[i] * u) for i in range(3))
        bd.ellipse([c - r * t, c - r * t, c + r * t, c + r * t], fill=(*col, 255))
    img.alpha_composite(body)
    if rounded:
        mask = Image.new('L', (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * .22), fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    orb(192, .2, True).save(OUT / 'icon-192.png', optimize=True)
    orb(512, .2, True).save(OUT / 'icon-512.png', optimize=True)
    orb(512, .3, False).save(OUT / 'icon-maskable-512.png', optimize=True)   # bezpečná zóna pro Android
    orb(180, .2, False).convert('RGB').save(OUT / 'apple-touch-icon.png', optimize=True)
    orb(48, .18, True).save(OUT / 'favicon-48.png', optimize=True)
    print('Icons written to assets/icons/')


if __name__ == '__main__':
    main()
