// The Man Who Sold the Eiffel Tower — 2D cards in a 3D toon world (three.js in HyperFrames)
import * as THREE from './three.module.js';

const W = 1080, H = 1920, FPS = 30, END = 56.89, END_NEW = 58.46;
// new voice time → authored (old) time, piecewise linear between sentence anchors
const WARP = [[0.0, 0.0], [2.4, 2.0], [4.14, 4.02], [5.82, 5.64], [6.64, 6.31], [7.8, 7.62], [10.84, 10.74], [13.26, 13.06], [14.7, 14.36], [16.05, 15.93], [16.62, 16.48], [19.26, 19.28], [21.44, 21.58], [23.04, 22.82], [24.86, 24.64], [26.58, 25.88], [28.43, 27.9], [28.9, 28.35], [29.55, 28.96], [31.08, 30.46], [32.62, 31.94], [34.48, 33.72], [35.52, 34.72], [37.4, 36.46], [40.56, 39.42], [41.66, 40.54], [42.4, 41.22], [44.46, 43.36], [45.26, 44.09], [46.48, 45.34], [49.46, 48.4], [51.44, 49.96], [52.5, 51.02], [54.8, 53.06], [55.6, 53.93], [58.46, 56.89]];
function toOld(tn) { if (tn <= 0) return 0; for (let i = 0; i < WARP.length - 1; i++) { const [a0, b0] = WARP[i], [a1, b1] = WARP[i + 1]; if (tn <= a1) return b0 + (b1 - b0) * (tn - a0) / (a1 - a0); } return WARP[WARP.length - 1][1]; }
const S = H / 1920; // pixel scale

// ---------- seeded random ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = u => u * u * u * (u * (u * 6 - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- renderer & targets ----------
const canvas = document.getElementById('three-layer');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const colorRT = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const normalRT = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H) });
normalRT.depthTexture.type = THREE.UnsignedIntType;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 900);
camera.layers.enable(1);

// ---------- canvas texture helpers ----------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; }
function shade(hex, f) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); }

function cobbleTex(seed, base = '#9c8f7e', w = 512) {
  const c = cv(w, w), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#3d3530'; x.fillRect(0, 0, w, w);
  const n = 12, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const off = (j % 2) * s / 2;
    x.fillStyle = shade(base, (r() - 0.5) * 0.12);
    x.beginPath(); x.roundRect(i * s + off + 3, j * s + 3, s - 6, s - 6, 10); x.fill();
    if (i === 0) { x.beginPath(); x.roundRect(off - s + 3, j * s + 3, s - 6, s - 6, 10); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(i * s + off + 8, j * s + 7, s * 0.4, 4);
  }
  return c;
}
function grassTex(seed) {
  const c = cv(512, 512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#5f9a3e'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? '#6aa845' : '#548c37'; x.beginPath(); x.ellipse(r() * 512, r() * 512, 6 + r() * 14, 3 + r() * 6, r() * 3, 0, 7); x.fill(); }
  return c;
}
function waterTex() {
  const c = cv(512, 512), x = c.getContext('2d'), r = rng(9);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#3f7fc0'); g.addColorStop(1, '#2f69a8');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(220,240,255,0.55)'; x.lineWidth = 4; x.lineCap = 'round';
  for (let i = 0; i < 60; i++) { const px = r() * 512, py = r() * 512, l = 20 + r() * 50; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 5, px + l, py); x.stroke(); }
  return c;
}
function woodTex(base = '#b07a45') {
  const c = cv(256, 256), x = c.getContext('2d'), r = rng(4);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { x.fillStyle = '#2a1a12'; x.fillRect(0, i * 32, 256, 3); for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(70,40,20,0.35)'; x.lineWidth = 2; x.beginPath(); const y = i * 32 + 6 + r() * 22; x.moveTo(0, y); x.bezierCurveTo(80, y + 4, 170, y - 4, 256, y); x.stroke(); } }
  return c;
}
const FACADES = [['#efe2c4', '#2f4a68'], ['#e9d2a8', '#3b2f4f'], ['#e2dccf', '#4a3530'], ['#f0d9c2', '#2d4c3d'], ['#e8cfa9', '#5b2a2a']];
function facadeTex(seed, wall, shop, lit) {
  const c = cv(512, 1024), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = lit ? '#000' : wall; x.fillRect(0, 0, 512, 1024);
  const fl = 6, fh = 1024 / fl;
  for (let f = 0; f < fl; f++) {
    const y0 = 1024 - (f + 1) * fh;
    if (!lit) { x.fillStyle = shade(wall, -0.05); x.fillRect(0, y0 + fh - 8, 512, 8); x.strokeStyle = 'rgba(60,40,30,0.25)'; x.lineWidth = 2; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(0, y0 + k * fh / 4); x.lineTo(512, y0 + k * fh / 4); x.stroke(); } }
    if (f === 0) { // shopfront
      if (!lit) { x.fillStyle = shop; x.fillRect(20, y0 + 30, 472, fh - 30); x.fillStyle = '#1d2a3a'; x.fillRect(50, y0 + 60, 180, fh - 70); x.fillRect(282, y0 + 60, 180, fh - 70); x.fillStyle = '#d8b25a'; x.fillRect(20, y0 + 30, 472, 14); }
      else { x.fillStyle = '#ffcf7a'; x.fillRect(50, y0 + 60, 180, fh - 70); x.fillRect(282, y0 + 60, 180, fh - 70); }
      continue;
    }
    for (let k = 0; k < 2; k++) {
      const wx = 70 + k * 256, wy = y0 + 34, ww = 116, wh = fh - 62;
      const on = r() < 0.55;
      if (!lit) {
        x.fillStyle = shade(wall, -0.12); x.fillRect(wx - 10, wy - 12, ww + 20, 12);
        x.fillStyle = '#2b3a52'; x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(160,190,230,0.35)'; x.fillRect(wx + 8, wy + 8, ww / 2 - 12, wh * 0.5);
        x.strokeStyle = '#f4ecdc'; x.lineWidth = 5; x.strokeRect(wx, wy, ww, wh); x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
        if (f === 2 || f === 5) { x.strokeStyle = '#1b1b1f'; x.lineWidth = 4; x.strokeRect(wx - 14, wy + wh - 40, ww + 28, 40); for (let b = 0; b < 9; b++) { x.beginPath(); x.moveTo(wx - 14 + b * (ww + 28) / 8, wy + wh - 40); x.lineTo(wx - 14 + b * (ww + 28) / 8, wy + wh); x.stroke(); } }
      } else if (on) { x.fillStyle = '#ffd27c'; x.fillRect(wx, wy, ww, wh); x.fillStyle = '#ffeab8'; x.fillRect(wx + 8, wy + 8, ww / 2 - 12, wh * 0.5); }
    }
  }
  return c;
}
function slateTex() {
  const c = cv(256, 256), x = c.getContext('2d'), r = rng(3);
  x.fillStyle = '#5f6f86'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { x.fillStyle = shade('#6c7d95', (r() - 0.5) * 0.08); x.fillRect(i * 16 + (j % 2) * 8, j * 16, 14, 13); }
  return c;
}

// ---------- materials ----------
const mats = {};
function lam(opts) { return new THREE.MeshLambertMaterial(opts); }
mats.cobble = lam({ map: tex(cobbleTex(1), 30, 160) });
mats.quay = lam({ map: tex(cobbleTex(2, '#a9a08f'), 140, 4) });
mats.walk = lam({ map: tex(cobbleTex(5, '#b9ab94'), 4, 40) });
mats.grass = lam({ map: tex(grassTex(2), 160, 160) });
mats.water = lam({ map: tex(waterTex(), 40, 3), emissive: 0x112244, emissiveIntensity: 0.4 });
mats.stone = lam({ color: 0xcfc2a8 });
mats.slate = lam({ map: tex(slateTex(), 6, 2) });
mats.wood = lam({ map: tex(woodTex(), 2, 2) });
mats.cloth = lam({ color: 0xf6f1e6 });
mats.ink = lam({ color: 0x2a2a30 });
mats.green = lam({ color: 0x2f5a3f });
mats.trunk = lam({ color: 0x6b4a2f });
mats.leaf = lam({ color: 0x4f9a3d, flatShading: true });
mats.leaf2 = lam({ color: 0x67ae46, flatShading: true });
mats.iron = lam({ color: 0x8c5a3a });
mats.lamp = lam({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0 });
mats.red = lam({ color: 0xb8322e });
mats.train = lam({ color: 0x2a3d33 });
mats.carriage = lam({ color: 0x7a2630 });
mats.gold = lam({ color: 0xd8b25a });
const nightEmissive = []; // materials whose emissive ramps at night

// ---------- registry ----------
const worldMeshes = [];
function add(mesh, parent = scene) { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); worldMeshes.push(mesh); return mesh; }
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, parent); }
function cyl(rt, rb, h, mat, x, y, z, seg = 16, parent) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return add(m, parent); }
function plane(w, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; scene.add(m); worldMeshes.push(m); return m; }

// ---------- ground ----------
plane(2400, 2400, mats.grass, 0, -0.02, 0);
plane(18, 120, mats.cobble, 0, 0.0, 12);
box(5, 0.18, 120, mats.walk, -11.5, 0.09, 12);
box(5, 0.18, 120, mats.walk, 11.5, 0.09, 12);
plane(500, 8, mats.quay, 0, 0.01, -48);
box(500, 4, 1, mats.stone, 0, -1.7, -52.5);
box(500, 0.7, 0.5, mats.stone, 0, 0.35, -51.8);
plane(900, 22, mats.water, 0, -2.4, -63);
box(500, 4, 1, mats.stone, 0, -1.7, -73.5);
plane(500, 8, mats.quay, 0, 0.01, -78);

// ---------- buildings ----------
const facadeMats = FACADES.map(([w, s], i) => {
  const lit = tex(facadeTex(10 + i, w, s, true));
  const m = lam({ map: tex(facadeTex(10 + i, w, s, false)), emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0 });
  nightEmissive.push(m); return m;
});
function mansard(len, depth, h, parent, x, y, z, rotY) {
  const sh = new THREE.Shape(); const inset = 1.3;
  sh.moveTo(-depth / 2, 0); sh.lineTo(depth / 2, 0); sh.lineTo(depth / 2 - inset, h); sh.lineTo(-depth / 2 + inset, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(g, mats.slate); m.position.set(x, y, z); m.rotation.y = rotY; return add(m, parent);
}
function building(x, z, w, d, h, side, fi, seed) {
  const r = rng(seed);
  const sideMat = lam({ color: FACADES[fi][0] });
  const arr = [sideMat, sideMat, sideMat, sideMat, sideMat, sideMat];
  const face = facadeMats[fi].clone(); face.map = facadeMats[fi].map.clone(); face.map.repeat.set(w / 7, 1); face.emissiveMap = facadeMats[fi].emissiveMap.clone(); face.emissiveMap.repeat.set(w / 7, 1); nightEmissive.push(face);
  arr[side > 0 ? 0 : 1] = face; // side>0 → faces +x
  const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), arr); m.position.set(x, h / 2, z); add(m);
  box(d + 0.6, 0.45, w + 0.2, mats.stone, x, h + 0.2, z);
  mansard(w, d, 3.2 + r() * 0.8, scene, x, h + 0.4, z, 0);
  for (let i = 0; i < 2; i++) { box(0.9, 1.8, 0.7, lam({ color: 0xb06a4e }), x + (r() - 0.5) * d * 0.4, h + 4.0, z + (r() - 0.5) * w * 0.7); }
  for (let i = 0; i < Math.floor(w / 3.5); i++) { const dz = -w / 2 + 1.75 + i * 3.5; const dorm = box(0.9, 1.3, 1.2, mats.stone, x + side * (d / 2 - 1.0), h + 1.9, z + dz); }
}
// left row (faces +x), right row (faces -x)
let seed = 50;
for (let z = 58; z > -38; z -= 12) { building(-20, z, 11.6, 12, 17 + (seed % 3), +1, seed % 5, seed++); }
for (let z = 58; z > 18; z -= 12) { building(20, z, 11.6, 12, 17 + (seed % 3), -1, seed % 5, seed++); }
for (let z = -18; z > -38; z -= 12) { building(20, z, 11.6, 12, 17 + (seed % 3), -1, seed % 5, seed++); }
// distant skyline beyond river (left/right of the tower axis)
{ const r = rng(77); for (let i = 0; i < 26; i++) { const sx = (i < 13 ? -1 : 1) * (60 + r() * 220); const sz = -90 - r() * 120; const hh = 14 + r() * 10; building(sx, sz, 14, 14, hh, sx < 0 ? 1 : -1, i % 5, 300 + i); } }

