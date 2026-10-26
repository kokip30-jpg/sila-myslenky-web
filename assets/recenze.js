// Ohlasy čtenářů z data/recenze.json. Vykreslí se do prvků [data-recenze="slug"]
// (slug produktu, "web" nebo prázdné = všechny). Bez ohlasů zůstane sekce skrytá.
(() => {
  const boxes = document.querySelectorAll('[data-recenze]');
  if (!boxes.length) return;
  const url = new URL('../data/recenze.json', document.currentScript.src);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  fetch(url, { cache: 'no-store' }).then(r => r.json()).then(({ recenze = [] }) => {
    boxes.forEach(box => {
      const slug = box.dataset.recenze;
      const list = recenze.filter(r => r.text && (!slug || r.produkt === slug));
      const target = box.querySelector('.reviews') || box;
      if (!list.length) return;
      target.innerHTML = list.slice(0, 6).map(r => `
        <figure class="review">
          <blockquote>„${esc(r.text)}"</blockquote>
          <figcaption>${esc(r.jmeno || 'Anonymně')}${r.zdroj ? ` · ${esc(r.zdroj)}` : ''}</figcaption>
        </figure>`).join('');
      box.hidden = false;
    });
  }).catch(() => {});
})();
