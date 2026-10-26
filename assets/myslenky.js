// „Myšlenky, které se zklidní": tisíce částic víří v chaosu a při posouvání se složí
// do koule, která dýchá v rytmu 4 s nádech / 6 s výdech. Počítá se na GPU (jeden draw call).
import * as THREE from 'three';

const stage = document.getElementById('hero-stage');
const canvas = document.getElementById('thoughts');
const track = document.getElementById('hero-track');
const breathWord = document.getElementById('breath-word');
const breathDot = document.querySelector('.breath i');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth <= 800;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  stage.classList.add('no-webgl');
  throw e;
}
window.__thoughts = true;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
camera.position.set(0, 0, 9);

/* ---------- částice ---------- */
const COUNT = mobile() ? 6500 : 16000;
const chaos = new Float32Array(COUNT * 3);
const calm = new Float32Array(COUNT * 3);
const rand = new Float32Array(COUNT * 4);
for (let i = 0; i < COUNT; i++) {
  chaos[i * 3] = (Math.random() * 2 - 1) * 8.5;
  chaos[i * 3 + 1] = (Math.random() * 2 - 1) * 4.8;
  chaos[i * 3 + 2] = -6 + Math.random() * 8;
  // 70 % na povrchu koule, zbytek uvnitř, aby měla hloubku
  const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
  const r = Math.random() < 0.7 ? 1 + (Math.random() - 0.5) * 0.06 : Math.cbrt(Math.random()) * 0.95;
  calm[i * 3] = sq * Math.cos(th) * r;
  calm[i * 3 + 1] = u * r;
  calm[i * 3 + 2] = sq * Math.sin(th) * r;
  rand[i * 4] = Math.random(); rand[i * 4 + 1] = Math.random(); rand[i * 4 + 2] = Math.random(); rand[i * 4 + 3] = Math.random();
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(chaos, 3));
geo.setAttribute('aCalm', new THREE.BufferAttribute(calm, 3));
geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

const uniforms = {
  uTime: { value: 0 }, uProgress: { value: reduce ? 1 : 0 }, uBreath: { value: 0.5 },
  uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseStr: { value: 0 },
  uCenter: { value: new THREE.Vector3() }, uRadius: { value: 1.7 },
  uSize: { value: 26 }, uPR: { value: renderer.getPixelRatio() }, uMobile: { value: 0 }
};

