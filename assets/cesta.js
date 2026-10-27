// „Cesta zpátky k sobě": 3D krajina, kterou se při posouvání stránky prochází po svítící stezce.
// Krajina vzniká z kódu (šum + údolí vyhloubené podél stezky), takže nejsou potřeba žádné 3D modely.
// Pět zastávek odpovídá kapitolám (.chapter) uvnitř .journey; nebe cestou přechází z noci do svítání.
// Používá ho cesta.html i úvodní stránka; styly jsou v assets/cesta.css, ovládání bez 3D v assets/cesta-ui.js.
import * as THREE from 'three';

const root = document.querySelector('.journey');
const stage = root.querySelector('.journey-stage');
const canvas = root.querySelector('.journey-canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = innerWidth < 760 || Math.min(innerWidth, innerHeight) < 600;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('no-webgl');
  throw e;
}
window.__cesta = true;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(small ? 62 : 52, 1, 0.5, 2600);

/* ---------- pomocné funkce: náhoda se semínkem, Perlinův šum ---------- */
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = mulberry(20261027);
const P = new Uint8Array(512);
{
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < 512; i++) P[i] = a[i & 255];
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;
const grad = (h, x, y) => { const u = h & 1 ? x : -x, v = h & 2 ? y : -y; return h & 4 ? u + v * .5 : u * .5 + v; };
function perlin(x, y) {
  const fx = Math.floor(x), fy = Math.floor(y), X = fx & 255, Y = fy & 255;
  x -= fx; y -= fy;
  const u = fade(x), v = fade(y), a = P[X] + Y, b = P[X + 1] + Y;
  return mix(mix(grad(P[a], x, y), grad(P[b], x - 1, y), u), mix(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v);
}
const fbm = (x, y, oct = 5) => { let s = 0, amp = .5, f = 1; for (let i = 0; i < oct; i++) { s += amp * perlin(x * f, y * f); f *= 2; amp *= .5; } return s; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- stezka v půdorysu a zastávky ---------- */
const ground = new THREE.CatmullRomCurve3(
  [[-6, 178], [24, 130], [-16, 84], [28, 34], [-12, -14], [20, -60], [-4, -104], [4, -142]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false, 'centripetal');
const SAMPLES = 320;
const samples = ground.getSpacedPoints(SAMPLES);
function nearest(x, z) {
  let best = Infinity, bi = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const dx = x - samples[i].x, dz = z - samples[i].z, d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return [Math.sqrt(best), bi / SAMPLES];
}
const STOPS = [0.075, 0.29, 0.5, 0.715, 0.99];          // I Ticho … V Nový začátek
const NAMES = [['I', 'Ticho'], ['II', 'Stesk'], ['III', 'Jasno'], ['IV', 'Návrat k sobě'], ['V', 'Nový začátek']];
const summit = ground.getPointAt(1);
const lakeAt = ground.getPointAt(STOPS[1]);
const lakeSide = ground.getTangentAt(STOPS[1]).cross(new THREE.Vector3(0, 1, 0)).normalize();
const lake = lakeAt.clone().addScaledVector(lakeSide, 17);

/* ---------- výška terénu ---------- */
function height(x, z) {
  const [d, t] = nearest(x, z);
  const ridge = 1 - Math.abs(perlin(x * .012 + 3.1, z * .012 - 1.7));
  let hills = 10 + (fbm(x * .011, z * .011) * .5 + .5) * 34 + ridge * ridge * 30;
  hills += Math.max(0, 60 - z) * .07;                    // krajina stoupá k vrcholu
  const floor = 1.5 + fbm(x * .04, z * .04, 3) * 1.5 + t * t * 18;   // dno údolí stoupá spolu se stezkou
  let h = floor + (hills - floor) * smooth(12, 70 + 10 * t, d);
  const ds = Math.hypot(x - summit.x, z - summit.z);
  h += 54 * Math.exp(-(ds * ds) / (2 * 28 * 28));        // vrchol
  const dl = Math.hypot(x - lake.x, z - lake.z);
  h -= 8 * Math.exp(-(dl * dl) / (2 * 14 * 14));          // jezero u druhé zastávky
  return h;
}

/* ---------- terén ---------- */
const SIZE = 780, SEG = small ? 170 : 270;
const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
terrainGeo.rotateX(-Math.PI / 2);
terrainGeo.translate(0, 0, 15);
const tp = terrainGeo.attributes.position;
let minY = Infinity, maxY = -Infinity;
for (let i = 0; i < tp.count; i++) {
  const y = height(tp.getX(i), tp.getZ(i));
  tp.setY(i, y);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const PALETTE = [[0, '#2a2147'], [.18, '#382c60'], [.38, '#4a3b78'], [.58, '#62508f'], [.76, '#9583bd'], [.9, '#d2bfdc'], [1, '#f6e8ef']].map(([s, c]) => [s, new THREE.Color(c)]);
const colorAt = (v, out) => {
  for (let i = 1; i < PALETTE.length; i++) {
    if (v <= PALETTE[i][0]) return out.copy(PALETTE[i - 1][1]).lerp(PALETTE[i][1], (v - PALETTE[i - 1][0]) / (PALETTE[i][0] - PALETTE[i - 1][0]));
  }
  return out.copy(PALETTE.at(-1)[1]);
};
const colors = new Float32Array(tp.count * 3), c = new THREE.Color();
for (let i = 0; i < tp.count; i++) {
  const v = Math.min(1, Math.max(0, (tp.getY(i) - minY) / (maxY - minY) + (rnd() - .5) * .05));
  colorAt(v, c).multiplyScalar(.82 + .36 * (fbm(tp.getX(i) * .03, tp.getZ(i) * .03, 3) * .5 + .5));   // kresba v terénu
  c.toArray(colors, i * 3);
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 })));

/* ---------- jezero ---------- */
const waterY = height(lake.x, lake.z) + 2.6;
const water = new THREE.Mesh(new THREE.CircleGeometry(20, 64), new THREE.MeshPhongMaterial({ color: 0x17132e, specular: 0xd8c8ff, shininess: 140, transparent: true, opacity: .93 }));
water.rotation.x = -Math.PI / 2;
water.position.set(lake.x, waterY, lake.z);
scene.add(water);

/* ---------- textura záře pro světla a částice ---------- */
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,235,200,.55)'); r.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
})();
const glow = (color, opacity = 1) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));

