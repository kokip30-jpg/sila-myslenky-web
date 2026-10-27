// Jemný zvuk k 3D cestě: noční vítr, tichý tón a cinknutí na zastávkách. Všechno se skládá
// přímo v prohlížeči (Web Audio), nic se nestahuje. Je vypnutý, dokud ho člověk sám nezapne.
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const track = (name, params) => { try { window.smTrack?.(name, params); } catch (e) {} };
  // pentatonika od A: každá zastávka zní o kus výš, svítání nejjasněji
  const BELLS = [440, 493.88, 554.37, 659.25, 739.99];

  document.querySelectorAll('.journey').forEach(root => {
    const stage = root.querySelector('.journey-stage');
    if (!stage) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'journey-sound';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<i aria-hidden="true"><b></b><b></b><b></b></i><span>Zvuk cesty</span>';
    btn.setAttribute('aria-label', 'Zapnout jemný zvuk cesty');
    stage.append(btn);

    let ctx = null, master, wind, windGain, drone, droneGain, glow, on = false, visible = true, raf = 0;

    function build() {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

      // vítr: hnědý šum přes pásmovou propust, která se pomalu přelévá
      const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      wind = ctx.createBiquadFilter(); wind.type = 'bandpass'; wind.frequency.value = 380; wind.Q.value = .7;
      windGain = ctx.createGain(); windGain.gain.value = .5;
      const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
      lfo.frequency.value = .07; lfoAmt.gain.value = 160; lfo.connect(lfoAmt).connect(wind.frequency);
      noise.connect(wind).connect(windGain).connect(master);
      noise.start(); lfo.start();

      // tichý tón pod tím: kvinta A–E, k svítání přibude světlejší tercie
      droneGain = ctx.createGain(); droneGain.gain.value = .06;
      drone = ctx.createBiquadFilter(); drone.type = 'lowpass'; drone.frequency.value = 500;
      droneGain.connect(drone).connect(master);
      [110, 164.81, 110.4].forEach(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(droneGain); o.start(); });
      glow = ctx.createGain(); glow.gain.value = 0; glow.connect(drone);
      const third = ctx.createOscillator(); third.type = 'triangle'; third.frequency.value = 277.18; third.connect(glow); third.start();
    }

    // podle toho, kde na cestě člověk je, se vítr utiší a tón rozjasní
    function follow() {
      raf = requestAnimationFrame(follow);
      if (!ctx) return;
      const st = root.journeyState || { t: 0, f: 0 }, t = Math.min(1, st.t + st.f * .3), now = ctx.currentTime;
      windGain.gain.setTargetAtTime(.55 - t * .35, now, .4);
      drone.frequency.setTargetAtTime(420 + t * 900, now, .5);
      glow.gain.setTargetAtTime(t > .6 ? (t - .6) * .1 : 0, now, .8);
    }

    function bell(i) {
      if (!on || !ctx || !visible) return;
      const now = ctx.currentTime, f = BELLS[i] || BELLS[0];
      [[f, .12], [f * 2.01, .035], [f * 3.02, .012]].forEach(([freq, vol]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .02); g.gain.exponentialRampToValueAtTime(.0001, now + 3.2);
        o.connect(g).connect(master); o.start(now); o.stop(now + 3.3);
      });
    }

    function level() {
      if (!ctx) return;
      const target = on && visible && !document.hidden ? .5 : 0;
      master.gain.setTargetAtTime(target, ctx.currentTime, target ? .8 : .25);
    }

    btn.addEventListener('click', () => {
      on = !on;
      if (on && !ctx) build();
      if (on) { ctx.resume(); if (!raf) follow(); }
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Vypnout zvuk cesty' : 'Zapnout jemný zvuk cesty');
      btn.querySelector('span').textContent = on ? 'Zvuk zapnutý' : 'Zvuk cesty';
      level();
      if (!on) setTimeout(() => { if (!on && ctx) { ctx.suspend(); cancelAnimationFrame(raf); raf = 0; } }, 900);
      track('journey_sound', { on });
    });
    root.addEventListener('journey:stop', e => bell(e.detail.i));
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; level(); }).observe(root);
    document.addEventListener('visibilitychange', level);
  });
})();
