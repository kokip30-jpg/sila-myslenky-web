(function(){
  const track=(name,properties={})=>{try{if(window.zaraz&&typeof window.zaraz.track==='function')window.zaraz.track(name,properties)}catch(e){}};
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const href=link.href||'';if(/form\.simpleshop\.cz|payhip\.com/.test(href))track('product_click',{product:link.closest('.item,.card')?.querySelector('h2,h3')?.textContent.trim()||'publication'});const share=event.target.closest('[data-share],[data-native-share],[data-whatsapp],[data-copy-link]');if(share)track('article_share',{method:share.textContent.trim().slice(0,40)});});
  document.addEventListener('play',event=>{if(event.target.matches('audio'))track('article_audio_play',{article:document.querySelector('h1')?.textContent.trim()||document.title)},true);
  let sent=false;addEventListener('scroll',()=>{if(sent)return;const d=document.documentElement;const progress=d.scrollTop/Math.max(1,d.scrollHeight-d.clientHeight);if(progress>=.75){sent=true;track('scroll_75',{page:location.pathname)}},{passive:true});
})();