/* ---------- stezka ve 3D ---------- */
const path = new THREE.CatmullRomCurve3(Array.from({ length: 401 }, (_, i) => {
  const p = ground.getPointAt(i / 400);
  return new THREE.Vector3(p.x, height(p.x, p.z) + .6, p.z);
}));
const TUBE_SEG = 900, RADIAL = 6;
const trailDim = new THREE.Mesh(new THREE.TubeGeometry(path, TUBE_SEG, .16, RADIAL), new THREE.MeshBasicMaterial({ color: 0xc9b6ff, transparent: true, opacity: .22, fog: true }));
const trailLit = new THREE.Mesh(new THREE.TubeGeometry(path, TUBE_SEG, .14, RADIAL), new THREE.MeshBasicMaterial({ color: 0xffd98f, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
const trailHalo = new THREE.Mesh(new THREE.TubeGeometry(path, TUBE_SEG, .45, RADIAL), new THREE.MeshBasicMaterial({ color: 0xffb870, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
scene.add(trailDim, trailLit, trailHalo);
const reveal = t => { const n = Math.max(0, Math.min(TUBE_SEG, Math.round(t * TUBE_SEG))) * RADIAL * 6; trailLit.geometry.setDrawRange(0, n); trailHalo.geometry.setDrawRange(0, n); };

/* ---------- zastávky: světla, paprsky, štítky ---------- */
const markersEl = root.querySelector('.journey-markers');
const stations = STOPS.map((s, k) => {
  const p = path.getPointAt(s);
  const orb = glow(0xffd590, .95); orb.scale.setScalar(6); orb.position.copy(p).add(new THREE.Vector3(0, 3.4, 0));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 70, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd590, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  beam.position.copy(p).add(new THREE.Vector3(0, 36, 0));
  scene.add(orb, beam);
  const el = document.createElement('div');
  el.className = 'marker';
  el.innerHTML = `<b>${NAMES[k][0]}</b><span>${NAMES[k][1]}</span>`;
  markersEl.append(el);
  return { orb, beam, el, at: p.clone().add(new THREE.Vector3(0, 10, 0)) };
});

/* ---------- poutník: světlo, které jde po stezce ---------- */
const walker = glow(0xffe2a8, .8); walker.scale.setScalar(1.3); scene.add(walker);
const lantern = new THREE.PointLight(0xffc98a, 22, 40, 1.4); scene.add(lantern);

/* ---------- nebe, hvězdy, měsíc ---------- */
const NIGHT = { top: new THREE.Color('#0a0920'), horizon: new THREE.Color('#3b2d66') };
const DAWN = { top: new THREE.Color('#2f2a66'), horizon: new THREE.Color('#f2a98f') };
const sunDir = summit.clone().sub(ground.getPointAt(0)).setY(0).normalize().setY(.1).normalize();
const skyUniforms = { uTop: { value: NIGHT.top.clone() }, uHorizon: { value: NIGHT.horizon.clone() }, uSunDir: { value: sunDir }, uSun: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uTop, uHorizon, uSunDir; uniform float uSun; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHorizon, uTop, pow(smoothstep(-.04, .65, h), .75));
      float s = max(dot(d, uSunDir), 0.);
      col += vec3(1., .78, .52) * pow(s, 60.) * uSun * 1.6 + vec3(1., .6, .45) * pow(s, 5.) * uSun * .45;
      gl_FragColor = vec4(col, 1.); }`
}));
const skyGroup = new THREE.Group(); skyGroup.add(sky); scene.add(skyGroup);
const starGeo = new THREE.BufferGeometry(), starPos = [];
for (let i = 0; i < (small ? 900 : 1800); i++) {
  const u = rnd() * .95 + .05, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
  starPos.push(Math.cos(th) * q * 2000, u * 2000, Math.sin(th) * q * 2000);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf3ecff, size: small ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: .9, depthWrite: false, fog: false }));
skyGroup.add(stars);
const moon = glow(0xe9e4ff, .9); moon.scale.setScalar(150);
moon.position.set(-.55, .42, -.3).normalize().multiplyScalar(1900); skyGroup.add(moon);

/* ---------- mlha nad údolím (první dvě zastávky) ---------- */
const mistTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
})();
const mists = Array.from({ length: small ? 16 : 30 }, () => {
  const t = rnd() * .55, p = path.getPointAt(t), side = (rnd() - .5) * 60;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xb9a8e6, transparent: true, opacity: .2, depthWrite: false }));
  s.position.set(p.x + side, p.y + 2 + rnd() * 5, p.z + (rnd() - .5) * 20);
  s.scale.set(50 + rnd() * 40, 14 + rnd() * 10, 1);
  scene.add(s);
  return s;
});

/* ---------- světlušky (myšlenky) podél stezky ---------- */
const FLY = small ? 260 : 520;
const flyGeo = new THREE.BufferGeometry(), flyPos = new Float32Array(FLY * 3), flyRand = new Float32Array(FLY * 2);
for (let i = 0; i < FLY; i++) {
  const p = path.getPointAt(rnd()), side = (rnd() - .5) * 40;
  flyPos.set([p.x + side, p.y + 1 + rnd() * 9, p.z + (rnd() - .5) * 26], i * 3);
  flyRand.set([rnd(), rnd()], i * 2);
}
flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
flyGeo.setAttribute('aRand', new THREE.BufferAttribute(flyRand, 2));
const flyUniforms = { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } };
scene.add(new THREE.Points(flyGeo, new THREE.ShaderMaterial({
  uniforms: flyUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `uniform float uTime, uPR; attribute vec2 aRand; varying vec3 vCol; varying float vA;
    void main(){ vec3 p = position; float ph = aRand.x * 6.283;
      p.y += sin(uTime * .7 + ph) * .7; p.x += cos(uTime * .45 + ph) * .6;
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = (14. + 26. * aRand.y) * uPR / -mv.z * 6.;
      vCol = aRand.y < .5 ? vec3(1., .82, .5) : (aRand.y < .8 ? vec3(.98, .64, .74) : vec3(.72, .64, 1.));
      vA = (.55 + .45 * sin(uTime * 2. + ph * 3.)) * smoothstep(320., 30., -mv.z); }`,
  fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = pow(smoothstep(.5, 0., d), 1.6) * vA; gl_FragColor = vec4(vCol * a, a); }'
})));

/* ---------- světla ---------- */
const hemi = new THREE.HemisphereLight(0x8a7cd6, 0x140f26, .55);
const moonLight = new THREE.DirectionalLight(0xc9c0ff, 2.6); moonLight.position.set(-170, 95, 30);
const sunLight = new THREE.DirectionalLight(0xffae86, 0); sunLight.position.copy(sunDir).multiplyScalar(400);
scene.add(hemi, moonLight, sunLight);
scene.fog = new THREE.FogExp2(NIGHT.horizon.clone(), .0068);

/* ---------- posouvání stránky → pozice na stezce ---------- */
const chapters = [...root.querySelectorAll('.chapter')];
const finale = root.querySelector('.journey-finale');
const docTop = el => el.getBoundingClientRect().top + scrollY;   // poloha v dokumentu, ať cesta může být kdekoli na stránce
let keys = [];
function buildKeys() {
  const vh = innerHeight;
  keys = [[docTop(root), 0, 0, 1]];                           // úvod: záběr z výšky přes celé údolí
  chapters.forEach((ch, k) => {
    keys.push([docTop(ch) - vh * .25, STOPS[k] - .012, 0, 0]);
    keys.push([docTop(ch) + ch.offsetHeight - vh * 1.05, Math.min(1, STOPS[k] + .018), 0, 0]);
  });
  keys.push([docTop(finale) - vh * .4, 1, 0, 0]);
  keys.push([docTop(finale) + finale.offsetHeight - vh, 1, 1, 0]);
}
function targetAt(y) {
  if (y <= keys[0][0]) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (y <= keys[i][0]) {
      const [y0, t0, f0, o0] = keys[i - 1], [y1, t1, f1, o1] = keys[i];
      const e = smooth(0, 1, (y - y0) / Math.max(1, y1 - y0));
      return [y, mix(t0, t1, e), mix(f0, f1, e), mix(o0, o1, e)];
    }
  }
  return keys.at(-1);
}

/* ---------- rozměry ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  buildKeys();
}
addEventListener('resize', resize);
resize();
document.fonts?.ready.then(buildKeys);

const pointer = new THREE.Vector2();
addEventListener('pointermove', e => pointer.set(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5), { passive: true });

/* ---------- smyčka ---------- */
const state = { t: 0, f: 0, o: 1 };
const overviewPos = new THREE.Vector3(150, 140, 250), overviewLook = new THREE.Vector3(small ? -10 : -125, small ? 10 : -8, small ? 10 : 50);
const camPos = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const startView = path.getPointAt(.4);
const summitTop = path.getPointAt(1);
let first = true, last = 0;

let onScreen = true;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(root);   // mimo cestu nekreslíme
function frame(now) {
  if (!onScreen && !first) { requestAnimationFrame(frame); return; }
  const [, tt, ff, oo] = targetAt(scrollY);
  const dt = Math.min(.1, (now - last) / 1000 || .016); last = now;
  const k = first || reduce ? 1 : 1 - Math.exp(-dt * 3.2);   // plynulost podle času, ne podle počtu snímků
  state.t += (tt - state.t) * k;
  state.f += (ff - state.f) * k;
  state.o += (oo - state.o) * k;
  const t = Math.min(.999, Math.max(0, state.t)), f = state.f, o = state.o;

  // kamera za poutníkem, na konci vystoupá a ohlédne se po celé cestě
  const p = path.getPointAt(t), ahead = path.getPointAt(Math.min(1, t + .05)), far = path.getPointAt(Math.min(1, t + .11));
  const behind = path.getPointAt(Math.max(0, t - .045));       // kamera jde po stezce za poutníkem, ne rovně za ním
  camPos.copy(behind).add(up.clone().multiplyScalar(10 + 8 * smooth(.85, 1, t)));
  if (t < .045) camPos.addScaledVector(tmp.copy(ahead).sub(p).normalize(), -22 * (1 - t / .045));
  look.copy(far).add(new THREE.Vector3(0, 9, 0));               // dopředu k obzoru, ať jsou vidět hory i nebe
  const sunView = summitTop.clone().addScaledVector(sunDir, 300).setY(summitTop.y + 30);
  look.lerp(sunView, smooth(.93, 1, t) * (1 - f));
  if (f > 0) {
    const back = summitTop.clone().add(new THREE.Vector3(0, 55, 0)).addScaledVector(sunDir, 45);
    camPos.lerp(back, f);
    look.lerp(startView, f);
  }
  if (o > .001) { camPos.lerp(overviewPos, o); look.lerp(overviewLook, o); }
  camPos.y = Math.max(camPos.y, height(camPos.x, camPos.z) + 7);   // nikdy pod terén
  look.x += pointer.x * 6; look.y -= pointer.y * 3;
  if (first) { camera.position.copy(camPos); lookNow.copy(look); first = false; }
  camera.position.lerp(camPos, reduce ? 1 : 1 - Math.exp(-dt * 6));
  lookNow.lerp(look, reduce ? 1 : 1 - Math.exp(-dt * 5));
  camera.lookAt(lookNow);

  // poutník a rozsvícená část stezky
  const wp = path.getPointAt(Math.min(1, t + .01));
  walker.position.copy(wp).add(new THREE.Vector3(0, 1.3, 0));
  lantern.position.copy(walker.position).add(new THREE.Vector3(0, 2, 0));
  reveal(Math.min(1, t + .01 + f));

  // noc → svítání
  const dawn = Math.max(smooth(.6, .99, t), f);
  skyUniforms.uTop.value.copy(NIGHT.top).lerp(DAWN.top, dawn);
  skyUniforms.uHorizon.value.copy(NIGHT.horizon).lerp(DAWN.horizon, dawn);
  skyUniforms.uSun.value = dawn;
  scene.fog.color.copy(skyUniforms.uHorizon.value).multiplyScalar(.82);
  scene.fog.density = mix(.0068, .0034, smooth(.33, .58, t)) * (1 - .35 * dawn) * (1 - .55 * o);
  stars.material.opacity = .9 * (1 - dawn);
  moon.material.opacity = .9 * (1 - dawn);
  sunLight.intensity = 2.2 * dawn;
  moonLight.intensity = 2.6 * (1 - dawn * .7);
  hemi.color.set(0x8a7cd6).lerp(new THREE.Color(0xffc6b0), dawn * .6);
  hemi.intensity = .75 + 1.1 * smooth(.32, .6, t);           // od Jasna se krajina rozjasňuje
  renderer.toneMappingExposure = 1.05 + .2 * dawn;
  const mistA = .2 * (1 - smooth(.32, .52, t));
  mists.forEach(m => { m.material.opacity = mistA; });
  skyGroup.position.copy(camera.position);

  // zastávky: aktivní svítí víc, štítky sledují světla
  const w = stage.clientWidth, h = stage.clientHeight;
  stations.forEach((s, i) => {
    const near = 1 - smooth(.0, .06, Math.abs(t - STOPS[i]));
    s.orb.scale.setScalar(6 + near * 3 + Math.sin(now * .003 + i) * .4 * near);
    s.beam.material.opacity = .05 + .25 * (1 - near);          // zdálky maják, zblízka nesmí rušit
    const v = s.at.clone().project(camera);
    const dist = camera.position.distanceTo(s.at);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    const ahead = STOPS[i] >= t - .02 ? 1 - smooth(.14, .3, STOPS[i] - t) : 0;   // jen zastávky před námi
    const relevant = Math.max(small ? 0 : o, ahead * smooth(18, 40, dist)) * (small ? 1 - o : 1);   // na mobilu v úvodu bez štítků, ať nepřekrývají nadpis
    s.el.style.opacity = visible ? String(Math.max(0, 1 - smooth(300, 420, dist)) * relevant * (1 - f * .5)) : '0';
    if (visible) s.el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, -100%)`;
  });

  flyUniforms.uTime.value = reduce ? 0 : now / 1000;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
