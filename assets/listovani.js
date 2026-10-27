// 3D listování ukázkou knihy. Použití:
// <div class="flipbook" data-src="../assets/products/ukazka/kniha-{n}.webp" data-count="9" data-title="Ukázka"></div>
// Na počítači se otáčí listy jako v knize (dvojstrana), na mobilu jedna stránka po druhé.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(root) {
    const count = +root.dataset.count, src = n => root.dataset.src.replace('{n}', n);
    const title = root.dataset.title || 'Ukázka';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'kniha');
    root.setAttribute('aria-label', title);
    const book = document.createElement('div');
    book.className = 'fb-book';
    const nav = document.createElement('div');
    nav.className = 'fb-nav';
    nav.innerHTML = `<button type="button" class="fb-prev" aria-label="Předchozí strana">←</button>
      <span class="fb-count" aria-live="polite"></span>
      <button type="button" class="fb-next" aria-label="Další strana">→</button>`;
    root.append(book, nav);
    const counter = nav.querySelector('.fb-count'), prev = nav.querySelector('.fb-prev'), next = nav.querySelector('.fb-next');
    let leaves = [], turned = 0, single = null, swiped = false, active = -1, timer = 0;

    const face = (n, cls) => n && n <= count
      ? `<div class="fb-face ${cls}"><img src="${src(n)}" alt="Strana ${n} z ${count}" loading="lazy" decoding="async"></div>`
      : `<div class="fb-face ${cls} fb-blank"></div>`;

    function build() {
      const wantSingle = root.clientWidth < 560;
      if (wantSingle === single) return;
      single = wantSingle;
      root.classList.toggle('single', single);
      const pairs = single ? Array.from({ length: count }, (_, i) => [i + 1, 0]) : Array.from({ length: Math.ceil(count / 2) }, (_, i) => [2 * i + 1, 2 * i + 2]);
      book.innerHTML = pairs.map(([a, b]) => `<div class="fb-leaf">${face(a, 'fb-front')}${face(b, 'fb-back')}</div>`).join('');
      leaves = [...book.children];
      leaves.forEach(l => l.addEventListener('click', () => {
        if (swiped) { swiped = false; return; }   // klik po tažení prstem už stránku otočil
        l.classList.contains('turned') ? go(-1) : go(1);
      }));
      turned = Math.min(turned, leaves.length - (single ? 1 : 0));
      render();
    }
    function render() {
      leaves.forEach((l, i) => {
        const t = i < turned;
        l.classList.toggle('turned', t);
        l.style.zIndex = i === active ? leaves.length + 2 : t ? i + 1 : leaves.length - i;   // otáčený list je navrchu
      });
      const last = single ? leaves.length - 1 : leaves.length;
      root.classList.toggle('closed', !single && turned === 0);
      root.classList.toggle('end', !single && turned === leaves.length);
      prev.disabled = turned === 0;
      next.disabled = turned >= last;
      if (single) counter.textContent = `Strana ${turned + 1} z ${count}`;
      else {
        const left = turned * 2, right = turned * 2 + 1;
        counter.textContent = turned === 0 ? `Obálka · ${count} stran` : right <= count ? `Strany ${left}–${right} z ${count}` : `Strana ${left} z ${count}`;
      }
    }
    function go(dir) {
      const last = single ? leaves.length - 1 : leaves.length;
      const target = Math.max(0, Math.min(last, turned + dir));
      if (target === turned) return;
      active = dir > 0 ? turned : target;
      turned = target;
      render();
      clearTimeout(timer);
      timer = setTimeout(() => { active = -1; render(); }, reduce ? 0 : 1000);
      window.smTrack?.('sample_page', { title, page: turned });
    }
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    root.tabIndex = 0;
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    });
    let startX = null;
    book.addEventListener('pointerdown', e => { startX = e.clientX; });
    book.addEventListener('pointerup', e => {
      if (startX === null) return;
      const dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) { swiped = true; go(dx < 0 ? 1 : -1); }
    });
    if (reduce) root.classList.add('no-motion');
    build();
    new ResizeObserver(build).observe(root);
  }

  document.querySelectorAll('.flipbook[data-src]').forEach(setup);
})();
