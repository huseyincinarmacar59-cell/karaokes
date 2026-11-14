import * as THREE from 'three';

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
  wheat:  { cost: 2, time: 20, xp: 1, lvl: 1, color: 0xe8c64a },
  corn:   { cost: 4, time: 45, xp: 2, lvl: 2, color: 0x7cc23c },
  carrot: { cost: 7, time: 90, xp: 3, lvl: 3, color: 0xf08a2c },
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
scene.background = new THREE.Color(0x9fd8f5);
scene.fog = new THREE.Fog(0x9fd8f5, 45, 95);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa55, 1.5));
const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(18, 30, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
scene.add(sun, sun.target);

const mats = {};
const mat = (c) => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
function mesh(geo, color, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const box = (w, h, d, c, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, p);
const cyl = (r1, r2, h, c, x, y, z, p, seg = 12) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), c, x, y, z, p);
const ball = (r, c, x, y, z, p) => mesh(new THREE.SphereGeometry(r, 12, 10), c, x, y, z, p);
function group(x, z, parent = scene) { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); return g; }
function roof(w, h, d, c, y, p) { // dört yüzlü çatı
  const m = mesh(new THREE.ConeGeometry(0.71, h, 4), c, 0, y + h / 2, 0, p);
  m.rotation.y = Math.PI / 4; m.scale.set(w * 1.08, 1, d * 1.08); return m;
}

// zemin, yollar, dere
const ground = mesh(new THREE.PlaneGeometry(220, 220), 0x7fc24e, 0, 0, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
function flat(w, d, c, x, z, y = 0.02) { const m = mesh(new THREE.PlaneGeometry(w, d), c, x, y, z); m.rotation.x = -Math.PI / 2; m.castShadow = false; return m; }
flat(3, 20, 0xd9b87a, 0, 10.5);         // evden kapıya ana yol
flat(34, 2.4, 0xd9b87a, 0, 4.6, 0.025);   // ağıllar ile atölyeler arası yol
flat(70, 4, 0xc9a66b, 0, 23, 0.02);   // köy yolu
flat(7, 80, 0x4aa9e0, 31, 0, 0.03);   // dere
flat(9, 80, 0xe3d29a, 31, 0, 0.015);  // kumsal
const dock = group(27.5, 6); box(5, 0.25, 2, 0x9a6a3a, 0, 0.45, 0, dock);
for (const dx of [-2, 2]) for (const dz of [-0.8, 0.8]) cyl(0.14, 0.14, 1, 0x6e4a26, dx, 0.3, dz, dock, 6);

const colliders = []; // {x,z,r}
function tree(x, z, s = 1) {
  const g = group(x, z); g.scale.setScalar(s);
  cyl(0.25, 0.35, 1.6, 0x7a5230, 0, 0.8, 0, g, 7);
  ball(1.3, 0x3f9a3a, 0, 2.5, 0, g); ball(0.95, 0x55b548, 0.6, 3.3, 0.2, g);
  colliders.push({ x, z, r: 0.6 * s });
}
[[-21, -17, 1.2], [-17, -19, 1], [20, -18, 1.3], [16, -19.5, .9], [-22, 17, 1.1], [22, 17, 1], [-23, 4, 1.2], [23, -9, 1],
 [-27, -8, 1.4], [-28, 10, 1.2], [9, -19, 1], [-4, 27, 1.2], [12, 28, 1.3], [-16, 28, 1], [24, 27, 1.1], [36, -12, 1.3], [37, 8, 1.1], [36, 22, 1.2]]
  .forEach(([x, z, s]) => tree(x, z, s));

// sınır çiti (güney tarafta kapı boşluğu)
const BX = 24.5, BZ = 20.5;
function fence(x1, z1, x2, z2, c = 0xf3ead2) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.6));
  const g = group((x1 + x2) / 2, (z1 + z2) / 2); g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  for (const y of [0.4, 0.8]) box(len, 0.1, 0.07, c, 0, y, 0, g);
  for (let i = 0; i <= n; i++) box(0.14, 1.05, 0.14, c, -len / 2 + (len * i) / n, 0.52, 0, g);
}
fence(-BX, -BZ, BX, -BZ); fence(-BX, -BZ, -BX, BZ); fence(BX, -BZ, BX, BZ);
fence(-BX, BZ, -2.5, BZ); fence(2.5, BZ, BX, BZ);

