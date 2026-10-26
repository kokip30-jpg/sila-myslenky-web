// Vlastní přehrávač pro namluvené články. Nahradí výchozí <audio controls> v .article-audio
// a nabízí window.SMPlayer pro playlist na úvodní stránce. Když MP3 chybí, přehrávač se schová.
(() => {
  if (window.SMPlayer) return;
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  const SPEEDS = [1, 1.25, 1.5, .9];
  const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
  const storedSpeed = () => { try { return +localStorage.getItem('sm-rychlost') || 1; } catch (e) { return 1; } };

  function create(audio, opts = {}) {
    const el = document.createElement('div');
    el.className = 'sm-player';
    el.innerHTML = `
      <button class="sm-play" type="button" aria-label="Přehrát">${ICON_PLAY}</button>
      <div class="sm-body">
        <span class="sm-title"></span>
        <span class="sm-sub">0:00</span>
        <div class="sm-track" role="slider" tabindex="0" aria-label="Pozice v nahrávce" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="sm-fill"></div></div>
      </div>
      <div class="sm-ctrl">
        <button class="sm-skip" type="button" data-skip="-15" aria-label="O 15 sekund zpět">−15</button>
        <button class="sm-skip" type="button" data-skip="15" aria-label="O 15 sekund dál">+15</button>
        <button class="sm-speed" type="button" aria-label="Rychlost přehrávání">1×</button>
      </div>`;
    const play = el.querySelector('.sm-play'), title = el.querySelector('.sm-title'), sub = el.querySelector('.sm-sub');
    const track = el.querySelector('.sm-track'), fill = el.querySelector('.sm-fill'), speed = el.querySelector('.sm-speed');
    const setMeta = (t, s) => { title.textContent = t || 'Poslech článku'; el.dataset.sub = s || ''; update(); };
    function update() {
      const d = audio.duration, c = audio.currentTime || 0, pct = d ? c / d * 100 : 0;
      fill.style.width = pct + '%';
      track.setAttribute('aria-valuenow', Math.round(pct));
      sub.textContent = (el.dataset.sub ? el.dataset.sub + ' · ' : '') + (d ? `${fmt(c)} / ${fmt(d)}` : fmt(c));
    }
    const sync = () => {
      const playing = !audio.paused;
      play.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      play.setAttribute('aria-label', playing ? 'Pozastavit' : 'Přehrát');
    };
    play.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
    el.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime + +b.dataset.skip); }));
    audio.playbackRate = storedSpeed();
    speed.textContent = String(audio.playbackRate).replace('.', ',') + '×';
    speed.addEventListener('click', () => {
      const next = SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length];
      audio.playbackRate = next;
      speed.textContent = String(next).replace('.', ',') + '×';
      try { localStorage.setItem('sm-rychlost', next); } catch (e) {}
    });
    const seek = e => { const r = track.getBoundingClientRect(); if (audio.duration) audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration; };
    track.addEventListener('pointerdown', e => { seek(e); track.setPointerCapture(e.pointerId); });
    track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) seek(e); });
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') audio.currentTime += 5;
      else if (e.key === 'ArrowLeft') audio.currentTime -= 5;
      else return;
      e.preventDefault();
    });
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach(ev => audio.addEventListener(ev, update));
    ['play', 'pause', 'ended'].forEach(ev => audio.addEventListener(ev, sync));
    audio.addEventListener('play', () => {
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: title.textContent, artist: 'Síla myšlenky' });
    });
    setMeta(opts.title, opts.sub);
    return { el, audio, setMeta, update, sync };
  }

  // Článek: <div class="article-audio"><strong>…</strong><audio controls src=…></audio></div>
  function enhanceArticles() {
    document.querySelectorAll('.article-audio audio').forEach(audio => {
      const box = audio.closest('.article-audio');
      if (box.querySelector('.sm-player')) return;
      const hide = () => { box.hidden = true; box.style.display = 'none'; };
      if (audio.error) return hide();
      audio.addEventListener('error', hide);
      const p = create(audio, { title: 'Poslech článku' });
      audio.controls = false;
      audio.hidden = true;
      box.prepend(p.el);
      // když soubor neexistuje, prohlížeč nahlásí chybu až po pokusu o načtení
      audio.preload = 'metadata';
      audio.load();
    });
  }

  window.SMPlayer = { create, fmt };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceArticles);
  else enhanceArticles();
})();