// hotel (right side, z -8..14)
const hotelFacade = (() => {
  const c = cv(1024, 1024), x = c.getContext('2d');
  x.fillStyle = '#f2e8d4'; x.fillRect(0, 0, 1024, 1024);
  x.fillStyle = '#e4d6bb'; x.fillRect(0, 760, 1024, 264);
  for (let i = 0; i < 9; i++) { const cx = 60 + i * 113; x.fillStyle = '#fbf4e6'; x.fillRect(cx - 18, 230, 36, 520); x.fillStyle = '#d9c9aa'; x.fillRect(cx - 26, 220, 52, 18); x.fillRect(cx - 26, 742, 52, 18); }
  for (let f = 0; f < 3; f++) for (let i = 0; i < 8; i++) { const wx = 85 + i * 113, wy = 270 + f * 160; x.fillStyle = '#2a3a55'; x.fillRect(wx, wy, 64, 110); x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(wx, wy, 64, 110); }
  x.fillStyle = '#d9c9aa'; x.fillRect(0, 190, 1024, 30); x.fillRect(0, 60, 1024, 40);
  x.fillStyle = '#7a2630'; x.fillRect(250, 120, 524, 64); x.fillStyle = '#e8c56a'; x.font = 'bold 44px Georgia, serif'; x.textAlign = 'center'; x.fillText('HÔTEL DE CRILLON', 512, 168);
  for (let i = 0; i < 5; i++) { x.fillStyle = '#7a4a2e'; x.beginPath(); x.roundRect(110 + i * 180, 800, 110, 224, [55, 55, 0, 0]); x.fill(); x.fillStyle = '#e9c98a'; x.beginPath(); x.roundRect(124 + i * 180, 818, 82, 90, [41, 41, 0, 0]); x.fill(); x.strokeStyle = '#3a2618'; x.lineWidth = 6; x.beginPath(); x.moveTo(165 + i * 180, 818); x.lineTo(165 + i * 180, 1024); x.stroke(); }
  return c;
})();
const hotelLit = (() => { const c = cv(1024, 1024), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 1024); for (let f = 0; f < 3; f++) for (let i = 0; i < 8; i++) { if ((i * 7 + f * 3) % 5 < 3) { x.fillStyle = '#ffd27c'; x.fillRect(85 + i * 113, 270 + f * 160, 64, 110); } } for (let i = 0; i < 5; i++) { x.fillStyle = '#ffcf7a'; x.beginPath(); x.roundRect(110 + i * 180, 800, 110, 224, [55, 55, 0, 0]); x.fill(); } x.fillStyle = '#e8c56a'; x.font = 'bold 44px Georgia, serif'; x.textAlign = 'center'; x.fillText('HÔTEL DE CRILLON', 512, 168); return c; })();
{
  const hm = lam({ map: tex(hotelFacade), emissiveMap: tex(hotelLit), emissive: 0xffffff, emissiveIntensity: 0 }); nightEmissive.push(hm);
  const side = lam({ color: 0xf2e8d4 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(14, 21, 24), [side, hm, side, side, side, side]); m.position.set(22, 10.5, 2); add(m);
  box(15, 0.6, 25, mats.stone, 22, 21.3, 2); mansard(24, 14, 3.6, scene, 22, 21.6, 2, 0);
  // terrace
  box(5.2, 0.5, 19, lam({ map: tex(woodTex('#c49564'), 3, 8) }), 11.6, 0.25, 2);
  for (let z = -7; z <= 11; z += 1.2) { cyl(0.08, 0.1, 0.9, mats.stone, 9.1, 0.95, z, 8); }
  box(0.25, 0.12, 19, mats.stone, 9.1, 1.45, 2);
  // long table
  box(1.4, 0.08, 10.5, mats.cloth, 11.4, 1.32, 1.6);
  box(1.46, 0.35, 10.6, mats.cloth, 11.4, 1.12, 1.6);
  for (const dz of [-3.4, 6.6]) for (const dx of [-0.55, 0.55]) cyl(0.05, 0.05, 0.8, mats.wood, 11.4 + dx, 0.9, dz, 6);
  // candle + wine props
  for (let i = 0; i < 4; i++) { cyl(0.05, 0.06, 0.28, mats.green, 11.4 + (i % 2 ? 0.3 : -0.3), 1.5, -1.6 + i * 2.6, 8); cyl(0.12, 0.12, 0.02, mats.cloth, 11.4 + (i % 2 ? -0.3 : 0.3), 1.37, -1.0 + i * 2.6, 12); }
  // awning over hotel door
  box(1.2, 0.15, 10, mats.red, 14.6, 4.2, 2);
}

// café awning + table (left sidewalk)
{
  const c = cv(256, 128), x = c.getContext('2d'); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#f4efe4' : '#c0392b'; x.fillRect(i * 16, 0, 16, 128); }
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), lam({ map: tex(c, 3, 1), side: THREE.DoubleSide })); aw.position.set(-12.4, 3.3, 20); aw.rotation.set(-Math.PI / 2, 0.42, Math.PI / 2); add(aw);
  cyl(0.48, 0.48, 0.05, mats.cloth, -10.4, 0.93, 20.4, 20); cyl(0.04, 0.05, 0.75, mats.ink, -10.4, 0.55, 20.4, 6); cyl(0.25, 0.3, 0.04, mats.ink, -10.4, 0.2, 20.4, 12);
  cyl(0.05, 0.05, 0.12, mats.cloth, -10.25, 1.01, 20.2, 10); // coffee cup
  box(0.5, 0.05, 0.5, mats.wood, -11.1, 0.62, 20.75); box(0.5, 0.6, 0.05, mats.wood, -11.1, 0.9, 21.0);
  box(0.5, 0.05, 0.5, mats.wood, -10.6, 0.62, 23.0); box(0.5, 0.6, 0.05, mats.wood, -10.6, 0.9, 23.25);
  cyl(0.48, 0.48, 0.05, mats.cloth, -10.4, 0.93, 23.4, 20); cyl(0.04, 0.05, 0.75, mats.ink, -10.4, 0.55, 23.4, 6);
}

// lamps
const lampBulbs = [];
function lampPost(x, z, y0 = 0.18) {
  cyl(0.09, 0.13, 4.2, mats.green, x, y0 + 2.1, z, 8); box(0.42, 0.55, 0.42, mats.green, x, y0 + 4.45, z);
  const b = box(0.32, 0.4, 0.32, mats.lamp, x, y0 + 4.45, z); lampBulbs.push(b);
}
for (let z = 50; z > -40; z -= 14) { if (Math.abs(z - 22) > 5) lampPost(-9.4, z); if (z + 7 > 16 || z + 7 < -12) lampPost(9.4, z + 7); }
for (let x = -50; x <= 50; x += 20) lampPost(x, -50.8, 0.0);
const lampLights = [V(9.6, 4.0, 4), V(9.6, 4.0, -3), V(-9.4, 4.5, 8), V(10, 4.4, -50.6)].map(p => { const l = new THREE.PointLight(0xffc77a, 0, 18, 1.6); l.position.copy(p); scene.add(l); return l; });

// trees
function tree(x, z, s = 1, seed = 1) {
  const r = rng(seed); cyl(0.18 * s, 0.26 * s, 3.2 * s, mats.trunk, x, 1.6 * s, z, 7);
  for (let i = 0; i < 3; i++) { const g = new THREE.Mesh(new THREE.IcosahedronGeometry((1.5 + r() * 0.6) * s, 1), i % 2 ? mats.leaf : mats.leaf2); g.position.set(x + (r() - 0.5) * 1.4 * s, (3.6 + r() * 1.2) * s, z + (r() - 0.5) * 1.4 * s); add(g); }
}
for (let z = 50; z > -38; z -= 9) { tree(-8.6, z + 3, 1, z * 7 + 3); if (z - 1 > 30 || z - 1 < -14) tree(8.6, z - 1, 1, z * 5 + 11); }
for (let x = -150; x <= 150; x += 9) { if (Math.abs(x) < 34) continue; tree(x, -82, 1.3, x + 900); tree(x + 4, -96, 1.4, x + 1900); }
for (let i = 0; i < 40; i++) { const r = rng(i + 4000); const x = (r() - 0.5) * 120; const z = -100 - r() * 70; if (Math.abs(x) < 26 && z > -160) continue; tree(x, z, 1.5, i + 5000); }

// ---------- the Eiffel Tower (instanced beams) ----------
const TOWER = V(0, 0, -130), TH = 104;
const hw = y => 21 * Math.exp(-y / 24) + 1.1;
const beams = [];
function beam(a, b, t) { beams.push([a.clone(), b.clone(), t]); }
{
  const lv = []; for (let y = 0; y <= 44; y += 4) lv.push(y); for (let y = 50; y <= 88; y += 6.5) lv.push(y);
  const corner = (y, sx, sz) => V(TOWER.x + sx * hw(y), y, TOWER.z + sz * hw(y));
  const cs = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (let i = 0; i < lv.length - 1; i++) {
    const y0 = lv[i], y1 = lv[i + 1]; const th = Math.max(0.35, hw(y0) * 0.11);
    for (const [sx, sz] of cs) beam(corner(y0, sx, sz), corner(y1, sx, sz), th * 1.6);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4];
      beam(corner(y0, ax, az), corner(y1, bx, bz), th * 0.45); beam(corner(y0, bx, bz), corner(y1, ax, az), th * 0.45);
      beam(corner(y1, ax, az), corner(y1, bx, bz), th * 0.6);
      if (y0 < 40) { // inner leg faces
        const f = 0.62; const inA = V(TOWER.x + ax * hw(y0) * f, y0, TOWER.z + az * hw(y0) * f), inB = V(TOWER.x + ax * hw(y1) * f, y1, TOWER.z + az * hw(y1) * f);
        beam(inA, inB, th); beam(corner(y0, ax, az), inB, th * 0.4);
      }
    }
  }
  // arches on 4 faces
  for (let k = 0; k < 4; k++) {
    const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4]; const pts = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; const y = Math.sin(u * Math.PI) * 15; const yy = Math.max(y, 0.1); const px = lerp(ax, bx, u) * hw(yy) * 0.98, pz = lerp(az, bz, u) * hw(yy) * 0.98; pts.push(V(TOWER.x + px * (0.6 + 0.4 * Math.abs(u - 0.5) * 2), y + 1.2 * (1 - Math.abs(u - 0.5) * 2), TOWER.z + pz * (0.6 + 0.4 * Math.abs(u - 0.5) * 2))); }
    for (let i = 0; i < pts.length - 1; i++) beam(pts[i], pts[i + 1], 0.9);
  }
  // spire
  beam(V(TOWER.x, 88, TOWER.z), V(TOWER.x, TH, TOWER.z), 0.5);
}
const beamGeo = new THREE.BoxGeometry(1, 1, 1);
const towerMat = lam({ color: 0xffffff });
const towerMesh = new THREE.InstancedMesh(beamGeo, towerMat, beams.length);
{
  const r = rng(31), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), col = new THREE.Color();
  beams.forEach(([a, b, t], i) => {
    const d = b.clone().sub(a); const len = d.length(); q.setFromUnitVectors(up, d.normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), q, V(t, len, t)); towerMesh.setMatrixAt(i, m4);
    col.set(r() < 0.18 ? 0xa4532c : (r() < 0.5 ? 0x8a5a3c : 0x7c5036)); towerMesh.setColorAt(i, col);
  });
}
add(towerMesh);
box(hw(18) * 2.3, 2.2, hw(18) * 2.3, lam({ color: 0x86563a }), TOWER.x, 18.5, TOWER.z);
box(hw(18) * 2.4, 0.6, hw(18) * 2.4, lam({ color: 0x6a3f28 }), TOWER.x, 19.9, TOWER.z);
box(hw(42) * 2.4, 1.8, hw(42) * 2.4, lam({ color: 0x86563a }), TOWER.x, 42.5, TOWER.z);
box(hw(86) * 3.2, 2.6, hw(86) * 3.2, lam({ color: 0x86563a }), TOWER.x, 87.5, TOWER.z);
cyl(0.9, 1.6, 2.5, lam({ color: 0x6a3f28 }), TOWER.x, 90.5, TOWER.z, 8);