// çiftlik evi
{
  const g = group(0, -15);
  box(7, 3.4, 5, 0xfbe9c2, 0, 1.7, 0, g); roof(7, 2.6, 5, 0xc0503a, 3.4, g);
  box(1.2, 2, 0.15, 0x8a5a2b, 0, 1, 2.52, g);
  for (const x of [-2.2, 2.2]) box(1.2, 1.1, 0.15, 0x8ad0f0, x, 2, 2.52, g);
  box(0.8, 1.6, 0.8, 0xb0745a, 2, 5, -0.8, g);
  box(3, 0.2, 1.4, 0xb98b55, 0, 0.1, 3.2, g);
  colliders.push({ x: -2, z: -15, r: 3 }, { x: 2, z: -15, r: 3 });
}
// ambar + silo
{
  const g = group(-10, -14.5);
  box(5, 3.2, 4.4, 0xc9463c, 0, 1.6, 0, g); roof(5, 2.2, 4.4, 0x6b4a3a, 3.2, g);
  box(2, 2.3, 0.15, 0xfbe9c2, 0, 1.15, 2.22, g);
  box(1.9, 0.12, 0.2, 0xc9463c, 0, 1.15, 2.26, g).rotation.z = 0.87;
  cyl(1.2, 1.2, 4.5, 0xd8dde0, 4.2, 2.25, 0, g); mesh(new THREE.ConeGeometry(1.35, 1.2, 12), 0xc9463c, 4.2, 5.1, 0, g);
  colliders.push({ x: -10, z: -14.5, r: 3.1 }, { x: -5.8, z: -14.5, r: 1.5 });
}

// ---------------------------------------------------------------- etkileşim listesi
const things = []; // {x,z,r,h,label(),action()}

