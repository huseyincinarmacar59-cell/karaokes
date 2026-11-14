import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- veriler
const ITEMS = {
  wheat:  { n: 'Buğday',   e: '🌾', p: 3 },
  corn:   { n: 'Mısır',    e: '🌽', p: 6 },
  carrot: { n: 'Havuç',    e: '🥕', p: 10 },
  egg:    { n: 'Yumurta',  e: '🥚', p: 12 },
  milk:   { n: 'Süt',      e: '🥛', p: 18 },
  bread:  { n: 'Ekmek',    e: '🍞', p: 22 },
  butter: { n: 'Tereyağı', e: '🧈', p: 45 },
  cheese: { n: 'Peynir',   e: '🧀', p: 60 },
  cake:   { n: 'Kek',      e: '🍰', p: 95 },
};
const CROPS = {
  wheat:  { cost: 2, time: 20, xp: 1, lvl: 1, color: 0xffd23f },
  corn:   { cost: 4, time: 45, xp: 2, lvl: 2, color: 0xffe14a },
  carrot: { cost: 7, time: 90, xp: 3, lvl: 3, color: 0xff8a2c },
};
const PENS = {
  coop: { n: 'Kümes', e: '🐔', lvl: 1, cost: 0,   feed: { wheat: 3 }, time: 60,  out: 'egg',  qty: 3, xp: 4 },
  cow:  { n: 'Ahır',  e: '🐄', lvl: 3, cost: 150, feed: { corn: 2 },  time: 120, out: 'milk', qty: 2, xp: 6 },
};
const BLDS = {
  bakery: { n: 'Fırın', e: '🍞', lvl: 2, cost: 100, recipes: {
    bread: { in: { wheat: 3 }, time: 40, xp: 4, lvl: 2 },
    cake:  { in: { wheat: 2, egg: 2, milk: 1 }, time: 120, xp: 14, lvl: 4 } } },
  dairy: { n: 'Mandıra', e: '🧀', lvl: 4, cost: 300, recipes: {
    butter: { in: { milk: 1 }, time: 60, xp: 8, lvl: 4 },
    cheese: { in: { milk: 2 }, time: 90, xp: 11, lvl: 5 } } },
};
const COLS = 4, ROWS = 3, FREE_PLOTS = 6;
const SAVE_KEY = 'bereket_ciftligi_v1';

// ---------------------------------------------------------------- durum
function freshState() {
  const plots = [];
  for (let i = 0; i < COLS * ROWS; i++) plots.push({ open: i < FREE_PLOTS, crop: null, t0: 0 });
  return {
    coins: 30, xp: 0, level: 1, cap: 50, capLvl: 1, inv: { wheat: 4 }, plots,
    pens: { coop: { built: true, t0: 0 }, cow: { built: false, t0: 0 } },
    blds: { bakery: { built: false, rec: null, t0: 0 }, dairy: { built: false, rec: null, t0: 0 } },
    orders: [], px: 0, pz: 7,
  };
}
let S = freshState();
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (raw && raw.plots && raw.plots.length === COLS * ROWS) S = Object.assign(freshState(), raw);
} catch (e) { /* kayıt yoksa yeni oyun */ }
function save() {
  S.px = player.position.x; S.pz = player.position.z;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* özel sekme */ }
}

const now = () => Date.now() / 1000;
const $ = (id) => document.getElementById(id);
const invCount = () => Object.values(S.inv).reduce((a, b) => a + b, 0);
const have = (k) => S.inv[k] || 0;
const hasAll = (req) => Object.entries(req).every(([k, v]) => have(k) >= v);
const takeAll = (req) => { for (const [k, v] of Object.entries(req)) { S.inv[k] -= v; if (S.inv[k] <= 0) delete S.inv[k]; } };
const reqText = (req) => Object.entries(req).map(([k, v]) => `${v} ${ITEMS[k].e}`).join(' + ');
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const xpNeed = (l) => 15 * l * l + 15;

function addItem(k, n) {
  if (invCount() + n > S.cap) { toast('📦 Ambar dolu! Bir şeyler sat ya da ambarı büyüt.'); return false; }
  S.inv[k] = have(k) + n; return true;
}
function addXp(n) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    toast(`⭐ Seviye ${S.level} oldun!`);
    const news = [];
    for (const [k, c] of Object.entries(CROPS)) if (c.lvl === S.level) news.push(ITEMS[k].n);
    for (const p of Object.values(PENS)) if (p.lvl === S.level) news.push(p.n);
    for (const b of Object.values(BLDS)) {
      if (b.lvl === S.level) news.push(b.n);
      for (const [k, r] of Object.entries(b.recipes)) if (r.lvl === S.level && b.lvl !== S.level) news.push(ITEMS[k].n);
    }
    if (news.length) toast('🔓 Açıldı: ' + news.join(', '));
  }
}
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  $('toasts').appendChild(d);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => d.remove(), 2800);
}
function refreshHud() {
  $('lvlNo').textContent = S.level;
  $('coins').textContent = S.coins;
  $('store').textContent = `${invCount()}/${S.cap}`;
  $('xpfill').style.width = Math.min(100, (S.xp / xpNeed(S.level)) * 100) + '%';
}

