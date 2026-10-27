// Ovládání 3D cesty, které funguje i bez WebGL: aktivní kapitola, ukazatel zastávek, „Tady jsi“,
// měření v GA4 a záložní pozadí.
(() => {
  const track = (name, params) => { try { window.smTrack ? window.smTrack(name, params) : window.trackAnalytics?.(name, params); } catch (e) {} };
  const page = location.pathname.endsWith('cesta.html') ? 'cesta' : 'uvod';
  let faze = null;
  try { faze = JSON.parse(localStorage.getItem('sm-faze'))?.id || null; } catch (e) {}

  document.querySelectorAll('.journey').forEach(root => {
    const chapters = [...root.querySelectorAll('.chapter')], rail = [...root.querySelectorAll('.journey-rail a')];
    const intro = root.querySelector('.journey-intro');

    // zastávka, kterou si člověk našel v kvízu
    const here = chapters.find(c => c.id === faze);
    if (here) {
      here.querySelector('.panel')?.insertAdjacentHTML('afterbegin', '<div class="here-badge">Tady teď jsi</div>');
      rail.find(a => a.hash === '#' + faze)?.classList.add('here');
    }

    const seen = new Set();
    let last = -2, completed = false;
    const update = () => {
      const mid = innerHeight * .5;
      let active = -1;
      chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); if (r.top < mid && r.bottom > mid * .6) active = i; });
      const past = chapters.length && chapters.at(-1).getBoundingClientRect().bottom < mid;
      root.classList.toggle('at-intro', !!intro && intro.getBoundingClientRect().bottom > mid);
      chapters.forEach((c, i) => c.classList.toggle('on', i === active));
      rail.forEach((a, i) => { a.classList.toggle('on', i === active); a.classList.toggle('done', i < active || past); });
      if (active !== last) {
        last = active;
        if (active >= 0) {
          const id = chapters[active].id;
          root.dispatchEvent(new CustomEvent('journey:stop', { detail: { i: active, id } }));
          if (!seen.has(id)) { seen.add(id); track('journey_stop', { stop: id, stop_n: active + 1, page, here: id === faze }); }
        }
      }
      if (past && !completed) { completed = true; track('journey_complete', { page, stops_seen: seen.size }); }
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();

    // přeskočení cesty: kde člověk byl, když odešel dolů na web
    root.querySelectorAll('a[href="#obsah"]').forEach(a => a.addEventListener('click', () =>
      track('journey_skip', { page, at: last >= 0 ? chapters[last].id : (completed ? 'konec' : 'uvod'), stops_seen: seen.size })));

    // když se 3D scéna nenačte (bez WebGL, zablokovaná knihovna), zůstane klidné statické pozadí
    setTimeout(() => { if (!window.__cesta) root.classList.add('no-webgl'); }, 5000);
  });
})();