// tarlalar
const plotMeshes = [];
const soilMat = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
for (let i = 0; i < COLS * ROWS; i++) {
  const c = i % COLS, r = Math.floor(i / COLS);
  const x = (c - 1.5) * 3 - 6.5 + 6.5, z = -8 + r * 3;
  const g = group(x, z);
  const soil = box(2.5, 0.16, 2.5, soilMat.clone(), 0, 0.08, 0, g);
  const plants = new THREE.Group(); g.add(plants);
  for (let a = 0; a < 9; a++) {
    const pm = mesh(new THREE.ConeGeometry(0.2, 1, 6), new THREE.MeshLambertMaterial({ color: 0x66bb44 }),
      (a % 3 - 1) * 0.75, 0.6, (Math.floor(a / 3) - 1) * 0.75, plants);
    pm.userData.ph = a * 0.7;
  }
  const sign = box(0.9, 0.5, 0.08, 0xf3ead2, 0, 0.9, 0, g); box(0.1, 0.9, 0.1, 0x8a5a2b, 0, 0.45, 0, g);
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
  ball(0.32, 0xffffff, 0, 0.42, 0, g).scale.set(1, 0.9, 1.25);
  ball(0.19, 0xffffff, 0, 0.75, 0.3, g);
  mesh(new THREE.ConeGeometry(0.07, 0.18, 6), 0xf0a020, 0, 0.74, 0.52, g).rotation.x = Math.PI / 2;
  box(0.06, 0.14, 0.2, 0xd83a2a, 0, 0.95, 0.3, g);
  for (const x of [-0.1, 0.1]) cyl(0.03, 0.03, 0.22, 0xf0a020, x, 0.11, 0, g, 5);
  return g;
}
function cow(pen) {
  const g = group(0, 0, pen);
  box(0.9, 0.8, 1.6, 0xffffff, 0, 1.05, 0, g);
  box(0.92, 0.4, 0.5, 0x2c2c2c, 0, 1.2, -0.3, g); box(0.5, 0.82, 0.4, 0x2c2c2c, 0.22, 1.05, 0.45, g);
  box(0.6, 0.6, 0.6, 0xffffff, 0, 1.4, 1.0, g); box(0.5, 0.3, 0.2, 0xf2b6b0, 0, 1.25, 1.32, g);
  for (const x of [-0.33, 0.33]) box(0.1, 0.22, 0.1, 0xe8dcc0, x, 1.78, 0.95, g);
  for (const x of [-0.3, 0.3]) for (const z of [-0.6, 0.6]) box(0.2, 0.7, 0.2, 0xf2f2f2, x, 0.35, z, g);
  return g;
}
function makePen(key, x, z, w, d, count, maker, hutColor) {
  const P = PENS[key];
  const g = group(x, z);
  flat(w, d, 0xc8b47a, x, z, 0.03);
  const hw = w / 2, hd = d / 2, col = 0x9a6a3a;
  const lf = (a, b, c2, e) => { // yerel çit
    const len = Math.hypot(c2 - a, e - b); const f = new THREE.Group(); f.position.set((a + c2) / 2, 0, (b + e) / 2);
    f.rotation.y = -Math.atan2(e - b, c2 - a); g.add(f);
    for (const y of [0.35, 0.7]) box(len, 0.09, 0.07, col, 0, y, 0, f);
    const n = Math.round(len / 1.4); for (let i = 0; i <= n; i++) box(0.13, 0.9, 0.13, col, -len / 2 + (len * i) / n, 0.45, 0, f);
  };
  lf(-hw, -hd, hw, -hd); lf(-hw, -hd, -hw, hd); lf(-hw, hd, hw, hd); lf(hw, -hd, hw, -0.9); lf(hw, 0.9, hw, hd);
  const hut = group(-hw + 1.3, -hd + 1.2, g);
  box(2, 1.5, 1.8, hutColor, 0, 0.75, 0, hut); roof(2, 1, 1.8, 0x8a5a2b, 1.5, hut);
  const trough = box(1.6, 0.3, 0.5, 0x7a5230, 0.8, 0.15, hd - 0.7, g);
  const herd = new THREE.Group(); g.add(herd);
  for (let i = 0; i < count; i++) {
    const a = maker(herd); a.position.set((Math.random() - 0.5) * (w - 2.5), 0, (Math.random() - 0.3) * (d - 3));
    animals.push({ m: a, key, w: w - 2.5, d: d - 3, tx: a.position.x, tz: a.position.z, wait: Math.random() * 3, sp: key === 'cow' ? 0.5 : 0.9 });
  }
  const sign = group(hw + 0.6, 0, g); box(0.1, 1.3, 0.1, 0x8a5a2b, 0, 0.65, 0, sign); box(1.1, 0.6, 0.08, 0xf3ead2, 0, 1.3, 0, sign);
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
  makePen('coop', -16, -6, 7, 7, 3, chicken, 0xe8b04a),
  makePen('cow', -16, 12, 8, 8, 2, cow, 0xc9463c),
];