// ---------------------------------------------------------------- sahne
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee4fb);
scene.fog = new THREE.Fog(0xaee4fb, 50, 100);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe6a0, 1.9));
const sun = new THREE.DirectionalLight(0xfff4dc, 1.7);
sun.position.set(18, 30, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
scene.add(sun, sun.target);

// yumuşak çizgi film gölgelendirmesi
const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 240, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const toon = (c, extra) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: ramp }, extra));
const mats = {};
const mat = (c) => mats[c] || (mats[c] = toon(c));
function mesh(geo, color, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const geos = {};
function box(w, h, d, c, x, y, z, p, r) { // yuvarlak köşeli kutu
  const rad = Math.min(r === undefined ? 0.22 : r, Math.min(w, h, d) * 0.48), k = `${w},${h},${d},${rad}`;
  return mesh(geos[k] || (geos[k] = new RoundedBoxGeometry(w, h, d, 3, rad)), c, x, y, z, p);
}
const cyl = (r1, r2, h, c, x, y, z, p, seg = 18) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), c, x, y, z, p);
const ballGeo = new THREE.SphereGeometry(1, 20, 14);
function ball(r, c, x, y, z, p) { const m = mesh(ballGeo, c, x, y, z, p); m.scale.setScalar(r); return m; }
const cap = (r, len, c, x, y, z, p) => mesh(new THREE.CapsuleGeometry(r, len, 6, 12), c, x, y, z, p);
function group(x, z, parent = scene) { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); return g; }
const domeGeo = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
function roof(w, h, d, c, y, p) { // tombul kubbe çatı
  box(w + 0.7, 0.35, d + 0.7, c, 0, y + 0.05, 0, p, 0.17);
  const m = mesh(domeGeo, c, 0, y + 0.15, 0, p); m.scale.set(w * 1.12, h * 1.7, d * 1.12); return m;
}
function eyes(p, y, z, gap, r = 0.07) {
  for (const x of [-gap, gap]) { ball(r, 0x2a2018, x, y, z, p).castShadow = false; ball(r * 0.4, 0xffffff, x + r * 0.3, y + r * 0.35, z + r * 0.75, p).castShadow = false; }
}

// zemin, yollar, dere
const ground = mesh(new THREE.PlaneGeometry(220, 220), 0x9bd96a, 0, 0, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
function flat(w, d, c, x, z, y = 0.02) { const m = mesh(new THREE.PlaneGeometry(w, d), c, x, y, z); m.rotation.x = -Math.PI / 2; m.castShadow = false; return m; }
flat(3, 20, 0xf0d9a0, 0, 10.5);         // evden kapıya ana yol
flat(34, 2.4, 0xf0d9a0, 0, 4.6, 0.025);   // ağıllar ile atölyeler arası yol
flat(70, 4, 0xe6c88c, 0, 23, 0.02);   // köy yolu
flat(7, 80, 0x6fd0f5, 31, 0, 0.03);   // dere
flat(9, 80, 0xf7e9b8, 31, 0, 0.015);  // kumsal
const dock = group(27.5, 6); box(5, 0.3, 2, 0xd9a86a, 0, 0.45, 0, dock);
for (const dx of [-2, 2]) for (const dz of [-0.8, 0.8]) cap(0.14, 0.8, 0xb9794a, dx, 0.3, dz, dock);

const colliders = []; // {x,z,r}
function tree(x, z, s = 1) {
  const g = group(x, z); g.scale.setScalar(s);
  cyl(0.28, 0.42, 1.7, 0xa9774a, 0, 0.85, 0, g);
  const fruit = Math.random() < 0.5;
  [[0, 2.7, 0, 1.45, 0x6cc85a], [0.9, 2.3, 0.3, 1.0, 0x5dbb4e], [-0.9, 2.4, -0.2, 1.05, 0x7fd66a], [0.1, 3.6, 0.1, 0.95, 0x7fd66a], [-0.2, 2.3, 0.9, 0.9, 0x5dbb4e]]
    .forEach(([a, b2, c, r, col]) => ball(r, col, a, b2, c, g));
  if (fruit) [[0.9, 2.9, 1.0], [-0.7, 3.2, 0.9], [1.3, 2.2, 0.4], [-1.2, 2.1, 0.6], [0.2, 2.0, 1.4]].forEach(([a, b2, c]) => ball(0.17, 0xf0564a, a, b2, c, g));
  colliders.push({ x, z, r: 0.6 * s });
}
function bush(x, z, s = 1) {
  const g = group(x, z); g.scale.setScalar(s);
  ball(0.7, 0x6cc85a, 0, 0.5, 0, g); ball(0.5, 0x7fd66a, 0.55, 0.4, 0.1, g); ball(0.45, 0x5dbb4e, -0.5, 0.35, 0.2, g);
}
function flower(x, z, col) {
  const g = group(x, z);
  cyl(0.03, 0.03, 0.35, 0x5dbb4e, 0, 0.17, 0, g, 5).castShadow = false;
  for (let i = 0; i < 5; i++) ball(0.09, col, Math.cos(i * 1.257) * 0.1, 0.38, Math.sin(i * 1.257) * 0.1, g).castShadow = false;
  ball(0.07, 0xffe36a, 0, 0.4, 0, g).castShadow = false;
}
function rock(x, z, s) { const m = ball(s, 0xcfd3d8, x, s * 0.45, z); m.scale.set(s * 1.3, s * 0.8, s); }
{ // rastgele ama sabit süsler
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = [0xff8fb3, 0xffffff, 0xffd24a, 0xc79bff, 0xff7a6a];
  const busy = (x, z) => (Math.abs(x) < 8 && z > -11 && z < 0) || Math.abs(x) < 2.2 || (Math.abs(z - 4.6) < 1.8) ||
    (x < -11 && x > -21 && z > -11 && z < 17) || (x > 13 && z > -10 && z < 16 && x < 21) || (z < -11 && Math.abs(x) < 14) || (x > 26 && x < 36) || (z > 20.5 && z < 25.5);
  for (let i = 0; i < 150; i++) { const x = rnd() * 76 - 38, z = rnd() * 66 - 30; if (!busy(x, z)) flower(x, z, cols[i % 5]); }
  for (let i = 0; i < 26; i++) { const x = rnd() * 76 - 38, z = rnd() * 66 - 30; if (!busy(x, z) && (Math.abs(x) > 22 || Math.abs(z) > 18)) bush(x, z, 0.8 + rnd() * 0.6); }
  for (let i = 0; i < 14; i++) { const x = rnd() * 76 - 38, z = rnd() * 66 - 30; if (!busy(x, z)) rock(x, z, 0.25 + rnd() * 0.3); }
  for (let i = 0; i < 16; i++) { const m = flat(1, 1, 0xa8e274, rnd() * 70 - 35, rnd() * 60 - 28, 0.012); m.geometry = new THREE.CircleGeometry(1.5 + rnd() * 2.5, 20); }
}
const clouds = [];
for (let i = 0; i < 9; i++) {
  const g = group(-60 + i * 15, -40 + ((i * 37) % 80)); g.position.y = 20 + (i % 3) * 4;
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  [[0, 0, 0, 2.6], [2.4, -0.3, 0.3, 1.9], [-2.3, -0.4, 0, 1.8], [0.8, 0.9, -0.4, 1.8]].forEach(([a, b2, c, r]) => { const m = ball(r, cm, a, b2, c, g); m.castShadow = m.receiveShadow = false; });
  clouds.push(g);
}
[[-21, -17, 1.2], [-17, -19, 1], [20, -18, 1.3], [16, -19.5, .9], [-22, 17, 1.1], [22, 17, 1], [-23, 4, 1.2], [23, -9, 1],
 [-27, -8, 1.4], [-28, 10, 1.2], [9, -19, 1], [-4, 27, 1.2], [12, 28, 1.3], [-16, 28, 1], [24, 27, 1.1], [36, -12, 1.3], [37, 8, 1.1], [36, 22, 1.2]]
  .forEach(([x, z, s]) => tree(x, z, s));

// sınır çiti (güney tarafta kapı boşluğu)
const BX = 24.5, BZ = 20.5;
function fence(x1, z1, x2, z2, c = 0xfff6e0) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.6));
  const g = group((x1 + x2) / 2, (z1 + z2) / 2); g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  for (const y of [0.45, 0.85]) box(len, 0.13, 0.1, c, 0, y, 0, g);
  for (let i = 0; i <= n; i++) cap(0.1, 0.9, c, -len / 2 + (len * i) / n, 0.55, 0, g);
}
fence(-BX, -BZ, BX, -BZ); fence(-BX, -BZ, -BX, BZ); fence(BX, -BZ, BX, BZ);
fence(-BX, BZ, -2.5, BZ); fence(2.5, BZ, BX, BZ);

