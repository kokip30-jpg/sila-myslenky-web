(() => {
  const article = document.querySelector('main article');
  if (!article || article.querySelector('.sm-checklist-box')) return;
  const category = article.querySelector('.eyebrow, .tag')?.textContent?.trim().toLocaleUpperCase('cs') || '';
  if (!category.includes('PUSTIT') && !category.includes('VZTAHY') && !(category.includes('FÁZE 1') && !category.includes('NÁVRAT'))) return;
  const related = article.querySelector('.related');
  if (!related) return;

  const style = document.createElement('style');
  style.textContent = '.sm-checklist-box{margin:2.5rem 0;padding:1.5rem 1.5rem 1.75rem;border:1px solid #ff4f9a55;border-radius:16px;background:#ff4f9a10;text-align:center}.sm-checklist-box p{margin:0}.sm-checklist-kicker{font:800 .75rem/1.4 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ff9ac6}.sm-checklist-title{margin:.5rem 0!important;font:700 1.55rem/1.2 Arial,sans-serif;color:#f5f0ed}.sm-checklist-text{max-width:34rem;margin:0 auto 1.2rem!important;color:#d8cbd1}.sm-checklist-btn{display:inline-block;padding:.8rem 1.4rem;border-radius:999px;background:#ff4f9a;color:#1b1020!important;text-decoration:none;font:800 .95rem Arial,sans-serif}.sm-checklist-btn:hover,.sm-checklist-btn:focus-visible{background:#ff9ac6}';
  document.head.appendChild(style);
  const box = document.createElement('aside');
  box.className = 'sm-checklist-box';
  box.setAttribute('aria-label', 'Checklist zdarma');
  box.innerHTML = '<p class="sm-checklist-kicker">Checklist zdarma</p><p class="sm-checklist-title">Nejsi si jistá, jestli je to ještě v pořádku?</p><p class="sm-checklist-text">Checklist 15 znaků manipulace ve vztahu ti pomůže to pojmenovat. Projdeš ho za pět minut a pošlu ti ho zdarma e-mailem.</p><a class="sm-checklist-btn" href="https://koki-p30.systeme.io/checklist">Chci checklist</a>';
  related.before(box);
  box.querySelector('a').addEventListener('click', () => window.trackAnalytics?.('checklist_click', {place: 'blog'}));
})();
