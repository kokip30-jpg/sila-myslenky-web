// Ovládání 3D cesty, které funguje i bez WebGL: aktivní kapitola, ukazatel zastávek a záložní pozadí.
(() => {
  document.querySelectorAll('.journey').forEach(root => {
    const chapters = [...root.querySelectorAll('.chapter')], rail = [...root.querySelectorAll('.journey-rail a')];
    const update = () => {
      const mid = innerHeight * .5;
      let active = -1;
      chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); if (r.top < mid && r.bottom > mid * .6) active = i; });
      const past = chapters.length && chapters.at(-1).getBoundingClientRect().bottom < mid;
      chapters.forEach((c, i) => c.classList.toggle('on', i === active));
      rail.forEach((a, i) => { a.classList.toggle('on', i === active); a.classList.toggle('done', i < active || past); });
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    // když se 3D scéna nenačte (bez WebGL, zablokovaná knihovna), zůstane klidné statické pozadí
    setTimeout(() => { if (!window.__cesta) root.classList.add('no-webgl'); }, 5000);
  });
})();
