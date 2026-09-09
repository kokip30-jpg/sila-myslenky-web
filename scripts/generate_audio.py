#!/usr/bin/env python3
"""Create Czech MP3 narration for blog articles with Azure Speech."""
from __future__ import annotations

import html
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"
AUDIO = ROOT / "audio"
SKIP_CLASSES = {"article-date", "sm-meta", "article-tools", "article-cover", "end", "micro-step", "back", "nav"}

class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack: list[tuple[str, bool]] = []
        self.parts: list[str] = []
        self.current: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        parent_skip = self.stack[-1][1] if self.stack else False
        classes = set(attrs.get("class", "").split())
        skip = parent_skip or tag in {"script", "style", "aside", "audio", "button"} or bool(classes & SKIP_CLASSES)
        self.stack.append((tag, skip))
        if tag in {"h1", "h2", "p", "blockquote"} and not skip:
            self.current = []

    def handle_endtag(self, tag):
        if self.current is not None and tag in {"h1", "h2", "p", "blockquote"}:
            text = " ".join("".join(self.current).split())
            if text and not text.startswith("Je toho na tebe"):
                self.parts.append(text)
            self.current = None
        if self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

def narration(source: str) -> str:
    parser = ArticleText()
    parser.feed(source)
    text = "\n\n".join(parser.parts)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def synthesize(text: str, target: Path) -> None:
    key = os.environ["AZURE_SPEECH_KEY"]
    region = os.environ.get("AZURE_SPEECH_REGION", "eastus")
    ssml = f'''<speak version="1.0" xml:lang="cs-CZ"><voice name="cs-CZ-VlastaNeural"><prosody rate="-5%">{html.escape(text)}</prosody></voice></speak>'''
    request = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "sila-myslenky-audio",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        target.write_bytes(response.read())

def add_player(source: str, audio_url: str) -> str:
    if 'class="article-audio"' in source or "<audio controls" in source:
        return source
    player = f'<div class="article-audio"><strong>Poslech článku</strong><audio controls preload="metadata" src="{audio_url}" aria-label="Poslech článku"></audio></div>'
    source = source.replace("</style>", ".article-audio{margin:22px 0;padding:16px;border:1px solid #ffffff24;border-radius:14px;background:#ffffff08}.article-audio strong{display:block;margin-bottom:9px}.article-audio audio{width:100%}</style>", 1)
    if '<p class="lead"' in source:
        return source.replace('<p class="lead"', player + '<p class="lead"', 1)
    return source.replace("</h1>", "</h1>" + player, 1)

def main() -> int:
    if not os.environ.get("AZURE_SPEECH_KEY"):
        print("AZURE_SPEECH_KEY is not configured", file=sys.stderr)
        return 2
    AUDIO.mkdir(exist_ok=True)
    for page in sorted(BLOG.glob("*.html")):
        source = page.read_text(encoding="utf-8")
        text = narration(source)
        if len(text) < 80:
            print(f"Skipping {page.name}: no article text")
            continue
        mp3 = AUDIO / f"{page.stem}.mp3"
        if not mp3.exists():
            print(f"Creating {mp3.name}")
            synthesize(text, mp3)
        updated = add_player(source, f"../audio/{mp3.name}")
        if updated != source:
            page.write_text(updated, encoding="utf-8")

if __name__ == "__main__":
    raise SystemExit(main())