// çiftlik evi
{
  const g = group(0, -15);
  box(7, 3.4, 5, 0xfff1cf, 0, 1.7, 0, g, 0.7); roof(7, 2.4, 5, 0xff7d6a, 3.3, g);
  box(1.3, 2.1, 0.3, 0xb9794a, 0, 1.05, 2.42, g, 0.6); ball(0.08, 0xffd24a, 0.4, 1.05, 2.6, g);
  for (const x of [-2.2, 2.2]) {
    box(1.4, 1.3, 0.3, 0xffffff, x, 2, 2.4, g, 0.5); box(1.05, 0.95, 0.3, 0x9be0ff, x, 2, 2.46, g, 0.4); box(1.5, 0.3, 0.5, 0xb9794a, x, 1.25, 2.6, g);
    [0xff8fb3, 0xffd24a, 0xff7a6a].forEach((col, q) => ball(0.16, col, x + (q - 1) * 0.4, 1.5, 2.65, g));
  }
  box(0.9, 1.6, 0.9, 0xe8a58a, 2, 5.6, -0.8, g);
  box(3.2, 0.25, 1.6, 0xd9a86a, 0, 0.12, 3.2, g);
  colliders.push({ x: -2, z: -15, r: 3 }, { x: 2, z: -15, r: 3 });
}
// ambar + silo
{
  const g = group(-10, -14.5);
  box(5, 3.2, 4.4, 0xf2665a, 0, 1.6, 0, g, 0.6); roof(5, 2.1, 4.4, 0xfff1cf, 3.1, g);
  box(2.1, 2.3, 0.3, 0xfff1cf, 0, 1.15, 2.12, g, 0.4); box(1.7, 1.9, 0.3, 0xd9544a, 0, 1.15, 2.18, g, 0.3);
  cyl(1.2, 1.2, 4.5, 0xeef2f5, 4.2, 2.25, 0, g, 24); const sd = mesh(domeGeo, 0xf2665a, 4.2, 4.5, 0, g); sd.scale.set(2.6, 2.2, 2.6);
  for (const y of [1.2, 2.4, 3.6]) cyl(1.23, 1.23, 0.12, 0xcfd6dc, 4.2, y, 0, g, 24);
  colliders.push({ x: -10, z: -14.5, r: 3.1 }, { x: -5.8, z: -14.5, r: 1.5 });
}

// ---------------------------------------------------------------- etkileşim listesi
const things = []; // {x,z,r,h,label(),action()}

