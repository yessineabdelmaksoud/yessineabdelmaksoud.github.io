// Hero particle field: scattered points (raw data) assemble into a sphere
// around the portrait, then unroll into a flowing wave as the page scrolls.
import * as THREE from 'three';

const canvas = document.querySelector('.field');
const hero = document.querySelector('.hero');
const portrait = document.querySelector('.portrait picture');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  renderer = null;
}

if (renderer) {
  const small = matchMedia('(max-width: 700px)').matches;
  const COUNT = small ? 1800 : 3600;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 14;

  const scatter = new Float32Array(COUNT * 3);
  const sphere = new Float32Array(COUNT * 3);
  const wave = new Float32Array(COUNT * 3);
  const rand = new Float32Array(COUNT);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    // Even points on a unit sphere (Fibonacci lattice)
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    sphere.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
    rand[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geometry.setAttribute('aWave', new THREE.BufferAttribute(wave, 3));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

  const uniforms = {
    uTime: { value: 0 },
    uLoad: { value: reduce ? 1 : 0 },
    uScroll: { value: 0 },
    uCenter: { value: new THREE.Vector2() },
    uR: { value: 2 },
    uPointer: { value: new THREE.Vector2() },
    uSize: { value: small ? 4.2 : 3.6 },
    uPR: { value: 1 },
    uA: { value: new THREE.Color() },
    uB: { value: new THREE.Color() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aSphere;
      attribute vec3 aScatter;
      attribute vec3 aWave;
      attribute float aRand;
      uniform float uTime, uLoad, uScroll, uR, uSize, uPR;
      uniform vec2 uCenter, uPointer;
      varying float vRand;
      varying float vAlpha;

      mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

      void main() {
        float l = clamp((uLoad - aRand * 0.45) / 0.55, 0.0, 1.0);
        l = l * l * (3.0 - 2.0 * l);

        vec3 u = aSphere;
        u.xz = rot(uTime * 0.12 + uPointer.x * 0.7) * u.xz;
        u.yz = rot(0.35 + uPointer.y * 0.45) * u.yz;
        float breathe = sin(aRand * 40.0 + uTime * 1.3) * 0.035;
        vec3 sp = u * uR * (1.0 + breathe) + vec3(uCenter, 0.0);

        vec3 sc = aScatter + vec3(sin(uTime * 0.3 + aRand * 20.0), cos(uTime * 0.25 + aRand * 30.0), 0.0) * 0.18;
        vec3 p = mix(sc, sp, l);

        vec3 w = aWave;
        w.y += sin(w.x * 0.7 + uTime * 0.8) * 0.28 + cos(w.z * 0.9 + uTime * 0.6) * 0.2;
        float s = clamp((uScroll - aRand * 0.3) / 0.7, 0.0, 1.0);
        s = s * s * (3.0 - 2.0 * s);
        p = mix(p, w, s);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.7 + aRand * 0.9) * (14.0 / -mv.z);

        float front = mix(0.3, 1.0, (u.z + 1.0) * 0.5);
        vAlpha = mix(0.55, front, l * (1.0 - s)) * (1.0 - s * 0.6);
        vRand = aRand;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uA, uB;
      varying float vRand;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.28, d);
        vec3 col = vRand > 0.88 ? uB : uA;
        gl_FragColor = vec4(col, a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    uniforms.uA.value.set(css.getPropertyValue('--accent').trim());
    uniforms.uB.value.set(css.getPropertyValue('--olive').trim());
  }
  readColors();
  addEventListener('themechange', () => { readColors(); if (!running) render(); });

  let w = 0, h = 0, visW = 0, visH = 0;
  function layout() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    const pr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    uniforms.uPR.value = pr;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    const perPx = visH / h;

    // Sphere sits behind the portrait
    const c = canvas.getBoundingClientRect();
    const p = portrait.getBoundingClientRect();
    const cx = p.left + p.width / 2 - c.left;
    const cy = p.top + p.height / 2 - c.top;
    uniforms.uCenter.value.set((cx - w / 2) * perPx, -(cy - h / 2) * perPx);
    uniforms.uR.value = p.width * (w < 960 ? 0.72 : 0.8) * perPx;

    const cols = Math.ceil(Math.sqrt(COUNT * 2.2));
    for (let i = 0; i < COUNT; i++) {
      scatter.set([
        (Math.random() - 0.5) * visW * 1.1,
        (Math.random() - 0.5) * visH * 1.1,
        (Math.random() - 0.5) * 6,
      ], i * 3);
      const gx = i % cols, gz = Math.floor(i / cols);
      wave.set([
        (gx / cols - 0.5) * visW * 1.3,
        -visH * 0.42,
        -6 + gz * (8 / (COUNT / cols)),
      ], i * 3);
    }
    geometry.attributes.aScatter.needsUpdate = true;
    geometry.attributes.aWave.needsUpdate = true;
  }

  const pointer = new THREE.Vector2();
  if (!reduce) {
    addEventListener('pointermove', (e) => {
      pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    }, { passive: true });
  }

  function render() { renderer.render(scene, camera); }

  const clock = new THREE.Clock();
  let running = false, visible = true, start = null;
  function frame() {
    if (!running) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    if (start === null) start = t;
    uniforms.uLoad.value = Math.min((t - start) / 2.6, 1);
    uniforms.uScroll.value = THREE.MathUtils.clamp(scrollY / (hero.offsetHeight * 0.85), 0, 1);
    uniforms.uPointer.value.lerp(pointer, 0.05);
    render();
    requestAnimationFrame(frame);
  }
  function play() {
    if (reduce || running || !visible || document.hidden) return;
    running = true;
    clock.start();
    clock.elapsedTime = uniforms.uTime.value;
    requestAnimationFrame(frame);
  }
  function pause() { running = false; clock.stop(); }

  layout();
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (!running) render(); }, 120);
  });
  document.fonts?.ready.then(() => { layout(); if (!running) render(); });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? play() : pause();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  if (reduce) render(); else play();
}