// üretim binaları
const bldViews = {};
function makeBuilding(key, x, z, wall, roofC) {
  const B = BLDS[key];
  const g = group(x, z);
  const body = new THREE.Group(); g.add(body);
  box(5, 3, 4.4, wall, 0, 1.5, 0, body); roof(5, 2, 4.4, roofC, 3, body);
  box(1.1, 1.9, 0.15, 0x8a5a2b, -2.52, 0.95, 0, body).rotation.y = Math.PI / 2;
  box(0.15, 1, 1.1, 0x8ad0f0, -2.52, 1.9, 1.4, body); box(0.15, 1, 1.1, 0x8ad0f0, -2.52, 1.9, -1.4, body);
  box(0.8, 1.8, 0.8, 0x9a8a80, 1.2, 4.2, 0.8, body);
  const smoke = ball(0.4, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), 1.2, 5.6, 0.8, body);
  smoke.castShadow = false;
  const lot = new THREE.Group(); g.add(lot); // boş arsa
  box(5, 0.08, 4.4, 0xb89a6a, 0, 0.04, 0, lot); box(0.12, 1.5, 0.12, 0x8a5a2b, -2.8, 0.75, 0, lot);
  box(0.08, 0.7, 1.4, 0xf3ead2, -2.8, 1.5, 0, lot);
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
makeBuilding('bakery', 17, -6, 0xf6dfae, 0xa8623a);
makeBuilding('dairy', 17, 12, 0xdcefff, 0x3f78b5);
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
  for (const x of [-1.2, 1.2]) box(0.16, 2.2, 0.16, 0x8a5a2b, x, 1.1, 0, g);
  box(2.8, 1.5, 0.12, 0xb98b55, 0, 1.6, 0, g);
  [[-0.8, 1.85, 0xfff2a0], [0.1, 1.8, 0xffffff], [0.85, 1.9, 0xbfe8ff], [-0.4, 1.3, 0xffd0d0], [0.5, 1.25, 0xd8ffc8]]
    .forEach(([x, y, c]) => box(0.6, 0.45, 0.04, c, x, y, -0.08, g));
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
  box(3, 0.9, 1.2, 0xb98b55, 0, 0.45, 0, g);
  for (const x of [-1.4, 1.4]) box(0.12, 2.4, 0.12, 0x8a5a2b, x, 1.2, 0.5, g);
  for (let i = 0; i < 5; i++) box(0.62, 0.1, 1.7, i % 2 ? 0xffffff : 0xe85b4f, -1.24 + i * 0.62, 2.4, 0.2, g);
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
  const skin = 0xf2c79a, shirt = 0xe8563f, pants = 0x3d6fb5;
  box(0.7, 0.8, 0.4, shirt, 0, 1.25, 0, player);
  box(0.72, 0.3, 0.42, pants, 0, 0.82, 0, player);
  ball(0.3, skin, 0, 1.95, 0, player);
  cyl(0.55, 0.55, 0.05, 0xe8c66a, 0, 2.18, 0, player, 16); cyl(0.28, 0.32, 0.25, 0xe8c66a, 0, 2.3, 0, player, 16);
  for (const [n, x, c, y, len] of [['la', -0.47, shirt, 1.6, 0.7], ['ra', 0.47, shirt, 1.6, 0.7], ['ll', -0.18, pants, 0.7, 0.7], ['rl', 0.18, pants, 0.7, 0.7]]) {
    const pv = new THREE.Group(); pv.position.set(x, y, 0); player.add(pv);
    box(0.22, len, 0.24, c, 0, -len / 2, 0, pv);
    if (n[1] === 'a') ball(0.13, skin, 0, -len - 0.05, 0, pv); else box(0.24, 0.14, 0.36, 0x5a3a20, 0, -len + 0.02, 0.06, pv);
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
    v.sign.visible = !p.open; v.soil.material.color.set(p.open ? 0x8a5a33 : 0x86b85a); v.plants.visible = !!p.crop;
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
    for (const m of v.plants.children) {
      m.scale.set(0.5 + g * 0.7, 0.15 + g * 0.95, 0.5 + g * 0.7);
      m.position.y = 0.16 + m.scale.y * 0.5 + (g >= 1 ? Math.abs(Math.sin(T * 3 + m.userData.ph)) * 0.08 : 0);
      m.material.color.set(g >= 1 ? c.color : 0x66bb44);
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
  // baca dumanı
  for (const [k, v] of Object.entries(bldViews)) {
    const busy = S.blds[k].rec && S.blds[k].t0 + BLDS[k].recipes[S.blds[k].rec].time > T;
    v.smoke.visible = !!busy; if (busy) { const f = (T * 0.6) % 1; v.smoke.position.y = 5.4 + f * 1.6; v.smoke.scale.setScalar(0.6 + f); v.smoke.material.opacity = 0.7 * (1 - f); }
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
window.__farm = { get S() { return S; }, player, things };
requestAnimationFrame(frame);