// tarlalar
const plotMeshes = [];
const PLANT = {
  wheat:  { stem: 1.0, hy: 1.05, hs: [0.13, 0.3, 0.13] },
  corn:   { stem: 1.4, hy: 0.85, hs: [0.16, 0.34, 0.16] },
  carrot: { stem: 0.45, hy: 0.1, hs: [0.2, 0.24, 0.2] },
};
for (let i = 0; i < COLS * ROWS; i++) {
  const c = i % COLS, r = Math.floor(i / COLS);
  const x = (c - 1.5) * 3, z = -8 + r * 3;
  const g = group(x, z);
  const soil = box(2.6, 0.3, 2.6, toon(0xb5784a), 0, 0.08, 0, g, 0.15);
  const furrows = new THREE.Group(); g.add(furrows);
  for (const fx of [-0.75, 0, 0.75]) { const f = cap(0.2, 1.9, 0x9a6238, fx, 0.2, 0, furrows); f.rotation.x = Math.PI / 2; f.castShadow = false; }
  const plants = new THREE.Group(); g.add(plants);
  for (let a = 0; a < 9; a++) {
    const pg = new THREE.Group(); pg.position.set((a % 3 - 1) * 0.75, 0.3, (Math.floor(a / 3) - 1) * 0.75); plants.add(pg);
    pg.userData = { ph: a * 0.7, stem: cap(0.07, 1, 0x6fcf52, 0, 0.5, 0, pg), leaf: ball(0.2, 0x6fcf52, 0, 0.3, 0, pg), head: ball(1, toon(0xffffff), 0, 1, 0, pg) };
    pg.userData.leaf.scale.set(0.34, 0.12, 0.16);
  }
  const sign = new THREE.Group(); g.add(sign); sign.userData.furrows = furrows;
  cap(0.07, 0.7, 0xb9794a, 0, 0.45, 0, sign); box(1.1, 0.6, 0.14, 0xfff6e0, 0, 0.95, 0, sign);
  plotMeshes.push({ soil, plants, sign, g });
  things.push({
    x, z, r: 1.7, h: 1.9,
    label() {
      const p = S.plots[i];
      if (!p.open) return `🔒 ${plotCost()} 🪙`;
      if (!p.crop) return '';
      const left = p.t0 + CROPS[p.crop].time - now();
      return left > 0 ? `${ITEMS[p.crop].e} ${fmt(left)}` : `${ITEMS[p.crop].e} Hazır!`;
    },
    action() {
      const p = S.plots[i];
      if (!p.open) return { text: `Tarla aç (${plotCost()} 🪙)`, fn: () => buyPlot(i) };
      if (!p.crop) return { text: '🌱 Ek', fn: () => seedPanel(i) };
      if (p.t0 + CROPS[p.crop].time <= now()) return { text: `Biç ${ITEMS[p.crop].e}`, fn: () => harvest(i) };
      return null;
    },
  });
}
const plotCost = () => 25 * (S.plots.filter((p) => p.open).length - FREE_PLOTS + 1);
function buyPlot(i) {
  const c = plotCost();
  if (S.coins < c) return toast('🪙 Paran yetmiyor.');
  S.coins -= c; S.plots[i].open = true; toast('Yeni tarla açıldı!'); changed();
}
function seedPanel(i) {
  const rows = Object.entries(CROPS).map(([k, c]) => {
    const locked = S.level < c.lvl;
    return { ico: ITEMS[k].e, title: ITEMS[k].n, sub: locked ? `Seviye ${c.lvl}'de açılır` : `${fmt(c.time)} · 2 ürün verir`,
      btn: `${c.cost} 🪙`, off: locked || S.coins < c.cost, fn: () => { plant(i, k); closePanel(); } };
  });
  const idle = !S.plots.some((p) => p.crop) && invCount() === 0 && S.coins < CROPS.wheat.cost;
  if (idle) rows.push({ ico: '🤝', title: 'Komşu yardımı', sub: 'Hiçbir şeyin kalmamış, komşun destek oluyor.', btn: '+10 🪙',
    fn: () => { S.coins += 10; changed(); seedPanel(i); } });
  openPanel('🌱 Ne ekelim?', rows);
}
function plant(i, k) {
  const c = CROPS[k];
  if (S.coins < c.cost) return;
  S.coins -= c.cost; S.plots[i].crop = k; S.plots[i].t0 = now(); changed();
}
function harvest(i) {
  const p = S.plots[i];
  if (!addItem(p.crop, 2)) return;
  addXp(CROPS[p.crop].xp); toast(`+2 ${ITEMS[p.crop].e}`); p.crop = null; changed();
}

// ağıllar ve hayvanlar
const animals = [];
function chicken(pen) {
  const g = group(0, 0, pen);
  ball(0.4, 0xffffff, 0, 0.5, 0, g).scale.set(0.4, 0.38, 0.46);
  ball(0.27, 0xffffff, 0, 0.92, 0.22, g); eyes(g, 0.97, 0.44, 0.11, 0.05);
  const bk = mesh(new THREE.ConeGeometry(0.08, 0.16, 10), 0xffb02e, 0, 0.88, 0.5, g); bk.rotation.x = Math.PI / 2;
  ball(0.09, 0xff5a4a, 0, 1.2, 0.2, g); ball(0.07, 0xff5a4a, 0, 1.16, 0.08, g); ball(0.06, 0xff5a4a, 0, 0.78, 0.46, g);
  for (const x of [-0.36, 0.36]) ball(0.2, 0xf4f0e6, x, 0.52, -0.02, g).scale.set(0.08, 0.2, 0.26);
  ball(0.16, 0xf4f0e6, 0, 0.72, -0.4, g);
  for (const x of [-0.13, 0.13]) { cyl(0.03, 0.03, 0.2, 0xffb02e, x, 0.1, 0, g, 6); ball(0.07, 0xffb02e, x, 0.03, 0.05, g).scale.set(0.09, 0.03, 0.12); }
  return g;
}
function cow(pen) {
  const g = group(0, 0, pen);
  const body = cap(0.62, 0.9, 0xffffff, 0, 1.1, 0, g); body.rotation.x = Math.PI / 2;
  [[0.45, 1.4, -0.3, 0.36], [-0.5, 1.2, 0.25, 0.3], [0.2, 1.62, 0.35, 0.26], [-0.3, 1.5, -0.6, 0.25]].forEach(([a, b2, c, r]) => ball(r, 0x4a4040, a, b2, c, g).scale.set(r, r, r * 1.2));
  box(0.9, 0.85, 0.8, 0xffffff, 0, 1.6, 1.15, g, 0.38); box(0.7, 0.42, 0.4, 0xffb8c2, 0, 1.4, 1.52, g, 0.2);
  for (const x of [-0.14, 0.14]) ball(0.05, 0xe08a98, x, 1.42, 1.73, g);
  eyes(g, 1.75, 1.55, 0.22, 0.08);
  for (const x of [-0.3, 0.3]) { cap(0.06, 0.16, 0xfff1cf, x, 2.1, 1.1, g); ball(0.16, 0x4a4040, x * 1.9, 1.85, 1.05, g).scale.set(0.2, 0.11, 0.08); }
  for (const x of [-0.33, 0.33]) for (const z of [-0.55, 0.55]) { cap(0.14, 0.4, 0xffffff, x, 0.38, z, g); ball(0.16, 0x4a4040, x, 0.1, z, g).scale.set(0.16, 0.1, 0.17); }
  const tail = cap(0.04, 0.6, 0xffffff, 0, 1.2, -1.1, g); tail.rotation.x = -0.4; ball(0.1, 0x4a4040, 0, 0.85, -1.22, g);
  return g;
}
function makePen(key, x, z, w, d, count, maker, hutColor) {
  const P = PENS[key];
  const g = group(x, z);
  flat(w, d, 0xf0dca0, x, z, 0.03);
  const hw = w / 2, hd = d / 2, col = 0xd9a86a;
  const lf = (a, b, c2, e) => { // yerel çit
    const len = Math.hypot(c2 - a, e - b); const f = new THREE.Group(); f.position.set((a + c2) / 2, 0, (b + e) / 2);
    f.rotation.y = -Math.atan2(e - b, c2 - a); g.add(f);
    for (const y of [0.4, 0.75]) box(len, 0.12, 0.1, col, 0, y, 0, f);
    const n = Math.round(len / 1.4); for (let i = 0; i <= n; i++) cap(0.1, 0.75, col, -len / 2 + (len * i) / n, 0.47, 0, f);
  };
  lf(-hw, -hd, hw, -hd); lf(-hw, -hd, -hw, hd); lf(-hw, hd, hw, hd); lf(hw, -hd, hw, -0.9); lf(hw, 0.9, hw, hd);
  const hut = group(-hw + 1.3, -hd + 1.2, g);
  box(2, 1.5, 1.8, hutColor, 0, 0.75, 0, hut, 0.4); roof(2, 0.9, 1.8, 0xff7d6a, 1.45, hut); box(0.7, 0.9, 0.2, 0x7a4a2a, 0.3, 0.45, 0.85, hut, 0.3);
  const trough = box(1.7, 0.4, 0.6, 0xb9794a, 0.8, 0.2, hd - 0.7, g); box(1.4, 0.1, 0.36, 0xffe08a, 0, 0.18, 0, trough, 0.05);
  const herd = new THREE.Group(); g.add(herd);
  for (let i = 0; i < count; i++) {
    const a = maker(herd); a.position.set((Math.random() - 0.5) * (w - 2.5), 0, (Math.random() - 0.3) * (d - 3));
    animals.push({ m: a, key, w: w - 2.5, d: d - 3, tx: a.position.x, tz: a.position.z, wait: Math.random() * 3, sp: key === 'cow' ? 0.5 : 0.9 });
  }
  const sign = group(hw + 0.6, 0, g); cap(0.07, 1.1, 0xb9794a, 0, 0.65, 0, sign); box(1.1, 0.6, 0.14, 0xfff6e0, 0, 1.3, 0, sign);
  sign.rotation.y = Math.PI / 2;
  const st = () => S.pens[key];
  things.push({
    x: x + hw * 0.4, z, r: Math.max(w, d) / 2 + 1.2, h: 2.6,
    label() {
      const s = st();
      if (!s.built) return S.level < P.lvl ? `🔒 ${P.n} · Seviye ${P.lvl}` : `${P.e} ${P.n} · ${P.cost} 🪙`;
      if (!s.t0) return `${P.e} Aç! ${reqText(P.feed)}`;
      const left = s.t0 + P.time - now();
      return left > 0 ? `${ITEMS[P.out].e} ${fmt(left)}` : `${ITEMS[P.out].e} Hazır!`;
    },
    action() {
      const s = st();
      if (!s.built) {
        if (S.level < P.lvl) return null;
        return { text: `${P.n} kur (${P.cost} 🪙)`, fn: () => {
          if (S.coins < P.cost) return toast('🪙 Paran yetmiyor.');
          S.coins -= P.cost; s.built = true; toast(`${P.e} ${P.n} kuruldu!`); changed(); } };
      }
      if (!s.t0) return { text: `Besle (${reqText(P.feed)})`, fn: () => {
        if (!hasAll(P.feed)) return toast(`Yem yok: ${reqText(P.feed)} lazım.`);
        takeAll(P.feed); s.t0 = now(); changed(); } };
      if (s.t0 + P.time <= now()) return { text: `Topla ${ITEMS[P.out].e}`, fn: () => {
        if (!addItem(P.out, P.qty)) return;
        s.t0 = 0; addXp(P.xp); toast(`+${P.qty} ${ITEMS[P.out].e}`); changed(); } };
      return null;
    },
  });
  return { herd, hut, trough, key };
}
const penViews = [
  makePen('coop', -16, -6, 7, 7, 3, chicken, 0xffd36a),
  makePen('cow', -16, 12, 8, 8, 2, cow, 0xf2665a),
];