const material = new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uProgress, uBreath, uMouseStr, uRadius, uSize, uPR, uMobile;
    uniform vec3 uMouse, uCenter;
    attribute vec3 aCalm;
    attribute vec4 aRand;
    varying vec3 vColor;
    varying float vAlpha;

    // 3D simplex šum (Ashima Arts / Stefan Gustavson, MIT)
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

    void main(){
      float t = uTime;
      // chaos: myšlenky unášené proudem
      vec3 c = position;
      c += vec3(snoise(c*.22+vec3(0.,t*.07,0.)), snoise(c*.22+vec3(13.1,t*.07,0.)), snoise(c*.22+vec3(0.,7.7,t*.07))) * 1.5;
      c.xz = rot(t*.03*(.5+aRand.w)) * c.xz;

      // klid: koule, která pomalu rotuje a dýchá
      vec3 s = aCalm;
      s.xz = rot(t*.12) * s.xz;
      s *= uRadius * (1. + uBreath*.14 + snoise(aCalm*1.6+t*.25)*.05);
      s += uCenter;

      float p = smoothstep(aRand.z*.45, aRand.z*.45+.55, uProgress);
      vec3 pos = mix(c, s, p);
      pos.y += sin(p*3.14159) * (aRand.w-.5) * 1.4;      // oblouk cestou do koule

      vec3 d = pos - uMouse;
      pos += normalize(d+1e-4) * uMouseStr * smoothstep(1.8, 0., length(d)) * (1. - .55*p);

      vec4 mv = modelViewMatrix * vec4(pos, 1.);
      gl_Position = projectionMatrix * mv;
      float twinkle = .75 + .25*sin(t*2. + aRand.w*40.);
      gl_PointSize = uSize * (.4 + aRand.x*aRand.x*1.4) * twinkle * uPR / -mv.z * (1. + .35*p*uBreath);

      vec3 lilac = vec3(.66,.58,.96), rose = vec3(.98,.62,.72), gold = vec3(1.,.8,.48), warm = vec3(1.,.93,.84);
      vec3 col = aRand.y < .45 ? lilac : (aRand.y < .8 ? rose : gold);
      vColor = mix(col, mix(gold, warm, .45), p*.5*(.6+.4*uBreath));

      // za textem částice ztlumíme, aby nadpis zůstal čitelný
      vec2 ndc = gl_Position.xy / gl_Position.w;
      float textZone = uMobile > .5 ? smoothstep(.1, -.45, ndc.y) : smoothstep(.05, -.6, ndc.x);
      vAlpha = (.75 + .35*p) * mix(1., .4, textZone);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - .5);
      float a = pow(smoothstep(.5, 0., d), 1.8) * vAlpha;
      gl_FragColor = vec4(vColor * a, a);
    }`
});
const points = new THREE.Points(geo, material);
points.frustumCulled = false;
scene.add(points);

/* ---------- záře uprostřed koule ---------- */
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,236,200,1)'); r.addColorStop(.25, 'rgba(255,190,190,.45)');
  r.addColorStop(.6, 'rgba(160,130,220,.12)'); r.addColorStop(1, 'rgba(160,130,220,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
scene.add(glow);

/* ---------- rozměry a kompozice ---------- */
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const m = mobile();
  uniforms.uMobile.value = m ? 1 : 0;
  // viditelná šířka v rovině z = 0
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, halfW = halfH * camera.aspect;
  if (m) {
    uniforms.uRadius.value = Math.min(1.15, halfW * .56);
    uniforms.uCenter.value.set(0, halfH * .55, 0);
  } else {
    uniforms.uRadius.value = Math.min(1.9, halfH * .48);
    uniforms.uCenter.value.set(halfW * .42, .1, 0);
  }
  uniforms.uSize.value = m ? 34 : 44;
  glow.position.copy(uniforms.uCenter.value);
  glow.scale.setScalar(uniforms.uRadius.value * 3.6);
}
layout();
addEventListener('resize', () => { layout(); if (reduce) render(0); });

/* ---------- myš a dotyk rozvíří myšlenky ---------- */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
let lastMove = 0;
stage.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.copy(hit);
  lastMove = performance.now();
});

/* ---------- scroll a dech ---------- */
let target = reduce ? 1 : 0;
function onScroll() {
  const span = track.offsetHeight - innerHeight;
  target = span > 0 ? Math.min(1, Math.max(0, (scrollY - track.offsetTop) / (span * .8))) : 1;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
let lastWord = '';
const { inhale: IN, exhale: OUT } = window.__breath || { inhale: 4, exhale: 6 };   // v noci 4 + 8 s
function breath(t) {
  const c = (t / 1000) % (IN + OUT);
  const inhale = c < IN;
  const b = inhale ? ease(c / IN) : 1 - ease((c - IN) / OUT);
  const word = inhale ? 'Nádech' : 'Výdech';
  if (word !== lastWord && breathWord) { breathWord.textContent = word; lastWord = word; }
  if (breathDot) breathDot.style.setProperty('--b', (.7 + b * .9).toFixed(3));
  return b;
}

function render(t) {
  const p = uniforms.uProgress.value;
  uniforms.uTime.value = t / 1000;
  uniforms.uBreath.value = reduce ? .5 : breath(t);
  glow.material.opacity = (.12 + p * .55) * (.75 + .25 * uniforms.uBreath.value);
  renderer.render(scene, camera);
}

let visible = true;
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(track);
function loop(t) {
  if (visible) {
    uniforms.uProgress.value += (target - uniforms.uProgress.value) * .045;
    const moving = performance.now() - lastMove < 120;
    uniforms.uMouseStr.value += ((moving ? 1.1 : 0) - uniforms.uMouseStr.value) * .06;
    render(t);
  }
  requestAnimationFrame(loop);
}
if (reduce) render(0);
else requestAnimationFrame(loop);
