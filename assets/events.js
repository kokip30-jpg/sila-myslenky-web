// Události pro Google Analytics 4 (posílají se jen se souhlasem, viz analytics.js) a Cloudflare Zaraz.
// Žádné texty, které lidé píšou, se neodesílají, jen to, na co klikli a odkud.
(function(){
  const track=(name,properties={})=>{try{if(window.zaraz&&typeof window.zaraz.track==='function')window.zaraz.track(name,properties);if(typeof window.trackAnalytics==='function')window.trackAnalytics(name,properties)}catch(e){}};
  window.smTrack=track;

  // Odkud na stránce klik přišel: data-place, jinak id sekce, menu nebo článek.
  const place=el=>{
    const marked=el.closest('[data-place]');if(marked)return marked.dataset.place;
    if(el.closest('header,nav,.mobile-menu'))return 'menu';
    if(el.closest('.hero,.hero-stage'))return 'hero';
    if(el.closest('.sm-checklist-box'))return 'clanek-box';
    const sec=el.closest('section[id],div[id]');if(sec)return sec.id;
    if(el.closest('article'))return 'clanek';
    return location.pathname.replace(/^\/|\.html$/g,'')||'uvod';
  };
  const productOf=(link,href)=>{
    const page=href.match(/produkty\/([a-z0-9-]+)\.html/);if(page)return page[1];
    return link.closest('.item,.card,.tile,.path-card')?.querySelector('h2,h3,b')?.textContent.trim()||'publication';
  };

  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(link){
      const href=link.href||'';
      if(/koki-p30\.systeme\.io\/checklist/.test(href))track('checklist_click',{place:place(link)});
      else if(/form\.simpleshop\.cz|payhip\.com|koki-p30\.systeme\.io\/e-book/.test(href))track('product_click',{product:productOf(link,href),place:place(link)});
      else if(/\/produkty\/[a-z0-9-]+\.html/.test(href))track('product_view',{product:productOf(link,href),place:place(link)});
      else if(/\/kviz\.html/.test(href)&&!/\/kviz\.html/.test(location.pathname))track('quiz_open',{place:place(link)});
      else if(/\/muj-prostor\.html/.test(href))track('space_open',{place:place(link)});
      if(link.closest('.ask-chips'))track('search_topic',{topic:link.textContent.trim().slice(0,40)});
    }
    const share=event.target.closest('[data-share],[data-native-share],[data-whatsapp],[data-copy-link]');
    if(share)track('article_share',{method:share.textContent.trim().slice(0,40)});
  });
  document.addEventListener('submit',event=>{if(event.target.matches('.ask'))track('search_submit',{place:place(event.target)})});
  document.addEventListener('play',event=>{if(event.target.matches('audio'))track('article_audio_play',{article:document.querySelector('h1')?.textContent.trim()||document.title})},true);

  let sent=false;addEventListener('scroll',()=>{if(sent)return;const d=document.documentElement;const progress=d.scrollTop/Math.max(1,d.scrollHeight-d.clientHeight);if(progress>=.75){sent=true;track('scroll_75',{page:location.pathname})}},{passive:true});

  // Web jako aplikace
  addEventListener('appinstalled',()=>track('pwa_installed',{}));
  try{if((matchMedia('(display-mode: standalone)').matches||navigator.standalone)&&!sessionStorage.getItem('sm-app-open')){sessionStorage.setItem('sm-app-open','1');track('app_open',{page:location.pathname})}}catch(e){}
})();