// üretim binaları
const bldViews = {};
function makeBuilding(key, x, z, wall, roofC) {
  const B = BLDS[key];
  const g = group(x, z);
  const body = new THREE.Group(); g.add(body);
  box(5, 3, 4.4, wall, 0, 1.5, 0, body, 0.65); roof(5, 2, 4.4, roofC, 2.9, body);
  box(0.3, 1.9, 1.2, 0xb9794a, -2.42, 0.95, 0, body, 0.55);
  for (const wz of [-1.45, 1.45]) { box(0.3, 1.1, 1.0, 0xffffff, -2.4, 1.9, wz, body, 0.45); box(0.3, 0.8, 0.7, 0x9be0ff, -2.46, 1.9, wz, body, 0.33); }
  box(0.8, 1.8, 0.8, 0xe8a58a, 1.2, 5.0, 0.8, body);
  const smoke = ball(0.4, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), 1.2, 6.2, 0.8, body);
  smoke.castShadow = false;
  const lot = new THREE.Group(); g.add(lot); // boş arsa
  box(5, 0.16, 4.4, 0xe6c88c, 0, 0.04, 0, lot, 0.08); cap(0.08, 1.3, 0xb9794a, -2.8, 0.75, 0, lot);
  box(0.14, 0.7, 1.4, 0xfff6e0, -2.8, 1.5, 0, lot);
  bldViews[key] = { body, lot, smoke };
  colliders.push({ x, z, r: 2.9, when: () => S.blds[key].built });
  const st = () => S.blds[key];
  things.push({
    x: x - 3.6, z, r: 2.6, h: 3,
    label() {
      const s = st();
      if (!s.built) return S.level < B.lvl ? `🔒 ${B.n} · Seviye ${B.lvl}` : `${B.e} ${B.n} · ${B.cost} 🪙`;
      if (!s.rec) return `${B.e} ${B.n}`;
      const left = s.t0 + B.recipes[s.rec].time - now();
      return left > 0 ? `${ITEMS[s.rec].e} ${fmt(left)}` : `${ITEMS[s.rec].e} Hazır!`;
    },
    action() {
      const s = st();
      if (!s.built) {
        if (S.level < B.lvl) return null;
        return { text: `${B.n} kur (${B.cost} 🪙)`, fn: () => {
          if (S.coins < B.cost) return toast('🪙 Paran yetmiyor.');
          S.coins -= B.cost; s.built = true; toast(`${B.e} ${B.n} kuruldu!`); changed(); } };
      }
      if (!s.rec) return { text: `${B.e} Üret`, fn: () => recipePanel(key) };
      if (s.t0 + B.recipes[s.rec].time <= now()) return { text: `Al ${ITEMS[s.rec].e}`, fn: () => {
        if (!addItem(s.rec, 1)) return;
        addXp(B.recipes[s.rec].xp); toast(`+1 ${ITEMS[s.rec].e}`); s.rec = null; changed(); } };
      return null;
    },
  });
}
makeBuilding('bakery', 17, -6, 0xffe3b0, 0xf29a4a);
makeBuilding('dairy', 17, 12, 0xe6f4ff, 0x6fa8ef);
function recipePanel(key) {
  const B = BLDS[key];
  openPanel(`${B.e} ${B.n}`, Object.entries(B.recipes).map(([k, r]) => {
    const locked = S.level < r.lvl;
    return { ico: ITEMS[k].e, title: ITEMS[k].n, sub: locked ? `Seviye ${r.lvl}'de açılır` : `${reqText(r.in)} · ${fmt(r.time)}`,
      btn: 'Üret', off: locked || !hasAll(r.in), fn: () => { takeAll(r.in); S.blds[key].rec = k; S.blds[key].t0 = now(); changed(); closePanel(); } };
  }));
}