// ---------- train set (Vienna line, far away at x=400) ----------
const TRAIN = V(400, 0, 0);
{
  box(600, 0.3, 3.4, lam({ color: 0x6d6258 }), TRAIN.x, 0.15, TRAIN.z);
  for (let x = -300; x < 300; x += 1.2) box(0.25, 0.12, 2.8, mats.wood, TRAIN.x + x, 0.34, TRAIN.z);
  for (const dz of [-0.75, 0.75]) box(600, 0.12, 0.12, mats.ink, TRAIN.x, 0.45, TRAIN.z + dz);
  // platform (Vienna station)
  box(30, 0.9, 6, mats.stone, TRAIN.x + 60, 0.45, TRAIN.z + 5.2);
  box(30, 0.9, 6, lam({ map: tex(cobbleTex(8, '#a39985'), 6, 1) }), TRAIN.x + 60, 0.46, TRAIN.z + 5.2);
  lampPost(TRAIN.x + 58, TRAIN.z + 6.5, 0.9); lampLights.push((() => { const l = new THREE.PointLight(0xffc77a, 0, 16, 1.4); l.position.set(TRAIN.x + 58, 5.4, TRAIN.z + 6.2); scene.add(l); return l; })());
  box(2.2, 0.12, 0.6, mats.wood, TRAIN.x + 63, 1.4, TRAIN.z + 7.4); box(2.2, 0.6, 0.1, mats.wood, TRAIN.x + 63, 1.75, TRAIN.z + 7.7);
  const stC = cv(512, 256), sx = stC.getContext('2d'); sx.fillStyle = '#1f3a5a'; sx.fillRect(0, 0, 512, 256); sx.fillStyle = '#f2e8d4'; sx.font = 'bold 96px Georgia, serif'; sx.textAlign = 'center'; sx.fillText('WIEN', 256, 160);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), lam({ map: tex(stC) })); sign.position.set(TRAIN.x + 55, 3.2, TRAIN.z + 7.9); sign.rotation.y = Math.PI; add(sign);
  cyl(0.06, 0.06, 2.5, mats.green, TRAIN.x + 54, 2.0, TRAIN.z + 7.9, 6); cyl(0.06, 0.06, 2.5, mats.green, TRAIN.x + 56, 2.0, TRAIN.z + 7.9, 6);
  const r = rng(91); for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 560; const z = -14 - r() * 60; tree(TRAIN.x + x, TRAIN.z + z, 1.2 + r() * 0.8, 7000 + i); }
  for (let i = 0; i < 12; i++) { const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(40 + r() * 30, 1), lam({ color: 0x4f7f3a, flatShading: true })); hill.position.set(TRAIN.x - 180 + i * 36, -22, TRAIN.z - 95 - r() * 40); add(hill); }
}
const trainGroup = new THREE.Group(); scene.add(trainGroup);
{
  const g = trainGroup; const winC = cv(512, 128), wx = winC.getContext('2d'); wx.fillStyle = '#7a2630'; wx.fillRect(0, 0, 512, 128); wx.fillStyle = '#d8b25a'; wx.fillRect(0, 6, 512, 6); wx.fillRect(0, 116, 512, 6); for (let i = 0; i < 5; i++) { wx.fillStyle = '#1d2433'; wx.fillRect(22 + i * 100, 26, 64, 66); }
  const winLit = cv(512, 128), wl = winLit.getContext('2d'); wl.fillStyle = '#000'; wl.fillRect(0, 0, 512, 128); for (let i = 0; i < 5; i++) { wl.fillStyle = '#ffcf7a'; wl.fillRect(22 + i * 100, 26, 64, 66); }
  const carMat = lam({ map: tex(winC), emissiveMap: tex(winLit), emissive: 0xffffff, emissiveIntensity: 0 }); nightEmissive.push(carMat);
  const cm = lam({ color: 0x7a2630 });
  for (const cx of [-9, -21]) { const c = new THREE.Mesh(new THREE.BoxGeometry(11, 3.0, 2.8), [cm, cm, lam({ color: 0x3a2a2a }), cm, carMat, cm]); c.position.set(cx, 2.4, 0); add(c, g); box(11.4, 0.3, 3.2, lam({ color: 0x3a2a2a }), cx, 4.0, 0, g); for (const wxo of [-3.5, 3.5]) for (const z of [-1.2, 1.2]) { const wh = cyl(0.55, 0.55, 0.2, mats.ink, cx + wxo, 0.95, z, 14, g); wh.rotation.x = Math.PI / 2; } }
  box(6, 2.6, 2.6, mats.train, 0, 2.2, 0, g); const boiler = cyl(1.2, 1.2, 6, mats.train, 3.4, 2.4, 0, 18, g); boiler.rotation.z = Math.PI / 2;
  cyl(0.45, 0.6, 1.8, mats.ink, 5.4, 4.2, 0, 10, g); box(3.2, 3.4, 2.9, mats.train, -1.6, 2.9, 0, g); box(3.6, 0.3, 3.2, mats.ink, -1.6, 4.7, 0, g);
  box(0.4, 0.4, 3.0, mats.red, 6.6, 1.2, 0, g); for (const wxo of [-1.6, 1.4, 4.0]) for (const z of [-1.25, 1.25]) { const wh = cyl(0.8, 0.8, 0.2, mats.red, wxo, 1.0, z, 16, g); wh.rotation.x = Math.PI / 2; }
}

// ---------- 2D character cards ----------
const PLUM = '#241726';
const cards = [];
const SPECS = {
  lustig: { h: 2.25, suit: '#2b2f45', pants: '#232637', hat: 'top', hatC: '#2a2a33', band: '#7a2630', stache: 'thin', tie: '#a3202a', skin: '#fbe7d8', slim: 1 },
  poisson: { h: 1.95, suit: '#8a5a33', pants: '#5c3d24', hat: 'bowler', hatC: '#3a2b22', band: '#1f1712', stache: 'bushy', tie: '#2f5a3f', skin: '#fde3d0', belly: 1 },
  d1: { h: 2.1, suit: '#3f6a4a', pants: '#2f4a38', hat: 'cap', hatC: '#5b4a3a', stache: 'none', tie: '#d8b25a', skin: '#f6dcc6' },
  d2: { h: 2.15, suit: '#6b6f78', pants: '#4a4d55', hat: 'none', beard: 1, tie: '#7a2630', skin: '#f3d6bf', hair: '#5a4030' },
  d3: { h: 2.0, suit: '#2f5a8a', pants: '#25486e', hat: 'cap', hatC: '#2b3a52', stache: 'thin', tie: '#f4efe4', skin: '#e9c3a3' },
  d4: { h: 2.05, suit: '#b89a6a', pants: '#7e6845', hat: 'none', glasses: 1, stache: 'bushy', tie: '#3a2b4f', skin: '#fbe7d8', hair: '#cfcfcf' },
  d5: { h: 2.12, suit: '#6a3a5a', pants: '#4a2a40', hat: 'bowler', hatC: '#222', stache: 'none', tie: '#d8b25a', skin: '#f8dcc8' },
};

function headPath(x, cx, cy, rw, rh) {
  x.beginPath(); x.moveTo(cx, cy - rh);
  x.bezierCurveTo(cx + rw * 1.02, cy - rh, cx + rw * 1.05, cy + rh * 0.35, cx + rw * 0.55, cy + rh * 0.85);
  x.bezierCurveTo(cx + rw * 0.3, cy + rh * 1.02, cx - rw * 0.3, cy + rh * 1.02, cx - rw * 0.55, cy + rh * 0.85);
  x.bezierCurveTo(cx - rw * 1.05, cy + rh * 0.35, cx - rw * 1.02, cy - rh, cx, cy - rh); x.closePath();
}
function stick(x, pts, w = 12) { x.strokeStyle = PLUM; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); }
function dot(x, px, py, r = 10, c = PLUM) { x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }

function drawPerson(c, sp, st) {
  const x = c.getContext('2d'); x.clearRect(0, 0, 600, 1000);
  const cx = 300, hy = st.sit ? 430 : 270; const yo = hy - 270; // vertical offset for sitting
  const walk = st.walk || 0; const bust = st.bust;
  // legs
  const hipY = 650 + yo;
  if (!bust) {
    if (st.sit) {
      stick(x, [[278, hipY], [250, hipY + 40], [255, 975]]); stick(x, [[322, hipY], [350, hipY + 40], [345, 975]]);
      x.fillStyle = PLUM; x.beginPath(); x.ellipse(245, 975, 28, 13, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(355, 975, 28, 13, 0, 0, 7); x.fill();
    } else {
      const a = Math.sin(walk) * 0.32;
      const f1 = [278 + Math.sin(a) * 300, 650 + Math.cos(a) * 325], f2 = [322 - Math.sin(a) * 300, 650 + Math.cos(a) * 325];
      stick(x, [[278, 650], f1]); stick(x, [[322, 650], f2]);
      x.fillStyle = PLUM; x.beginPath(); x.ellipse(f1[0] - 10, f1[1], 30, 13, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(f2[0] + 10, f2[1], 30, 13, 0, 0, 7); x.fill();
    }
  }
  // torso
  const sw = sp.belly ? 92 : (sp.slim ? 62 : 72); const tY = 400 + yo;
  x.fillStyle = sp.suit; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath();
  if (sp.belly) { x.moveTo(cx - 60, tY); x.bezierCurveTo(cx - 135, tY + 120, cx - 130, hipY, cx - 60, hipY + 12); x.lineTo(cx + 60, hipY + 12); x.bezierCurveTo(cx + 130, hipY, cx + 135, tY + 120, cx + 60, tY); }
  else { x.moveTo(cx - sw, tY + 10); x.lineTo(cx - sw + 12, hipY + 10); x.lineTo(cx + sw - 12, hipY + 10); x.lineTo(cx + sw, tY + 10); x.quadraticCurveTo(cx, tY - 14, cx - sw, tY + 10); }
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#f7f3ea'; x.beginPath(); x.moveTo(cx - 24, tY + 2); x.lineTo(cx, tY + 92); x.lineTo(cx + 24, tY + 2); x.closePath(); x.fill();
  x.fillStyle = sp.tie; x.beginPath(); x.moveTo(cx - 8, tY + 14); x.lineTo(cx + 8, tY + 14); x.lineTo(cx + 5, tY + 80); x.lineTo(cx, tY + 92); x.lineTo(cx - 5, tY + 80); x.closePath(); x.fill();
  if (bust) { x.fillStyle = sp.suit; x.fillRect(cx - 150, hipY - 120, 300, 0); }
  // arms
  const sL = [cx - sw + 6, tY + 26], sR = [cx + sw - 6, tY + 26];
  const P = st.pose || 'idle'; let hl, hr, el, er; const sway = Math.sin(walk) * 30;
  const at = (dx, dy) => [cx + dx, tY + dy];
  switch (P) {
    case 'point': hl = at(-sw - 10, 210); hr = at(sw + 120, 40); break;
    case 'present': hl = at(-sw - 120, 70); hr = at(sw + 120, 70); break;
    case 'paper': hl = at(-sw - 10, 210); hr = at(sw + 70, 120); break;
    case 'news': case 'newsUp': hl = at(-110, P === 'newsUp' ? -60 : 120); hr = at(110, P === 'newsUp' ? -60 : 120); break;
    case 'whisper': hl = at(-sw - 10, 210); hr = at(52, -44 - 40); break;
    case 'rub': hl = at(-20, 150); hr = at(20, 150); break;
    case 'give': hl = at(-sw - 10, 210); hr = at(sw + 110, 110); break;
    case 'envelope': hl = at(-sw - 10, 210); hr = at(sw + 90, 70); break;
    case 'watch': hl = at(-sw - 10, 210); hr = at(60, -10); break;
    case 'hide': hl = at(-70, -150); hr = at(70, -150); break;
    case 'cheer': hl = at(-sw - 70, -120); hr = at(sw + 70, -120); break;
    case 'fist': hl = at(-sw - 10, 210); hr = at(sw + 60, -60); break;
    case 'stamp': hl = at(-sw - 10, 210); hr = at(sw + 40, 230); break;
    case 'stampUp': hl = at(-sw - 10, 210); hr = at(sw + 50, 20); break;
    case 'case': hl = at(-sw - 10, 210); hr = at(sw + 34, 250); break;
    default: hl = at(-sw - 18 + sway * 0.2, 225); hr = at(sw + 18 - sway * 0.2, 225);
  }
  el = [(sL[0] + hl[0]) / 2 - 18, (sL[1] + hl[1]) / 2 + 10]; er = [(sR[0] + hr[0]) / 2 + 18, (sR[1] + hr[1]) / 2 + 10];
  // props behind hands
  const prop = st.prop;
  if (P === 'news' || P === 'newsUp') {
    const ny = P === 'newsUp' ? tY - 230 : tY + 20; x.fillStyle = '#efe8d6'; x.strokeStyle = PLUM; x.lineWidth = 7; x.fillRect(cx - 150, ny, 300, 230); x.strokeRect(cx - 150, ny, 300, 230);
    x.fillStyle = '#2a2a30'; x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.fillText('LE MATIN', cx, ny + 44); x.fillRect(cx - 130, ny + 56, 260, 5);
    x.font = 'bold 20px Georgia'; x.fillText('LA TOUR COÛTE', cx - 50, ny + 92); x.fillText('UNE FORTUNE !', cx - 50, ny + 116);
    x.strokeStyle = '#2a2a30'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + 95, ny + 78); x.lineTo(cx + 75, ny + 200); x.moveTo(cx + 95, ny + 78); x.lineTo(cx + 115, ny + 200); x.moveTo(cx + 82, ny + 140); x.lineTo(cx + 108, ny + 140); x.stroke();
    for (let i = 0; i < 6; i++) x.fillRect(cx - 130, ny + 140 + i * 14, 150, 4);
  }
  if (!bust || P !== 'idle') { stick(x, [sL, el, hl]); stick(x, [sR, er, hr]); dot(x, hl[0], hl[1], 12); dot(x, hr[0], hr[1], 12); }
  if (P === 'paper' || prop === 'paper') { x.save(); x.translate(hr[0], hr[1]); x.rotate(-0.15); x.fillStyle = '#fbf7ec'; x.strokeStyle = PLUM; x.lineWidth = 6; x.fillRect(-10, -120, 100, 130); x.strokeRect(-10, -120, 100, 130); x.fillStyle = '#7a2630'; x.beginPath(); x.arc(40, -80, 18, 0, 7); x.fill(); x.fillStyle = '#999'; for (let i = 0; i < 4; i++) x.fillRect(5, -50 + i * 14, 70, 4); x.restore(); }
  if (P === 'envelope' || prop === 'envelope') { x.save(); x.translate(hr[0], hr[1]); x.rotate(-0.2); x.fillStyle = '#f2e3bd'; x.strokeStyle = PLUM; x.lineWidth = 6; x.fillRect(-10, -70, 120, 76); x.strokeRect(-10, -70, 120, 76); x.beginPath(); x.moveTo(-10, -70); x.lineTo(50, -25); x.lineTo(110, -70); x.stroke(); x.fillStyle = '#5fa04a'; x.fillRect(20, -88, 70, 20); x.restore(); }
  if (P === 'give' || prop === 'money') { x.save(); x.translate(hr[0], hr[1]); x.fillStyle = '#6fae55'; x.strokeStyle = PLUM; x.lineWidth = 6; for (let i = 0; i < 4; i++) { x.fillRect(-20, -60 - i * 16, 130, 40); x.strokeRect(-20, -60 - i * 16, 130, 40); } x.fillStyle = '#3f7a35'; x.beginPath(); x.arc(45, -95, 12, 0, 7); x.fill(); x.restore(); }
  if (P === 'case') { x.fillStyle = '#7a4a2a'; x.strokeStyle = PLUM; x.lineWidth = 7; x.beginPath(); x.roundRect(hr[0] - 60, hr[1] + 6, 150, 110, 12); x.fill(); x.stroke(); x.fillStyle = '#d8b25a'; x.fillRect(hr[0] + 5, hr[1] + 50, 20, 14); }
  if (P === 'watch') { x.fillStyle = '#e8c56a'; x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.arc(hr[0] + 20, hr[1] - 30, 30, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(hr[0] + 20, hr[1] - 30, 20, 0, 7); x.fill(); stick(x, [[hr[0] + 20, hr[1] - 30], [hr[0] + 20, hr[1] - 45]], 4); }
  if (P === 'stamp' || P === 'stampUp') { x.fillStyle = '#5b3a24'; x.strokeStyle = PLUM; x.lineWidth = 6; x.beginPath(); x.roundRect(hr[0] - 16, hr[1] - 70, 32, 60, 8); x.fill(); x.stroke(); x.fillStyle = '#7a2630'; x.fillRect(hr[0] - 34, hr[1] - 14, 68, 22); x.strokeRect(hr[0] - 34, hr[1] - 14, 68, 22); }
  // head
  const rw = 118, rh = 124, hcx = cx + (st.tilt || 0) * 10, hcy = hy;
  if (P === 'hide') { /* hat over face, drawn later */ }
  x.fillStyle = sp.skin; x.strokeStyle = PLUM; x.lineWidth = 9; headPath(x, hcx, hcy, rw, rh); x.fill(); x.stroke();
  if (sp.hair) { x.fillStyle = sp.hair; x.beginPath(); x.ellipse(hcx - 100, hcy - 20, 22, 46, 0.3, 0, 7); x.ellipse(hcx + 100, hcy - 20, 22, 46, -0.3, 0, 7); x.fill(); }
  const E = st.expr || 'neutral'; const ex = 31, ey = hcy - 8 + (st.look || 0) * 0;
  const blink = st.blink;
  // eyes
  const eyeR = (E === 'shocked' || E === 'wow') ? 15 : 10;
  for (const s of [-1, 1]) {
    const px = hcx + s * ex + (st.gaze || 0) * 6, py = ey;
    if (blink || E === 'happy' || E === 'relief') { stick(x, E === 'happy' || E === 'relief' ? [[px - 13, py + 4], [px, py - 7], [px + 13, py + 4]] : [[px - 12, py], [px + 12, py]], 6); }
    else if (E === 'wink' && s > 0) { stick(x, [[px - 13, py], [px + 13, py]], 6); }
    else if (E === 'embarrassed') { stick(x, [[px - 12, py + 6], [px + 12, py + 2]], 6); }
    else if (E === 'suspicious') { dot(x, px, py + 3, 9); stick(x, [[px - 16, py - 6], [px + 16, py - 6]], 6); }
    else if (E === 'wow') { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 20, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = PLUM; x.stroke(); dot(x, px, py + 2, 10); }
    else dot(x, px, py, eyeR);
  }
  // brows
  const bY = ey - 40; x.lineWidth = 7;
  if (E === 'smug' || E === 'sly' || E === 'wink') { stick(x, [[hcx - 50, bY + 6], [hcx - 14, bY - 2]], 7); stick(x, [[hcx + 14, bY - 8], [hcx + 50, bY + 2]], 7); }
  else if (E === 'suspicious') { stick(x, [[hcx - 50, bY + 2], [hcx - 14, bY + 12]], 7); stick(x, [[hcx + 14, bY - 12], [hcx + 50, bY - 18]], 7); }
  else if (E === 'shocked' || E === 'wow') { stick(x, [[hcx - 50, bY - 16], [hcx - 14, bY - 22]], 7); stick(x, [[hcx + 14, bY - 22], [hcx + 50, bY - 16]], 7); }
  else if (E === 'worried' || E === 'embarrassed') { stick(x, [[hcx - 50, bY + 4], [hcx - 14, bY - 8]], 7); stick(x, [[hcx + 14, bY - 8], [hcx + 50, bY + 4]], 7); }
  else if (E === 'angry') { stick(x, [[hcx - 50, bY - 6], [hcx - 14, bY + 8]], 7); stick(x, [[hcx + 14, bY + 8], [hcx + 50, bY - 6]], 7); }
  // nose
  x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); x.moveTo(hcx + 4, ey + 14); x.quadraticCurveTo(hcx + 16, ey + 34, hcx + 2, ey + 38); x.stroke();
  // blush
  if (E === 'embarrassed' || st.blush) { x.fillStyle = 'rgba(230,70,70,0.55)'; x.beginPath(); x.ellipse(hcx - 62, ey + 36, 30, 16, 0, 0, 7); x.ellipse(hcx + 62, ey + 36, 30, 16, 0, 0, 7); x.fill(); x.fillStyle = '#9fd3ff'; x.strokeStyle = PLUM; x.lineWidth = 4; x.beginPath(); x.moveTo(hcx + 96, ey - 40); x.quadraticCurveTo(hcx + 112, ey - 10, hcx + 96, ey - 6); x.quadraticCurveTo(hcx + 80, ey - 10, hcx + 96, ey - 40); x.fill(); x.stroke(); }
  // mouth
  const my = ey + 62, mo = st.mouth || 0;
  x.strokeStyle = PLUM; x.fillStyle = '#7a2a30'; x.lineWidth = 6;
  if (mo > 0.05) { x.beginPath(); x.ellipse(hcx, my + 4, 18 + mo * 6, 6 + mo * 16, 0, 0, 7); x.fill(); x.stroke(); }
  else if (E === 'smug' || E === 'sly' || E === 'wink') { x.beginPath(); x.moveTo(hcx - 30, my); x.quadraticCurveTo(hcx + 5, my + 14, hcx + 36, my - 10); x.stroke(); }
  else if (E === 'happy' || E === 'grin' || E === 'relief') { x.beginPath(); x.moveTo(hcx - 34, my - 4); x.quadraticCurveTo(hcx, my + 40, hcx + 34, my - 4); x.closePath(); x.fill(); x.stroke(); }
  else if (E === 'shocked' || E === 'wow') { x.beginPath(); x.ellipse(hcx, my + 6, 14, 20, 0, 0, 7); x.fill(); x.stroke(); }
  else if (E === 'suspicious' || E === 'worried' || E === 'angry') { stick(x, [[hcx - 22, my + 6], [hcx + 22, my]], 6); }
  else if (E === 'embarrassed') { x.beginPath(); x.moveTo(hcx - 22, my + 6); x.quadraticCurveTo(hcx - 8, my - 4, hcx, my + 6); x.quadraticCurveTo(hcx + 8, my - 4, hcx + 22, my + 6); x.stroke(); }
  else { x.beginPath(); x.moveTo(hcx - 20, my); x.quadraticCurveTo(hcx, my + 8, hcx + 20, my); x.stroke(); }
  // moustache / beard
  if (sp.stache === 'thin') { stick(x, [[hcx - 44, my - 6], [hcx - 6, my - 18], [hcx, my - 14], [hcx + 6, my - 18], [hcx + 44, my - 6]], 6); }
  if (sp.stache === 'bushy') { x.fillStyle = '#4a3020'; x.beginPath(); x.ellipse(hcx - 26, my - 14, 30, 13, 0.15, 0, 7); x.ellipse(hcx + 26, my - 14, 30, 13, -0.15, 0, 7); x.fill(); }
  if (sp.beard) { x.fillStyle = '#5a4030'; x.beginPath(); x.moveTo(hcx - 80, ey + 40); x.quadraticCurveTo(hcx, hcy + 190, hcx + 80, ey + 40); x.quadraticCurveTo(hcx, my + 30, hcx - 80, ey + 40); x.fill(); }
  if (sp.glasses) { x.strokeStyle = PLUM; x.lineWidth = 5; x.beginPath(); x.arc(hcx - ex, ey, 22, 0, 7); x.moveTo(hcx + ex + 22, ey); x.arc(hcx + ex, ey, 22, 0, 7); x.moveTo(hcx - ex + 22, ey); x.lineTo(hcx + ex - 22, ey); x.stroke(); }
  // hats
  const top = hcy - rh;
  x.strokeStyle = PLUM; x.lineWidth = 8;
  const hatOn = P !== 'hide';
  if (sp.hat === 'top' && hatOn) { x.fillStyle = sp.hatC; x.beginPath(); x.rect(hcx - 78, top - 120, 156, 140); x.fill(); x.stroke(); x.fillStyle = sp.band; x.fillRect(hcx - 74, top - 2, 148, 22); x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 26, 130, 20, 0, 0, 7); x.fill(); x.stroke(); }
  if (sp.hat === 'bowler' && hatOn) { x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 24, 128, 20, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.arc(hcx, top + 20, 92, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = sp.band; x.fillRect(hcx - 90, top + 4, 180, 14); }
  if (sp.hat === 'cap' && hatOn) { x.fillStyle = sp.hatC; x.beginPath(); x.ellipse(hcx, top + 30, 118, 52, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.ellipse(hcx + 60, top + 30, 80, 16, 0, 0, Math.PI); x.fill(); x.stroke(); }
  if (P === 'hide') { x.fillStyle = sp.hatC; x.strokeStyle = PLUM; x.lineWidth = 8; x.beginPath(); x.ellipse(hcx, hcy - 10, 140, 26, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.arc(hcx, hcy - 14, 100, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); }
  // bulb / question / sweat overlays drawn as fx elsewhere
}

class Card {
  constructor(name, sp) {
    this.name = name; this.sp = sp; this.c = cv(600, 1000); this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 8;
    const h = sp.h, w = h * 0.6; const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 - h * 0.025, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mask = new THREE.MeshBasicMaterial({ map: this.t, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x000000 });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.castShadow = true; this.mesh.layers.set(1);
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(w * 0.32, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.scale.y = 0.45; blob.layers.set(1); this.blob = blob;
    this.g = new THREE.Group(); this.g.add(this.mesh); this.g.add(blob); scene.add(this.g);
    this.key = ''; const r = rng(name.length * 97 + h * 1000); this.blinks = []; let bt = r() * 1.5; while (bt < END) { this.blinks.push(bt); bt += 0.5 + r() * 1.8; }
    cards.push(this);
  }
  set(t, st) {
    this.g.visible = !!st;
    if (!st) return;
    const fr = Math.round(t * FPS); const blink = this.blinks.some(b => fr >= Math.round(b * FPS) && fr < Math.round(b * FPS) + 4);
    const s = { ...st, blink: blink && !st.noBlink, walk: st.walk ? t * st.walk : 0 };
    const key = JSON.stringify([s.expr, s.pose, Math.round((s.mouth || 0) * 6), s.blink, Math.round(s.walk * 8), s.sit, s.prop, s.bust, s.blush]);
    if (key !== this.key) { drawPerson(this.c, this.sp, s); this.t.needsUpdate = true; this.key = key; }
    const bob = st.walk ? Math.abs(Math.sin(t * st.walk)) * 0.06 : 0;
    this.g.position.set(st.p[0], (st.p[1] || 0) + bob, st.p[2]);
    this.mesh.rotation.y = Math.atan2(camera.position.x - st.p[0], camera.position.z - st.p[2]);
    this.mesh.rotation.z = (st.lean || 0) + (st.walk ? Math.sin(t * st.walk) * 0.03 : 0);
    const sc = st.s || 1; this.mesh.scale.set((st.flip ? -1 : 1) * sc, sc, sc);
    this.blob.visible = !st.bust;
  }
}
const C = {}; for (const k in SPECS) C[k] = new Card(k, SPECS[k]);
const C2 = { e1: new Card('e1', SPECS.d1), e2: new Card('e2', SPECS.d3), e3: new Card('e3', SPECS.d4) };

// ---------- FX cards ----------
function fxCard(name, w, h, draw) {
  const c = cv(256, Math.round(256 * h / w)); draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide }));
  m.layers.set(1); m.visible = false; scene.add(m); m.userData.mask = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, color: 0, side: THREE.DoubleSide }); fxList.push(m); return m;
}
const fxList = [];
const FX = {
  bulb: fxCard('bulb', 0.7, 0.9, (x, w, h) => { x.fillStyle = '#ffe36a'; x.strokeStyle = PLUM; x.lineWidth = 12; x.beginPath(); x.arc(128, 120, 90, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#9aa3ad'; x.fillRect(88, 200, 80, 70); x.strokeRect(88, 200, 80, 70); for (let i = 0; i < 8; i++) { const a = i / 8 * 7; } }),
  q: fxCard('q', 0.5, 0.7, (x) => { x.fillStyle = '#fff'; x.strokeStyle = PLUM; x.lineWidth = 14; x.font = 'bold 300px Georgia'; x.textAlign = 'center'; x.strokeText('?', 128, 300); x.fillText('?', 128, 300); }),
  spark: fxCard('spark', 0.6, 0.6, (x) => { x.fillStyle = '#fff6b0'; x.strokeStyle = PLUM; x.lineWidth = 10; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 40 : 118; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); }),
  spark2: fxCard('spark2', 0.4, 0.4, (x) => { x.fillStyle = '#fff6b0'; x.strokeStyle = PLUM; x.lineWidth = 10; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 40 : 118; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); }),
  flake: fxCard('flake', 0.5, 0.4, (x) => { x.fillStyle = '#b86a3c'; x.strokeStyle = PLUM; x.lineWidth = 10; x.beginPath(); x.moveTo(20, 60); x.lineTo(200, 20); x.lineTo(240, 140); x.lineTo(110, 190); x.lineTo(40, 150); x.closePath(); x.fill(); x.stroke(); }),
  moon: fxCard('moon', 26, 26, (x) => { x.fillStyle = '#fff4c8'; x.beginPath(); x.arc(128, 128, 100, 0, 7); x.fill(); x.fillStyle = '#e8dca8'; x.beginPath(); x.arc(100, 100, 18, 0, 7); x.arc(160, 150, 12, 0, 7); x.fill(); }),
  cat: fxCard('cat', 0.9, 0.7, (x) => { x.fillStyle = '#2a2a33'; x.beginPath(); x.ellipse(120, 120, 80, 40, 0, 0, 7); x.fill(); x.beginPath(); x.arc(200, 90, 34, 0, 7); x.fill(); x.beginPath(); x.moveTo(180, 64); x.lineTo(186, 36); x.lineTo(200, 60); x.moveTo(206, 60); x.lineTo(220, 36); x.lineTo(226, 66); x.fill(); x.strokeStyle = '#2a2a33'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(44, 110); x.quadraticCurveTo(10, 60, 30, 30); x.stroke(); for (const lx of [70, 100, 150, 175]) { x.beginPath(); x.moveTo(lx, 150); x.lineTo(lx, 192); x.stroke(); } x.fillStyle = '#ffe36a'; x.beginPath(); x.arc(208, 86, 6, 0, 7); x.fill(); }),
  money1: fxCard('m1', 0.4, 0.2, (x, w, h) => { x.fillStyle = '#6fae55'; x.strokeStyle = PLUM; x.lineWidth = 10; x.fillRect(8, 8, w - 16, h - 16); x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#3f7a35'; x.beginPath(); x.arc(w / 2, h / 2, 26, 0, 7); x.fill(); }),
};
const flashMoney = [0, 1, 2, 3, 4, 5].map(() => FX.money1.clone()); flashMoney.forEach(m => { m.userData.mask = FX.money1.userData.mask; scene.add(m); fxList.push(m); });
const clouds = [];
{
  const r = rng(5); for (let i = 0; i < 9; i++) {
    const m = fxCard('cloud' + i, 60, 26, (x) => { x.fillStyle = '#ffffff'; x.strokeStyle = 'rgba(80,90,130,0.6)'; x.lineWidth = 4; x.beginPath(); x.arc(70, 70, 36, Math.PI, 0); x.arc(120, 52, 46, Math.PI, 0); x.arc(176, 70, 36, Math.PI, 0); x.lineTo(212, 100); x.lineTo(34, 100); x.closePath(); x.fill(); x.stroke(); });
    m.position.set(-260 + i * 65 + r() * 30, 70 + r() * 50, -260 - r() * 60); m.userData.cloud = 1; clouds.push(m);
  }
}


// ---------- extra props ----------
function letterTex(stamped) {
  const c = cv(320, 420), x = c.getContext('2d');
  x.fillStyle = '#fbf7ec'; x.fillRect(0, 0, 320, 420); x.strokeStyle = PLUM; x.lineWidth = 10; x.strokeRect(5, 5, 310, 410);
  x.fillStyle = '#1f3a5a'; x.font = 'bold 22px Georgia, serif'; x.textAlign = 'center'; x.fillText('MINISTÈRE DES POSTES', 160, 52); x.fillText('ET TÉLÉGRAPHES', 160, 80);
  x.fillRect(40, 94, 240, 4); x.fillStyle = '#9a9a9a'; for (let i = 0; i < 9; i++) x.fillRect(40, 130 + i * 22, i % 3 === 2 ? 150 : 240, 7);
  if (stamped) { x.strokeStyle = '#b8322e'; x.lineWidth = 9; x.beginPath(); x.arc(220, 340, 54, 0, 7); x.stroke(); x.beginPath(); x.arc(220, 340, 38, 0, 7); x.stroke(); x.fillStyle = '#b8322e'; x.font = 'bold 22px Georgia'; x.fillText('OFFICIEL', 220, 348); }
  return tex(c);
}
const letterBlank = letterTex(false), letterStamped = letterTex(true);
const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), lam({ map: letterBlank })); letter.rotation.set(-Math.PI / 2, 0, 0.25); letter.position.set(-10.45, 0.962, 20.3); add(letter); letter.castShadow = false;
box(0.8, 0.37, 0.3, lam({ color: 0x7a4a2a }), TRAIN.x + 58.8, 0.9 + 0.185, 6.55);
box(0.12, 0.05, 0.05, mats.gold, TRAIN.x + 58.8, 0.9 + 0.4, 6.55);
const winCard = (() => {
  const off = cv(600, 1000); drawPerson(off, SPECS.lustig, { expr: 'grin', pose: 'idle' });
  const c = cv(400, 450), x = c.getContext('2d');
  x.fillStyle = '#5a3a2a'; x.fillRect(0, 0, 400, 450); x.fillStyle = '#7a4e34'; x.fillRect(0, 300, 400, 150);
  x.drawImage(off, 60, 20, 480, 560, 20, 30, 360, 420);
  x.strokeStyle = '#d8b25a'; x.lineWidth = 18; x.strokeRect(9, 9, 382, 432); x.strokeStyle = PLUM; x.lineWidth = 6; x.strokeRect(2, 2, 396, 446);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.55), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(-21.06, 2.52, 1.415); m.layers.set(1); m.userData.mask = new THREE.MeshBasicMaterial({ color: 0 }); trainGroup.add(m); fxList.push(m); return m;
})();
const tagTex = (txt, size) => { const c = cv(640, 380), x = c.getContext('2d');
  x.translate(320, 200); x.fillStyle = '#c62f2a'; x.strokeStyle = PLUM; x.lineWidth = 14;
  x.beginPath(); x.moveTo(-280, -120); x.lineTo(240, -120); x.lineTo(300, 0); x.lineTo(240, 120); x.lineTo(-280, 120); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#f6efe0'; x.beginPath(); x.arc(205, 0, 22, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 6; x.strokeRect(-258, -98, 430, 196);
  x.fillStyle = '#fff6e6'; x.font = `900 ${size}px Impact, "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = PLUM; x.strokeText(txt, -40, 6); x.fillText(txt, -40, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const tagSold = tagTex('SOLD!', 170), tagForSale = tagTex('FOR SALE', 118);
const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(15, 8.9), new THREE.MeshBasicMaterial({ map: tagSold, alphaTest: 0.4, side: THREE.DoubleSide }));
tagMesh.geometry.translate(0, -4.0, 0); tagMesh.position.set(0, 31, -120.2); tagMesh.layers.set(1); tagMesh.userData.mask = new THREE.MeshBasicMaterial({ map: tagSold, alphaTest: 0.4, color: 0, side: THREE.DoubleSide }); scene.add(tagMesh); fxList.push(tagMesh);
const tagRope = cyl(0.1, 0.1, 4, mats.ink, 0, 33.4, -120.3, 6); tagRope.visible = false;

// ---------- lighting ----------
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 260;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x8a7a66, 1.2); scene.add(hemi);
const LP = {
  day: { sun: '#fff0d8', si: 2.7, az: 140, el: 48, hs: '#cfe0ff', hg: '#9a8668', hi: 1.15, top: '#3e7fd2', hor: '#b8d0ec', fogN: 70, fogF: 520, card: '#ffffff', win: 0, lamp: 0, sat: 1.10, lift: 0.04, tint: '#ffffff', stars: 0, sunDisc: 0 },
  golden: { sun: '#ffb36b', si: 2.5, az: 200, el: 12, hs: '#ffcf9e', hg: '#6a4a6a', hi: 1.0, top: '#7f6fa0', hor: '#ffc47c', fogN: 50, fogF: 420, card: '#ffe6cc', win: 0.35, lamp: 0.3, sat: 1.14, lift: 0.05, tint: '#fff0e0', stars: 0, sunDisc: 1 },
  night: { sun: '#a9c0ff', si: 1.2, az: 120, el: 38, hs: '#5a7ac4', hg: '#26305a', hi: 1.45, top: '#0c1838', hor: '#2c4a8c', fogN: 40, fogF: 320, card: '#a9bcf0', win: 1.6, lamp: 1.6, sat: 1.05, lift: 0.06, tint: '#c8d6ff', stars: 1, sunDisc: 0 },
  dawn: { sun: '#ffb38a', si: 2.3, az: 210, el: 14, hs: '#ffd4c0', hg: '#7a6a7a', hi: 1.05, top: '#6d8fd0', hor: '#ffc6a8', fogN: 60, fogF: 460, card: '#fff0e8', win: 0.2, lamp: 0.2, sat: 1.12, lift: 0.05, tint: '#fff2ea', stars: 0, sunDisc: 1 },
};
const LT = [[0, 'day'], [30.5, 'day'], [31.6, 'golden'], [36.3, 'golden'], [36.75, 'night'], [52.95, 'night'], [53.1, 'dawn'], [END + 1, 'dawn']];
function lightAt(t) {
  let i = 0; while (i < LT.length - 2 && t >= LT[i + 1][0]) i++;
  const [t0, a] = LT[i], [t1, b] = LT[i + 1]; const u = t1 > t0 ? sstep(t0, t1, t) : 0;
  const A = LP[a], B = LP[b], o = {};
  for (const k in A) { if (typeof A[k] === 'number') o[k] = lerp(A[k], B[k], u); else o[k] = new THREE.Color(A[k]).lerp(new THREE.Color(B[k]), u); }
  return o;
}

// ---------- post (ink + lens + grade) ----------
const post = new THREE.ShaderMaterial({
  uniforms: {
    tC: { value: colorRT.texture }, tN: { value: normalRT.texture }, tD: { value: normalRT.depthTexture },
    res: { value: new THREE.Vector2(W, H) }, near: { value: camera.near }, far: { value: camera.far },
    focus: { value: 5 }, cInf: { value: 0 }, fogC: { value: new THREE.Color() }, fogN: { value: 60 }, fogF: { value: 400 },
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sat: { value: 1.1 }, lift: { value: 0.04 }, tint: { value: new THREE.Color(1, 1, 1) },
    flash: { value: 0 }, stars: { value: 0 }, sunDir: { value: new THREE.Vector3() }, sunDisc: { value: 0 }, sunC: { value: new THREE.Color() },
    invProj: { value: new THREE.Matrix4() }, camW: { value: new THREE.Matrix4() }, ink: { value: 1 }, dbg: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `
    precision highp float; varying vec2 vUv;
    uniform sampler2D tC,tN,tD; uniform vec2 res; uniform float near,far,focus,cInf,fogN,fogF,sat,lift,flash,stars,sunDisc,ink,dbg;
    uniform vec3 fogC,top,hor,tint,sunDir,sunC; uniform mat4 invProj,camW;
    float lin(float d){ return near*far/(far-d*(far-near)); }
    float depthAt(vec2 uv){ return texture2D(tD,uv).x; }
    bool isMask(vec2 uv){ vec3 n=texture2D(tN,uv).rgb; return dot(n,n)<0.02; }
    vec3 viewDir(vec2 uv){ vec4 p=invProj*vec4(uv*2.-1.,1.,1.); p/=p.w; return normalize((camW*vec4(normalize(p.xyz),0.)).xyz); }
    float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    vec3 sky(vec2 uv){ vec3 d=viewDir(uv); float e=d.y; vec3 c=mix(hor,top,smoothstep(-0.02,0.55,e));
      float s=max(dot(d,normalize(sunDir)),0.); c+=sunC*sunDisc*(smoothstep(0.9985,0.9992,s)*1.2+pow(s,40.)*0.35);
      if(stars>0.){ vec3 q=floor(d*420.); float h=hash(q); c+=vec3(1.)*stars*step(0.9975,h)*smoothstep(0.05,0.3,e); }
      return c; }
    vec3 grade(vec3 c){ c=c/(1.0+0.12*max(max(c.r,c.g),c.b)); c*=tint; float l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,sat); c=c*(1.-lift)+lift*vec3(0.55,0.6,0.85)*0.6; return c; }
    vec3 toSRGB(vec3 c){ c=max(c,0.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    void main(){
      vec2 px=1./res; float d=depthAt(vUv); bool skyPx=d>=0.99999; float z=lin(d); bool m=isMask(vUv);
      // lens blur (gather)
      float coc = skyPx ? cInf : cInf*abs(1.-focus/z);
      coc=clamp(coc,0.,22.);
      vec3 col=vec3(0.); float wsum=0.; float inkAmt=0.; vec3 inkCol=vec3(0.);
      if(coc>0.6){
        for(int i=0;i<32;i++){ float fi=float(i); float r=sqrt((fi+.5)/32.)*coc; float a=fi*2.39996;
          vec2 o=vec2(cos(a),sin(a))*r*px; vec2 uv=vUv+o; float dd=depthAt(uv); float zz=lin(dd); float cs= dd>=0.99999?cInf:cInf*abs(1.-focus/zz);
          float w=smoothstep(r-1.5,r+0.5,cs); if(zz>z+0.5 && cs<coc) w*=0.6;
          vec3 sc = dd>=0.99999 ? sky(uv) : texture2D(tC,uv).rgb; col+=sc*w; wsum+=w; }
        col/=max(wsum,1e-3);
      } else col = skyPx ? sky(vUv) : texture2D(tC,vUv).rgb;
      // fog
      if(!skyPx && !m){ float f=smoothstep(fogN,fogF,z)*0.85; col=mix(col,fogC,f); }
      // ink
      if(!skyPx && !m && ink>0.){
        float th=mix(5.1,3.0,smoothstep(6.,90.,z))*res.x/1080.*0.75;
        vec3 n0=texture2D(tN,vUv).rgb*2.-1.; float e=0.;
        for(int k=0;k<8;k++){ float a=float(k)*0.785398; vec2 uv=vUv+vec2(cos(a),sin(a))*th*px; float dd=depthAt(uv);
          if(isMask(uv)) continue;
          float zz= dd>=0.99999 ? far : lin(dd);
          if((zz-z)/z>0.035) e=1.;
          vec3 nn=texture2D(tN,uv).rgb*2.-1.; if(dot(n0,nn)<0.78) e=max(e,0.85); }
        float inkFade=1.-smoothstep(160.,420.,z); vec3 inkC=mix(vec3(0.006,0.005,0.008),fogC*0.4,smoothstep(80.,300.,z));
        inkAmt=e*inkFade*ink*(coc>4.?0.5:1.); inkCol=inkC;
      }
      if(dbg>0.5){ gl_FragColor=vec4(dbg<1.5?texture2D(tN,vUv).rgb:vec3(fract(z/10.)),1.); return; }
      col=grade(col);
      col=mix(col,inkCol*0.6,inkAmt*0.92);
      col=mix(col,vec3(1.),flash);
      vec2 q=vUv-.5; col*=1.-dot(q,q)*0.35;
      gl_FragColor=vec4(toSRGB(col),1.);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene(); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const normalMat = new THREE.MeshNormalMaterial();

// ---------- timing ----------
const T = { flash: 3.95, rust: 5.78, peel: 6.84, news: 7.68, lustig: 10.74, idea: 12.33, print: 13.06, suite: 14.67, hotel: 15.58, invite: 16.48, meet: 18.21, gent: 19.28, torn: 21.8, tons: 22.82, buy: 24.64, luck: 25.95, poisson: 28.35, wants: 28.96, susp: 30.46, why: 31.94, rush: 33.72, so: 34.72, yousee: 36.46, much: 38.44, relax: 39.42, bribe: 40.54, only: 41.22, pays: 43.36, pays2: 44.09, train: 45.34, cash: 47.52, waits: 48.4, never: 49.96, humil: 51.02, back: 53.06, sell: 54.77, again: 55.77 };
const SPEECH = [[19.28, 19.65], [19.39, 20.37], [20.37, 20.86], [20.87, 21.3], [21.58, 22.3], [22.82, 23.6], [23.65, 24.1], [24.64, 25.2], [25.24, 25.6]];
const WHISPER = [[36.46, 36.9], [36.99, 37.5], [37.52, 38.0], [38.05, 38.7]];
function mouthAt(t, spans) { for (const [a, b] of spans) if (t >= a && t <= b) return 0.35 + 0.65 * Math.abs(Math.sin((t - a) * 17)); return 0; }

// ---------- camera keys ----------
// each: [t, pos, look, fov, roll, cut]
const K = [];
function key(t, p, l, fov = 40, roll = 0, cut = false) { K.push({ t, p: V(...p), l: V(...l), fov, roll, cut }); }
// S1 hook — river, tower behind
key(0, [7.5, 9.0, -76], [0, 19.5, -116], 46, 0.03, true);
key(1.98, [3.4, 14.8, -95], [0, 20, -116], 40, 0.06);
key(2.0, [0.15, 1.08, -41.0], [0.15, 4.5, -60], 55, 0, true);
key(3.94, [0.2, 1.1, -42.0], [0.2, 4.0, -60], 50, 0.02);
// S2 Paris 1925 wide → tower rust → follow flake → café
key(3.95, [0, 18, 64], [0, 30, -120], 44, 0, true);
key(5.35, [0, 21, 40], [0, 32, -120], 42);
key(6.2, [9, 25.5, -103], [1, 22.5, -128], 40, 0.06);
key(7.15, [8.2, 24.6, -105.5], [1.6, 21.6, -128], 38, 0.05);
key(9.85, [-9.05, 1.85, 23.4], [-10.6, 1.62, 19.9], 40, 0);
key(12.95, [-9.3, 1.82, 22.9], [-10.6, 1.62, 19.9], 37, 0);
// S4 letterhead stamp
key(13.0, [-9.85, 1.85, 21.75], [-10.5, 1.1, 20.05], 38, 0, true);
key(14.3, [-9.95, 1.8, 21.55], [-10.5, 1.1, 20.05], 35, 0);
// glide to hotel
key(15.4, [-1.0, 4.2, 12], [16, 10, 2], 46, -0.04);
key(16.35, [-1.6, 4.0, 13], [16, 9.5, 2], 45, -0.04);
// dealers arrive, Lustig waits in foreground
key(16.45, [12.0, 2.3, -8.6], [2.4, 1.4, 22], 42, 0, true);
key(19.2, [11.8, 2.25, -8.0], [2.4, 1.4, 22], 40, 0);
// S5 meeting — diagonal over the table
key(19.25, [7.6, 2.25, 7.4], [11.9, 1.85, -2.2], 42, 0, true);
key(20.35, [7.8, 2.22, 6.9], [11.9, 1.85, -2.4], 39);
key(20.37, [10.5, 1.98, -0.6], [11.4, 2.05, -4.6], 42, 0.03, true);
key(21.75, [10.6, 1.98, -1.0], [11.4, 2.05, -4.6], 39, 0.03);
// torn down: Lustig MS
key(21.8, [11.3, 1.98, -1.9], [11.4, 2.08, -4.6], 36, -0.05, true);
key(22.78, [11.3, 1.98, -2.1], [11.4, 2.08, -4.6], 34, -0.05);
// seven thousand tons: dealers shocked
key(22.82, [8.3, 2.0, 2.45], [12.45, 1.8, 2.45], 44, 0, true);
key(24.6, [8.6, 2.0, 2.45], [12.45, 1.8, 2.45], 42);
// one of you will buy it
key(24.64, [11.3, 1.98, -1.2], [11.4, 2.05, -4.6], 40, 0, true);
key(25.86, [11.3, 1.98, -2.0], [11.4, 2.05, -4.6], 36, 0.03);
// S6 dealers can't believe their luck → Poisson
key(25.9, [7.6, 2.05, 2.4], [12.45, 1.8, 2.4], 46, 0, true);
key(27.8, [7.9, 2.05, 2.3], [12.45, 1.8, 2.3], 45);
key(28.7, [10.1, 1.95, 1.8], [12.45, 1.85, 1.8], 38, -0.03);
key(30.4, [10.25, 1.93, 1.8], [12.45, 1.85, 1.8], 35, -0.03);
// S7 suspicious close
key(30.45, [10.55, 1.98, 1.55], [12.45, 1.92, 1.8], 33, -0.07, true);
key(34.68, [10.8, 1.98, 1.6], [12.45, 1.92, 1.8], 29, -0.08);
// S8 whisper two-shot through the balustrade
key(34.72, [6.6, 1.95, 1.38], [12.45, 1.85, 1.38], 31, 0, true);
key(36.4, [6.9, 1.93, 1.38], [12.45, 1.85, 1.38], 30);
key(39.38, [7.3, 1.92, 1.38], [12.45, 1.88, 1.38], 29, 0.02);
// S9 Poisson relaxes, bribe
key(39.42, [7.4, 1.92, 1.42], [12.45, 1.85, 1.42], 34, 0, true);
key(43.3, [7.8, 1.9, 1.42], [12.45, 1.85, 1.42], 31, 0.02);
// S10 pays (two-shot), then train
key(43.34, [6.8, 2.0, 1.38], [12.45, 1.8, 1.38], 31, 0, true);
key(45.3, [7.1, 1.98, 1.38], [12.45, 1.8, 1.38], 30);
key(45.34, [TRAIN.x - 9.5, 3.0, 8.5], [TRAIN.x - 12, 2.6, 0], 40, 0, true);
key(48.36, [TRAIN.x + 21.5, 3.0, 8.2], [TRAIN.x + 19.6, 2.6, 0], 36, 0);
// S11 waits on platform, never come (pan), Poisson humiliated
key(48.4, [TRAIN.x + 60.4, 2.5, 12.6], [TRAIN.x + 58.8, 1.75, 6.6], 38, 0, true);
key(49.9, [TRAIN.x + 60.1, 2.45, 11.9], [TRAIN.x + 58.8, 1.75, 6.6], 35);
key(50.95, [TRAIN.x + 62.5, 2.35, 12.8], [TRAIN.x + 72, 1.3, 5.6], 40, 0.02);
key(51.0, [10.3, 1.98, 1.65], [12.45, 1.85, 1.8], 36, 0, true);
key(53.0, [10.6, 1.95, 1.7], [12.45, 1.85, 1.8], 31, -0.03);
// S12 dawn, back to Paris
key(53.06, [0.5, 1.15, -38.6], [0.3, 4.4, -60], 54, 0, true);
key(54.7, [0.3, 1.12, -40.3], [0.2, 4.2, -60], 52);
key(56.9, [0.1, 1.1, -42.2], [0.05, 3.3, -60], 46, 0.02);

const KICKS = [[13.42, 0.05], [21.8, 0.04], [22.82, 0.05], [12.33, 0.025], [40.54, 0.03], [55.77, 0.03], [45.34, 0.03]];
const FLAKE_A = V(2.4, 22.3, -112), FLAKE_B = V(-10.55, 1.5, 20.1);
function flakePos(t) { const u = smoother(clamp((t - 7.15) / (9.85 - 7.15))); const p = FLAKE_A.clone().lerp(FLAKE_B, u); p.x += Math.sin(t * 5) * 0.8 * (1 - u); p.y += Math.sin(u * Math.PI) * 6; return p; }

function camAt(t) {
  let i = 0; while (i < K.length - 1 && K[i + 1].t <= t) i++;
  const a = K[i], b = K[i + 1];
  let p, l, fov, roll;
  if (!b || b.cut) { p = a.p.clone(); l = a.l.clone(); fov = a.fov; roll = a.roll; }
  else { const u = smoother(clamp((t - a.t) / (b.t - a.t))); p = a.p.clone().lerp(b.p, u); l = a.l.clone().lerp(b.l, u); fov = lerp(a.fov, b.fov, u); roll = lerp(a.roll, b.roll, u); }
  if (t >= 45.34 && t < 48.4) { const cx = TRAIN.x - 12.06 + (t - 45.34) * 10.5; const u = (t - 45.34) / 3.06; p = V(cx + 2.6 - u * 2.2, 2.9 + Math.sin(t * 2) * 0.05, 6.4 - u * 0.8); l = V(cx + 0.2, 2.55, 0); fov = 38 - u * 4; roll = 0.03; }
  if (t >= 7.15 && t < 9.85) { const fp = flakePos(t + 0.25); const w = sstep(7.15, 7.6, t) * (1 - sstep(9.4, 9.85, t)); l.lerp(fp, w); }
  const fr = Math.round(t * FPS);
  for (const [kt, A] of KICKS) { const k = fr - Math.round(kt * FPS); if (k >= 0 && k < 7) { const s = (k % 2 ? -1 : 1) * A * (1 - k / 7); p.y += s; p.x += s * 0.6; } }
  return { p, l, fov, roll };
}

// ---------- stage: who stands where, what they do ----------
const H0 = 0.5, SW = 0.18; // terrace / sidewalk heights
function stage(t) {
  const st = {}; const out = {};
  const L = (o) => (st.lustig = o), Po = (o) => (st.poisson = o);
  const ROW = { d1: 5.0, d2: 3.0, d3: 0.6, d4: -0.8, d5: -2.2 };
  const dealersAtTable = (exprFn, skip = []) => {
    for (const k in ROW) if (!skip.includes(k)) st[k] = { p: [12.45, H0, ROW[k]], ...(exprFn ? exprFn(k) : { expr: 'neutral' }) };
    Po({ p: [12.45, H0, 1.8], ...(exprFn ? exprFn('poisson') : { expr: 'neutral' }) });
  };
  if (t < T.flash) { // hook: SOLD tag on the tower, then the deal
    L({ p: [-0.5, 0, -46.6], expr: t < 3.0 ? 'sly' : 'wink', pose: 'paper' });
    Po({ p: [0.8, 0, -46.3], expr: t < 3.0 ? 'happy' : 'grin', pose: 'give', flip: true });
  } else if (t < 10.7) {
    st.d1 = { p: [-6, 0, 30 - (t - 4) * 1.2], walk: 9, expr: 'neutral' }; st.d3 = { p: [5, 0, 18 + (t - 4) * 1.1], walk: 9, expr: 'neutral' };
    L({ p: [-10.6, SW + 0.3, 19.9], sit: 1, pose: 'newsUp', expr: 'neutral' });
  } else if (t < 13.0) { // café reading → idea
    L({ p: [-10.6, SW + 0.3, 19.9], sit: 1, pose: t < 10.85 ? 'newsUp' : 'news', expr: t < T.idea ? 'neutral' : 'sly', gaze: t < T.idea ? -1 : 0 });
  } else if (t < 14.35) { // stamp
    L({ p: [-10.6, SW + 0.3, 19.9], sit: 1, pose: t < 13.35 ? 'stampUp' : 'stamp', expr: 'sly' });
  } else if (t < 16.45) { // hotel glide
    L({ p: [11.4, H0, -4.6], pose: 'idle', expr: 'smug' });
  } else if (t < 19.25) { // dealers arrive
    const names = ['d1', 'd2', 'd3', 'poisson', 'd4', 'd5'];
    names.forEach((n, i) => { const u = clamp((t - 16.5 - i * 0.18) / 2.5); const z = lerp(30 + i * 2.2, 9 + i * 0.6, smoother(u)); const x = lerp(2.5 + (i % 2) * 2.2, 7.6 + (i % 3) * 0.3, smoother(clamp((u - 0.55) / 0.45))); st[n] = { p: [x, 0, z], walk: u < 1 ? 10 : 0, expr: 'neutral' }; });
    L({ p: [10.2, H0, -4.0], pose: t > 18.0 ? 'present' : 'idle', expr: 'smug' });
  } else if (t < 25.88) { // meeting, Lustig talks
    dealersAtTable(k => ({ expr: t > T.tons - 0.05 ? 'wow' : 'neutral' }));
    const pose = t < 21.6 ? 'present' : (t < 22.7 ? 'fist' : (t < 24.6 ? 'present' : 'point'));
    L({ p: [11.4, H0, -4.6], pose, expr: t > T.torn - 0.1 && t < 22.7 ? 'angry' : 'smug', mouth: mouthAt(t, SPEECH) });
  } else if (t < 30.45) { // can't believe their luck
    dealersAtTable(k => ({ expr: k === 'poisson' && t > T.wants ? 'grin' : 'happy', pose: k === 'poisson' && t > T.wants ? 'rub' : (k === 'd2' || k === 'd3' ? 'cheer' : 'idle') }));
    L({ p: [11.4, H0, -4.6], pose: 'idle', expr: 'smug' });
  } else if (t < 34.7) { // suspicious
    dealersAtTable(k => ({ expr: k === 'poisson' ? 'suspicious' : 'neutral', gaze: k === 'poisson' ? -1 : 0 }));
    L({ p: [11.4, H0, -4.6], pose: 'watch', expr: 'neutral' });
  } else if (t < 39.42) { // whisper
    dealersAtTable(k => ({ expr: k === 'poisson' ? (t < T.yousee ? 'suspicious' : 'wow') : 'neutral' }), ['d3', 'd4']);
    L({ p: [12.45, H0, 0.95], pose: 'whisper', expr: t < T.yousee ? 'sly' : 'smug', lean: -0.13, mouth: mouthAt(t, WHISPER) * 0.5 });
  } else if (t < 43.34) { // relax, bribe
    dealersAtTable(k => ({ expr: k === 'poisson' ? (t < T.bribe ? 'relief' : 'happy') : 'neutral' }), ['d3', 'd4']);
    L({ p: [12.45, H0, 0.95], pose: t > T.bribe ? 'envelope' : 'idle', expr: 'smug', lean: -0.05 });
  } else if (t < 45.34) { // pays
    dealersAtTable(k => ({ expr: k === 'poisson' ? 'happy' : 'neutral', pose: k === 'poisson' ? 'give' : 'idle', flip: k === 'poisson' }), ['d3', 'd4']);
    L({ p: [12.45, H0, 0.95], pose: t > T.pays2 ? 'envelope' : 'give', expr: 'grin' });
  } else if (t < 48.4) { // train (Lustig shown in the window card)
  } else if (t < 51.0) { // waits on suitcase
    L({ p: [TRAIN.x + 58.8, 0.9, 6.75], sit: 1, pose: 'watch', expr: t < T.never ? 'neutral' : 'smug' });
  } else if (t < 53.06) { // humiliated
    Po({ p: [12.45, H0, 1.8], expr: 'embarrassed', pose: 'hide' });
    st.d2 = { p: [12.45, H0, 3.0], expr: 'neutral' };
  } else { // dawn, back again
    const u = clamp((t - 53.06) / 1.6);
    L({ p: [lerp(-2.2, -0.25, smoother(u)), 0, -46.6], walk: u < 1 ? 10 : 0, pose: t > T.sell - 0.1 ? 'present' : 'idle', expr: t > T.again - 0.05 ? 'wink' : 'smug' });
    out.e1 = { p: [0.75, 0, -47.0], expr: 'wow' }; out.e2 = { p: [1.45, 0, -47.5], expr: 'wow' }; out.e3 = { p: [2.05, 0, -48.0], expr: 'happy' };
  }
  return { st, out };
}

function fxAt(t, cam) {
  fxList.forEach(m => (m.visible = false));
  const face = (m) => { m.quaternion.copy(cam.quaternion); };
  const pop = (t0) => { const u = clamp((t - t0) / 0.22); return u < 1 ? smoother(u) * 1.25 - Math.max(0, u - 0.7) * 0.8 : 1.0; };
  // clouds by day
  clouds.forEach(c => { c.visible = t < 36.6 || t > 53.0; c.quaternion.copy(cam.quaternion); });
  // moon at night
  if (t > 36.5 && t < 53.0) { FX.moon.visible = true; const d = new THREE.Vector3(); cam.getWorldDirection(d); FX.moon.position.copy(cam.position).add(d.multiplyScalar(300)).add(V(60, 110, 0)); face(FX.moon); }
  if (t > T.idea - 0.05 && t < 13.0) { FX.bulb.visible = true; FX.bulb.position.set(-10.22, 2.16, 20.0); face(FX.bulb); FX.bulb.scale.setScalar(pop(T.idea) * 0.5); }
  if (t > 6.6 && t < 9.9) { FX.flake.visible = true; FX.flake.position.copy(flakePos(t)); face(FX.flake); FX.flake.rotateZ(t * 4); }
  if (t > T.hotel && t < 16.4) { FX.spark.visible = true; FX.spark.position.set(14.6, 18.6, 1.0); face(FX.spark); FX.spark.scale.setScalar(pop(T.hotel) * 3.5); FX.spark.rotateZ(t * 2); }
  if (t > 26.2 && t < 28.5) { FX.spark.visible = true; FX.spark.position.set(12.35, 2.95, 3.0); face(FX.spark); FX.spark.scale.setScalar(pop(26.2) * 0.8); FX.spark2.visible = true; FX.spark2.position.set(12.35, 2.9, 1.8); face(FX.spark2); FX.spark2.scale.setScalar(pop(26.5)); }
  if (t > T.why && t < 34.7) { FX.q.visible = true; FX.q.position.set(12.4, 3.1, 1.85); face(FX.q); FX.q.scale.setScalar(pop(T.why) * (1 + Math.sin(t * 6) * 0.04)); }
  if (t > T.cash - 0.1 && t < 48.4) { flashMoney.forEach((m, i) => { m.visible = true; const u = (t - T.cash) * 1.5 + i * 0.13; m.position.set(trainGroup.position.x - 21.06 + 0.5 - u * 1.6 + i * 0.22, 3.0 + u * 0.8 + Math.sin(i * 2 + t * 6) * 0.15, 1.9); face(m); m.rotateZ(t * 3 + i); }); }
  if (t < T.flash || t > 53.0) { tagMesh.visible = true; tagRope.visible = true; tagMesh.material.map = t > 53.0 ? tagForSale : tagSold; tagMesh.rotation.z = Math.sin(t * 2.2) * 0.05; tagMesh.rotation.y = Math.sin(t * 1.3) * 0.12; } else tagRope.visible = false;
  if (t >= 45.34 && t < 48.4) { winCard.visible = true; }
  if (t > 49.9 && t < 51.0) { FX.cat.visible = true; FX.cat.position.set(TRAIN.x + 76 - (t - 49.9) * 3.2, 1.25, 6.2); face(FX.cat); }
  if (t > T.again - 0.05) { FX.spark2.visible = true; FX.spark2.position.set(-0.05, 2.0, -46.4); face(FX.spark2); FX.spark2.scale.setScalar(pop(T.again) * 0.8); }
}

// focus & DOF per time
function dofAt(t) {
  const W2 = (x, y, z) => V(x, y, z);
  if (t < 2.0) return [W2(0, 20, -116), 0];
  if (t < T.flash) return [W2(0.15, 1.6, -46.4), 13];
  if (t < 9.85) return [W2(0, 0, -200), 0];
  if (t < 13.0) return [W2(-10.6, 1.5, 19.9), 13];
  if (t < 14.35) return [W2(-10.5, 1.1, 20.1), 13];
  if (t < 16.45) return [W2(0, 0, 0), 0];
  if (t < 19.25) return [W2(10.2, 2.0, -4.0), 6];
  if (t < 20.37) return [W2(11.4, 2.0, -4.6), 6];
  if (t < 21.8) return [W2(11.4, 2.0, -4.6), 11];
  if (t < 22.82) return [W2(11.4, 2.0, -4.6), 12];
  if (t < 24.64) return [W2(12.45, 1.9, 2.4), 10];
  if (t < 25.88) return [W2(11.4, 2.0, -4.6), 12];
  if (t < 28.6) return [W2(12.45, 1.8, 2.4), 7];
  if (t < 34.7) return [W2(12.45, 1.9, 1.8), 14];
  if (t < 39.42) return [W2(12.45, 1.9, 1.3), 12];
  if (t < 43.34) return [W2(12.45, 1.9, 1.6), 13];
  if (t < 45.34) return [W2(12.45, 1.8, 1.3), 10];
  if (t < 48.4) return [V(TRAIN.x - 12.06 + (t - 45.34) * 10.5, 2.5, 1.4), 10];
  if (t < 51.0) return [W2(TRAIN.x + 58.8, 1.7, 6.75), 11];
  if (t < 53.06) return [W2(12.45, 1.9, 1.8), 15];
  return [W2(0.2, 1.6, -46.8), 9];
}

// ---------- render ----------
const tmpDir = new THREE.Vector3();
function renderAt(time) {
  const t = Math.min(toOld(Math.min(Math.max(time, 0), END_NEW - 1e-3)), END - 1e-3);
  const L = lightAt(t);
  // camera
  const c = camAt(t); camera.position.copy(c.p); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0); camera.lookAt(c.l); camera.updateMatrixWorld();
  // train
  trainGroup.visible = t >= 45.3 && t < 48.4;
  trainGroup.position.set(TRAIN.x + (t < 45.34 ? -60 : -12 + (t - 45.34) * 10.5 + 21), 0, 0);
  letter.material.map = t > 13.4 ? letterStamped : letterBlank;
  // stage
  const { st, out } = stage(t);
  for (const k in C) C[k].set(t, st[k] || null);
  for (const k in C2) C2[k].set(t, out[k] || null);
  // card tint
  for (const cd of [...Object.values(C), ...Object.values(C2)]) cd.mat.color.copy(L.card);
  fxAt(t, camera);
  // lights
  sun.color.copy(L.sun); sun.intensity = L.si; hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi;
  const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
  const sdir = V(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const [fp, coc] = dofAt(t);
  const center = (fp ? fp.clone() : c.l.clone()); if (!fp) center.copy(c.p).add(tmpDir.copy(c.l).sub(c.p).normalize().multiplyScalar(14));
  if (center.distanceTo(c.p) > 60) center.copy(c.p).add(tmpDir.copy(c.l).sub(c.p).normalize().multiplyScalar(30));
  sun.target.position.copy(center); sun.position.copy(center).add(sdir.clone().multiplyScalar(120)); sun.target.updateMatrixWorld();
  const big = c.p.y > 10 || t < 0; sc.left = sc.bottom = big ? -90 : -26; sc.right = sc.top = big ? 90 : 26; sc.updateProjectionMatrix();
  nightEmissive.forEach(m => (m.emissiveIntensity = L.win));
  mats.lamp.emissiveIntensity = L.lamp * 1.5; lampLights.forEach(l => (l.intensity = L.lamp * 40));
  mats.water.emissive.copy(L.hor).multiplyScalar(0.25);
  // post uniforms
  const u = post.uniforms; u.focus.value = fp ? fp.distanceTo(c.p) : c.l.distanceTo(c.p); u.cInf.value = coc * W / 1080;
  u.fogC.value.copy(L.hor); u.fogN.value = L.fogN; u.fogF.value = L.fogF; u.top.value.copy(L.top); u.hor.value.copy(L.hor);
  u.sat.value = L.sat; u.lift.value = L.lift; u.tint.value.copy(L.tint); u.stars.value = L.stars; u.sunDir.value.copy(sdir); u.sunDisc.value = L.sunDisc; u.sunC.value.copy(L.sun);
  u.invProj.value.copy(camera.projectionMatrixInverse); u.camW.value.copy(camera.matrixWorld);
  u.dbg.value = window.__dbg || 0;
  const fr = Math.round(t * FPS), ff = Math.round(T.flash * FPS); u.flash.value = fr >= ff && fr < ff + 4 ? (1 - (fr - ff) / 4) * 0.9 : 0;
  // pass 1: normals + depth (world + mask for cards/fx)
  const swaps = [];
  worldMeshes.forEach(m => { swaps.push([m, m.material]); m.material = normalMat; });
  for (const cd of [...Object.values(C), ...Object.values(C2)]) { swaps.push([cd.mesh, cd.mesh.material]); cd.mesh.material = cd.mask; cd.blob.visible = false; }
  fxList.forEach(m => { swaps.push([m, m.material]); m.material = m.userData.mask; });
  renderer.setRenderTarget(normalRT); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
  swaps.forEach(([m, mat]) => (m.material = mat));
  for (const cd of [...Object.values(C), ...Object.values(C2)]) cd.blob.visible = cd.g.visible && !cd.mesh.userData.noBlob;
  // pass 2: colour with shadows
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(colorRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass 3: post to screen
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}

window.__renderAt = renderAt;
window.addEventListener('hf-seek', e => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