// sipariş panosu
{
  const g = group(6, 16.5);
  for (const x of [-1.2, 1.2]) cap(0.1, 2.0, 0xb9794a, x, 1.1, 0, g);
  box(2.9, 1.6, 0.2, 0xd9a86a, 0, 1.6, 0, g);
  [[-0.8, 1.85, 0xfff2a0], [0.1, 1.8, 0xffffff], [0.85, 1.9, 0xbfe8ff], [-0.4, 1.3, 0xffd0d0], [0.5, 1.25, 0xd8ffc8]]
    .forEach(([x, y, c]) => { box(0.6, 0.45, 0.06, c, x, y, -0.12, g, 0.03); ball(0.05, 0xff5a4a, x, y + 0.16, -0.17, g); });
  colliders.push({ x: 6, z: 16.5, r: 1.2 });
  things.push({ x: 6, z: 15.3, r: 2.6, h: 2.8, label: () => '📋 Siparişler', action: () => ({ text: '📋 Siparişler', fn: orderPanel }) });
}
function availableItems() {
  const a = ['wheat', 'egg'];
  if (S.level >= 2) a.push('corn');
  if (S.level >= 3) a.push('carrot');
  if (S.pens.cow.built) a.push('milk');
  if (S.blds.bakery.built) a.push('bread');
  if (S.blds.bakery.built && S.pens.cow.built && S.level >= 4) a.push('cake');
  if (S.blds.dairy.built) a.push('butter');
  if (S.blds.dairy.built && S.level >= 5) a.push('cheese');
  return a;
}
const NAMES = ['Ayşe Teyze', 'Bakkal Rıza', 'Fırıncı Nuri', 'Köy Kahvesi', 'Öğretmen Elif', 'Kasap Cemal', 'Lokanta', 'Pazarcı Hatice'];
function newOrder() {
  const pool = availableItems().sort(() => Math.random() - 0.5);
  const need = {}; let val = 0;
  for (const k of pool.slice(0, pool.length > 2 && Math.random() < 0.5 ? 2 : 1)) {
    const basic = ITEMS[k].p <= 12;
    const q = basic ? 2 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 3);
    need[k] = q; val += q * ITEMS[k].p;
  }
  const coins = Math.round(val * 1.6) + 5;
  return { who: NAMES[Math.floor(Math.random() * NAMES.length)], need, coins, xp: Math.max(2, Math.round(coins / 6)) };
}
function fillOrders() { while (S.orders.length < 3) S.orders.push(newOrder()); }
function orderPanel() {
  fillOrders();
  openPanel('📋 Siparişler', S.orders.map((o, i) => ({
    ico: '🧺', title: o.who,
    sub: Object.entries(o.need).map(([k, v]) => `${ITEMS[k].e} ${have(k)}/${v}`).join('  ') + `  →  ${o.coins} 🪙  ${o.xp} ⭐`,
    btn: 'Teslim', off: !hasAll(o.need),
    fn: () => { takeAll(o.need); S.coins += o.coins; addXp(o.xp); toast(`+${o.coins} 🪙  +${o.xp} ⭐`); S.orders.splice(i, 1); changed(); orderPanel(); },
    btn2: '🗑', fn2: () => { S.orders.splice(i, 1); changed(); orderPanel(); },
  })));
}

// pazar tezgâhı
{
  const g = group(-6, 16.5);
  box(3, 0.9, 1.2, 0xd9a86a, 0, 0.45, 0, g);
  for (const x of [-1.4, 1.4]) cap(0.08, 2.2, 0xb9794a, x, 1.2, 0.5, g);
  for (let i = 0; i < 5; i++) box(0.62, 0.22, 1.8, i % 2 ? 0xffffff : 0xff7d6a, -1.24 + i * 0.62, 2.4, 0.2, g, 0.11);
  ball(0.2, 0xf08a2c, -0.8, 1.05, 0, g); ball(0.2, 0xe8c64a, 0, 1.05, 0.1, g); ball(0.2, 0xd83a2a, 0.8, 1.05, 0, g);
  colliders.push({ x: -6, z: 16.5, r: 1.5 });
  things.push({ x: -6, z: 15.2, r: 2.6, h: 3, label: () => '🛒 Pazar tezgâhı', action: () => ({ text: '🛒 Sat', fn: stallPanel }) });
}
function stallPanel() {
  const rows = Object.entries(S.inv).map(([k, v]) => ({
    ico: ITEMS[k].e, title: `${ITEMS[k].n} ×${v}`, sub: `Tanesi ${ITEMS[k].p} 🪙`,
    btn: 'Sat 1', fn: () => { takeAll({ [k]: 1 }); S.coins += ITEMS[k].p; changed(); stallPanel(); },
    btn2: 'Hepsi', fn2: () => { S.coins += ITEMS[k].p * v; takeAll({ [k]: v }); changed(); stallPanel(); },
  }));
  openPanel('🛒 Pazar tezgâhı', rows, rows.length ? 'Siparişler daha çok kazandırır; tezgâh acil nakit içindir.' : 'Satacak ürünün yok.');
}
function invPanel() {
  const rows = Object.entries(S.inv).map(([k, v]) => ({ ico: ITEMS[k].e, title: ITEMS[k].n, sub: `Değeri ${ITEMS[k].p} 🪙`, tag: `×${v}` }));
  const cost = 80 * S.capLvl;
  rows.push({ ico: '🏚️', title: 'Ambarı büyüt', sub: `Kapasite ${S.cap} → ${S.cap + 25}`, btn: `${cost} 🪙`, off: S.coins < cost,
    fn: () => { S.coins -= cost; S.cap += 25; S.capLvl++; changed(); invPanel(); } });
  rows.push({ ico: '♻️', title: 'Oyunu sıfırla', sub: 'Tüm ilerleme silinir', btn: 'Sıfırla', red: true,
    fn: () => { if (confirm('Tüm ilerleme silinsin mi?')) { localStorage.removeItem(SAVE_KEY); location.reload(); } } });
  openPanel(`📦 Ambar ${invCount()}/${S.cap}`, rows);
}
$('btnInv').onclick = invPanel;

// ---------------------------------------------------------------- panel
let panelOpen = false;
function openPanel(title, rows, note) {
  $('ptitle').textContent = title;
  const box_ = $('rows'); box_.innerHTML = '';
  if (note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = note; box_.appendChild(n); }
  for (const r of rows) {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = '<div class="ico"></div><div class="txt"><b></b><small></small></div>';
    d.children[0].textContent = r.ico; d.querySelector('b').textContent = r.title; d.querySelector('small').textContent = r.sub || '';
    if (r.tag) { const t = document.createElement('b'); t.textContent = r.tag; d.appendChild(t); }
    if (r.btn) { const b = document.createElement('button'); b.className = 'btn' + (r.red ? ' red' : ''); b.textContent = r.btn; b.disabled = !!r.off; b.onclick = r.fn; d.appendChild(b); }
    if (r.btn2) { const b = document.createElement('button'); b.className = 'btn alt'; b.textContent = r.btn2; b.onclick = r.fn2; d.appendChild(b); }
    box_.appendChild(d);
  }
  $('modal').style.display = 'flex'; panelOpen = true;
}
function closePanel() { $('modal').style.display = 'none'; panelOpen = false; }
$('close').onclick = closePanel;
$('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closePanel(); });

// ---------------------------------------------------------------- oyuncu
const player = group(S.px, S.pz);
const limbs = {};
{
  const skin = 0xffd9b3, shirt = 0xff7d6a, pants = 0x5b8def, straw = 0xffdf7a;
  cap(0.36, 0.3, pants, 0, 0.92, 0, player);                       // tulum
  box(0.5, 0.34, 0.1, pants, 0, 1.08, 0.33, player, 0.05);          // önlük
  cap(0.34, 0.12, shirt, 0, 1.2, 0, player).scale.set(1, 1, 0.92);  // gömlek
  ball(0.5, skin, 0, 1.9, 0, player);                               // kocaman kafa
  eyes(player, 1.9, 0.45, 0.19, 0.075);
  for (const x of [-0.31, 0.31]) ball(0.09, 0xffa0a8, x, 1.77, 0.37, player).scale.set(0.1, 0.06, 0.05);
  ball(0.04, 0xe8a888, 0, 1.82, 0.5, player);
  ball(0.5, 0x8a5a3a, 0, 1.95, -0.06, player).scale.set(0.52, 0.5, 0.5); // saç
  cyl(0.82, 0.86, 0.07, straw, 0, 2.28, 0, player, 24);
  const crown = mesh(domeGeo, straw, 0, 2.28, 0, player); crown.scale.set(0.95, 0.75, 0.95);
  cyl(0.485, 0.485, 0.1, 0xff7d6a, 0, 2.36, 0, player, 24);
  for (const [n, x, c, y, len] of [['la', -0.5, shirt, 1.32, 0.3], ['ra', 0.5, shirt, 1.32, 0.3], ['ll', -0.18, pants, 0.62, 0.22], ['rl', 0.18, pants, 0.62, 0.22]]) {
    const pv = new THREE.Group(); pv.position.set(x, y, 0); player.add(pv);
    const arm = n[1] === 'a';
    cap(arm ? 0.12 : 0.15, len, c, 0, -len / 2 - 0.08, 0, pv);
    if (arm) ball(0.13, skin, 0, -len - 0.24, 0, pv); else ball(0.2, 0x8a5a3a, 0, -len - 0.3, 0.06, pv).scale.set(0.19, 0.14, 0.26);
    limbs[n] = pv;
  }
}

// ---------------------------------------------------------------- girdi
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if ((e.code === 'KeyE' || e.code === 'Space') && !panelOpen && current) { e.preventDefault(); current.fn(); }
  if (e.code === 'Escape') closePanel();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
let jx = 0, jy = 0, joyId = null;
const joy = $('joy'), stick = $('stick');
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
  if (m > max) { dx *= max / m; dy *= max / m; }
  stick.style.transform = `translate(${dx}px, ${dy}px)`; jx = dx / max; jy = dy / max;
}
joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId === joyId) { joyId = null; jx = jy = 0; stick.style.transform = ''; } };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

let yaw = 0, pitch = 0.5, dist = 10, camId = null, lx = 0, ly = 0;
const cv = $('c');
cv.addEventListener('pointerdown', (e) => { camId = e.pointerId; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId !== camId) return;
  yaw -= (e.clientX - lx) * 0.007; pitch = Math.min(1.25, Math.max(0.15, pitch + (e.clientY - ly) * 0.005));
  lx = e.clientX; ly = e.clientY;
});
const camEnd = (e) => { if (e.pointerId === camId) camId = null; };
cv.addEventListener('pointerup', camEnd); cv.addEventListener('pointercancel', camEnd);
cv.addEventListener('wheel', (e) => { dist = Math.min(18, Math.max(5, dist + e.deltaY * 0.01)); }, { passive: true });

let current = null;
$('act').onclick = () => { if (current) current.fn(); };

// ---------------------------------------------------------------- döngü
function changed() { fillOrders(); refreshHud(); syncWorld(); save(); }
function syncWorld() {
  S.plots.forEach((p, i) => {
    const v = plotMeshes[i];
    v.sign.visible = !p.open; v.soil.material.color.set(p.open ? 0xb5784a : 0xa9d87a); v.sign.userData.furrows.visible = p.open; v.plants.visible = !!p.crop;
  });
  for (const v of penViews) { const b = S.pens[v.key].built; v.herd.visible = b; v.hut.visible = b; v.trough.visible = b; }
  for (const [k, v] of Object.entries(bldViews)) { v.body.visible = S.blds[k].built; v.lot.visible = !S.blds[k].built; }
}
const labelEls = things.map(() => { const d = document.createElement('div'); d.className = 'lbl'; $('labels').appendChild(d); return d; });
const v3 = new THREE.Vector3();
let last = performance.now(), walkT = 0, saveT = 0;

function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  const T = now();

  // hareket (kameraya göre)
  let ix = jx, iy = -jy;
  if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (panelOpen) ix = iy = 0;
  let mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
  if (mag > 0.08) {
    const mx = -Math.sin(yaw) * iy + Math.cos(yaw) * ix, mz = -Math.cos(yaw) * iy - Math.sin(yaw) * ix;
    player.position.x += mx * 6.5 * dt; player.position.z += mz * 6.5 * dt;
    let d = Math.atan2(mx, mz) - player.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.rotation.y += d * Math.min(1, dt * 12);
    walkT += dt * 10 * mag;
  } else walkT = 0;
  const sw = Math.sin(walkT) * 0.8;
  limbs.la.rotation.x = sw; limbs.ra.rotation.x = -sw; limbs.ll.rotation.x = -sw; limbs.rl.rotation.x = sw;
  player.position.y = Math.abs(Math.sin(walkT)) * 0.06;

  // çarpışma ve sınırlar
  const p = player.position;
  for (const c of colliders) {
    if (c.when && !c.when()) continue;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.4;
    if (d < min && d > 0.0001) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
  }
  const inGate = Math.abs(p.x) < 2.1;
  p.x = Math.max(-BX + 0.6, Math.min(BX - 0.6, p.x));
  p.z = Math.max(-BZ + 0.6, Math.min(inGate ? 24.5 : (p.z > BZ ? 24.5 : BZ - 0.6), p.z));
  if (p.z > BZ - 0.6 && p.z < BZ + 0.6 && !inGate) p.z = p.z > BZ ? BZ + 0.6 : BZ - 0.6;

  // kamera
  const cp = Math.cos(pitch);
  camera.position.set(p.x + Math.sin(yaw) * cp * dist, 1.6 + Math.sin(pitch) * dist, p.z + Math.cos(yaw) * cp * dist);
  camera.lookAt(p.x, 1.6, p.z);
  sun.position.set(p.x + 18, 30, p.z + 12); sun.target.position.set(p.x, 0, p.z);

  // ekinler
  S.plots.forEach((pl, i) => {
    if (!pl.crop) return;
    const c = CROPS[pl.crop], g = Math.min(1, (T - pl.t0) / c.time), v = plotMeshes[i];
    const cfg = PLANT[pl.crop], ripe = g >= 1;
    for (const m of v.plants.children) {
      const u = m.userData;
      m.scale.setScalar(0.25 + g * 0.75);
      u.stem.scale.y = cfg.stem; u.stem.position.y = cfg.stem * 0.55; u.leaf.position.y = cfg.stem * 0.45;
      u.head.visible = g > 0.45; u.head.position.y = cfg.hy; u.head.scale.set(...cfg.hs);
      u.head.material.color.set(ripe ? c.color : 0xa6dc6a);
      m.rotation.z = ripe ? Math.sin(T * 3 + u.ph) * 0.12 : 0;
    }
  });
  // hayvanlar
  for (const a of animals) {
    const dx = a.tx - a.m.position.x, dz = a.tz - a.m.position.z, d = Math.hypot(dx, dz);
    if (d < 0.1) {
      a.wait -= dt;
      if (a.wait <= 0) { a.tx = (Math.random() - 0.5) * a.w; a.tz = (Math.random() - 0.3) * a.d; a.wait = 1 + Math.random() * 4; }
    } else {
      a.m.position.x += (dx / d) * a.sp * dt; a.m.position.z += (dz / d) * a.sp * dt;
      a.m.rotation.y = Math.atan2(dx, dz); a.m.position.y = Math.abs(Math.sin(T * 9)) * 0.04;
    }
  }
  for (const cl of clouds) { cl.position.x += dt * 0.6; if (cl.position.x > 70) cl.position.x = -70; }
  // baca dumanı
  for (const [k, v] of Object.entries(bldViews)) {
    const busy = S.blds[k].rec && S.blds[k].t0 + BLDS[k].recipes[S.blds[k].rec].time > T;
    v.smoke.visible = !!busy; if (busy) { const f = (T * 0.6) % 1; v.smoke.position.y = 6.1 + f * 1.6; v.smoke.scale.setScalar(0.3 + f * 0.5); v.smoke.material.opacity = 0.7 * (1 - f); }
  }

  // en yakın etkileşim + etiketler
  let best = null, bd = 1e9;
  things.forEach((th, i) => {
    const d = Math.hypot(p.x - th.x, p.z - th.z);
    if (d < th.r && d < bd) { bd = d; best = th; }
    const el = labelEls[i], text = d < 16 ? th.label() : '';
    if (!text) { el.style.display = 'none'; return; }
    v3.set(th.x, th.h, th.z).project(camera);
    if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.textContent = text;
    el.style.left = ((v3.x + 1) / 2) * innerWidth + 'px'; el.style.top = ((1 - v3.y) / 2) * innerHeight + 'px';
  });
  current = best && !panelOpen ? best.action() : null;
  const act = $('act');
  if (current) { act.style.display = 'block'; if (act.textContent !== current.text) act.textContent = current.text; }
  else act.style.display = 'none';

  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

changed();
if (!localStorage.getItem(SAVE_KEY + '_hi')) {
  toast('👋 Hoş geldin! Tarlaya yürü, buğday ek, biç ve siparişleri teslim et.');
  try { localStorage.setItem(SAVE_KEY + '_hi', '1'); } catch (e) { /* özel sekme */ }
}
window.__farm = { get S() { return S; }, player, things, changed };
requestAnimationFrame(frame);
