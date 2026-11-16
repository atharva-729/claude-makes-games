/* Ember Hop - a small 2D platformer. Plain JavaScript + Canvas 2D, no dependencies. */
(function () {
'use strict';

// ---------------------------------------------------------------- constants
const T = 32, DT = 1 / 120, VW = 960, VH = 540;
const PW = 20, PH = 28, EW = 26, EH = 22;
const RUN = 250, JUMP = 690, GRAV = 2000, MAXFALL = 900, SPRING = 1060;
const COYOTE = 0.1, BUFFER = 0.12;

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- levels
// Tiles: 0 empty, 1 solid, 2 one-way platform, 3 spikes, 4 spring
function makeLevel(def) {
  const w = def.w, h = def.h;
  const tiles = new Uint8Array(w * h);
  const coinAt = new Int16Array(w * h).fill(-1);
  const L = { name: def.name, theme: def.theme, w: w, h: h, tiles: tiles, coinAt: coinAt,
    coins: [], plats: [], enemies: [], cps: [], goal: null, sx: 80, sy: 64, cv: null };
  const b = {
    fill(x0, y0, x1, y1, v) {
      if (v === undefined) v = 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = v;
    },
    ground(x0, x1, top) { b.fill(x0, top, x1, h - 1, 1); },
    island(x0, x1, top, th) { b.fill(x0, top, x1, top + (th || 2) - 1, 1); },
    oneway(x0, x1, y) { b.fill(x0, y, x1, y, 2); },
    spikes(x0, x1, y) { b.fill(x0, y, x1, y, 3); },
    spring(x, y) { b.fill(x, y, x, y, 4); },
    coin(x, y) { coinAt[y * w + x] = L.coins.length; L.coins.push({ x: x * T + T / 2, y: y * T + T / 2 }); },
    coins(x0, x1, y) { for (let x = x0; x <= x1; x++) b.coin(x, y); },
    walker(x, y) { L.enemies.push({ type: 0, x: x * T + 3, y: (y + 1) * T - EH }); },
    flyer(x, y, range) { L.enemies.push({ type: 1, ox: x * T + T / 2, oy: y * T + T / 2, range: range || 80, ph: x * 1.3 }); },
    plat(x, y, dx, dy, period, phase, wt) {
      L.plats.push({ ox: x * T, oy: y * T, w: (wt || 3) * T, h: 14, ax: dx * T, ay: dy * T, period: period, phase: phase || 0 });
    },
    cp(x, y) { L.cps.push({ x: x * T, y: y * T }); },
    goal(x, y) { L.goal = { x: x * T, y: y * T }; },
    start(x, y) { L.sx = x * T + T / 2; L.sy = (y + 1) * T; }
  };
  def.build(b);
  return L;
}

const LEVEL_DEFS = [
  { name: 'Green Hills', theme: 'hills', w: 140, h: 17, build(b) {
    b.ground(0, 22, 13); b.start(3, 12);
    b.coins(7, 10, 11);
    b.fill(14, 12, 16, 12); b.coins(14, 16, 10);
    b.walker(19, 12);
    b.coin(23, 10); b.coin(24, 9); b.coin(25, 10);
    b.ground(26, 45, 13);
    b.oneway(30, 33, 10); b.coins(30, 33, 9);
    b.oneway(35, 38, 7); b.coins(35, 38, 6);
    b.walker(34, 12);
    b.spikes(42, 43, 12); b.coin(42, 9); b.coin(43, 9);
    b.ground(48, 70, 11); b.cp(51, 10);
    b.walker(56, 10); b.spring(60, 10);
    b.fill(63, 5, 68, 5); b.coins(63, 68, 4);
    b.walker(66, 10);
    b.plat(71, 11, 5, 0, 4);
    b.coin(73, 9); b.coin(75, 9); b.coin(77, 9);
    b.ground(80, 100, 11);
    b.flyer(86, 8); b.coins(84, 88, 10);
    b.spikes(92, 93, 10); b.coin(92, 7); b.coin(93, 7);
    b.walker(97, 10);
    b.ground(104, 120, 13);
    b.oneway(108, 110, 10); b.coins(108, 110, 9);
    b.oneway(112, 114, 8); b.coins(112, 114, 7);
    b.oneway(116, 118, 6); b.coins(116, 118, 5);
    b.walker(110, 12); b.walker(116, 12);
    b.ground(124, 125, 11); b.coin(124, 9); b.coin(125, 9);
    b.ground(129, 139, 13); b.goal(135, 12);
  } },
  { name: 'Crystal Caves', theme: 'cave', w: 150, h: 22, build(b) {
    b.fill(0, 0, 149, 2);
    [6, 13, 22, 27, 58, 69, 78, 96, 110, 130, 141].forEach(function (x, i) { b.fill(x, 3, x + (i % 2), 3 + (i % 3 === 0 ? 1 : 0)); });
    b.ground(0, 15, 17); b.start(2, 16);
    b.coins(5, 7, 15);
    b.spikes(9, 10, 16); b.coin(9, 13); b.coin(10, 13);
    b.ground(19, 30, 15); b.walker(24, 14); b.coins(21, 23, 13);
    b.plat(31, 9, 0, 6, 4.5, 0.5);
    b.coin(32, 11); b.coin(32, 9); b.coin(32, 7);
    b.ground(35, 50, 9); b.cp(36, 8);
    b.spikes(40, 40, 8); b.walker(45, 8); b.coins(44, 47, 6);
    b.ground(51, 70, 17);
    b.fill(52, 15, 53, 16);
    b.fill(55, 12, 66, 13);
    b.coins(57, 64, 15); b.walker(61, 16);
    b.coins(58, 63, 10); b.flyer(60, 8);
    b.ground(71, 74, 19); b.spikes(71, 74, 18);
    b.coin(72, 13); b.coin(73, 13);
    b.ground(75, 100, 17);
    b.spring(79, 16); b.fill(83, 10, 91, 11); b.coins(84, 90, 9);
    b.spikes(86, 87, 16); b.walker(92, 16); b.coins(89, 91, 15);
    b.plat(93, 10, 4, 0, 4);
    b.coin(95, 8); b.coin(97, 8);
    b.oneway(97, 99, 15);
    b.ground(101, 118, 13); b.cp(103, 12);
    b.spikes(107, 107, 12); b.walker(111, 12); b.flyer(111, 8);
    b.coins(109, 113, 10);
    b.spikes(115, 115, 12);
    b.ground(121, 122, 13); b.ground(125, 126, 12);
    b.coin(121, 11); b.coin(122, 11); b.coin(125, 10); b.coin(126, 10);
    b.flyer(124, 8, 70);
    b.ground(129, 149, 13);
    b.spikes(134, 135, 12); b.coin(134, 9); b.coin(135, 9);
    b.walker(140, 12); b.goal(145, 12);
  } },
  { name: 'Sunset Isles', theme: 'sky', w: 160, h: 20, build(b) {
    b.island(0, 10, 14, 3); b.start(2, 13); b.coins(5, 8, 12);
    b.coin(12, 11);
    b.island(14, 20, 13); b.walker(17, 12);
    b.plat(21, 13, 6, 0, 4.5); b.coins(24, 26, 11);
    b.island(31, 38, 12); b.flyer(34, 9); b.spring(37, 11);
    b.island(41, 46, 5); b.coins(41, 46, 4);
    b.island(41, 47, 13); b.cp(43, 12);
    b.plat(49, 8, 0, 5, 5, 0.5);
    b.coin(50, 10); b.coin(50, 8); b.coin(50, 6);
    b.island(53, 60, 8); b.walker(56, 7); b.spikes(59, 59, 7);
    b.oneway(62, 64, 10); b.oneway(66, 68, 12);
    b.coins(62, 64, 9); b.coins(66, 68, 11); b.flyer(65, 6);
    b.island(70, 80, 13); b.walker(74, 12); b.walker(78, 12);
    b.plat(81, 13, 6, 0, 4.5); b.plat(91, 12, 6, 0, 4.5, 0.5);
    b.coins(84, 86, 11); b.coins(94, 96, 10);
    b.island(101, 110, 12); b.cp(102, 11);
    b.spikes(105, 106, 11); b.coin(105, 8); b.coin(106, 8);
    b.spring(109, 11);
    b.island(112, 120, 5); b.walker(117, 4); b.coins(113, 119, 3);
    b.oneway(122, 124, 7); b.coins(122, 124, 6);
    b.plat(126, 7, 0, 6, 5);
    b.coin(127, 5);
    b.island(130, 138, 13); b.walker(133, 12); b.spikes(136, 136, 12);
    b.coin(140, 10);
    b.island(142, 143, 12); b.coin(142, 10); b.coin(143, 10);
    b.flyer(145, 8, 50);
    b.island(147, 159, 11, 3); b.coins(150, 153, 9); b.goal(155, 10);
  } }
];
const LEVELS = LEVEL_DEFS.map(makeLevel);

// ---------------------------------------------------------------- simulation
function tileAt(L, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return 0;
  return L.tiles[ty * L.w + tx];
}
function solid(L, tx, ty) {
  if (tx < 0 || tx >= L.w) return true;
  if (ty < 0 || ty >= L.h) return false;
  return L.tiles[ty * L.w + tx] === 1;
}
function platS(pl, t) { return 0.5 - 0.5 * Math.cos(6.283185307 * (t / pl.period + pl.phase)); }
function platX(pl, t) { return pl.ox + pl.ax * platS(pl, t); }
function platY(pl, t) { return pl.oy + pl.ay * platS(pl, t); }

function newPlayer(sx, sy) {
  const x = sx - PW / 2, y = sy - PH;
  return { x: x, y: y, px: x, py: y, vx: 0, vy: 0, ground: false, onOne: false, coy: 0, buf: 0,
    face: 1, dead: false, deadT: 0, ride: -1, jh: true, drop: 0, spr: false };
}
function spawnEnemy(d) {
  if (d.type === 0) return { type: 0, x: d.x, y: d.y, dir: -1, alive: true, dt: 0 };
  return { type: 1, x: d.ox - EW / 2, y: d.oy - 10, ox: d.ox, oy: d.oy, range: d.range, ph: d.ph, dir: 1, alive: true, dt: 0 };
}
function newState(L) {
  return { t: 0, p: newPlayer(L.sx, L.sy), en: L.enemies.map(spawnEnemy), got: new Uint8Array(L.coins.length),
    nGot: 0, cp: -1, sx: L.sx, sy: L.sy, done: false, deaths: 0, ev: [] };
}
function cloneState(s) {
  return { t: s.t, p: Object.assign({}, s.p), en: s.en.map(function (e) { return Object.assign({}, e); }),
    got: s.got.slice(), nGot: s.nGot, cp: s.cp, sx: s.sx, sy: s.sy, done: s.done, deaths: s.deaths, ev: [] };
}

function kill(s) {
  const p = s.p;
  if (p.dead) return;
  p.dead = true; p.deadT = 0; s.deaths++;
  s.ev.push({ k: 'die', x: p.x + PW / 2, y: p.y + PH / 2 });
}

function step(L, s, inp) {
  if (s.done) return;
  s.t += DT;
  const t = s.t, p = s.p;

  // enemies
  for (let i = 0; i < s.en.length; i++) {
    const e = s.en[i];
    if (!e.alive) { e.dt += DT; continue; }
    if (e.type === 0) {
      const ox = e.x;
      e.x += e.dir * 55 * DT;
      const tx = Math.floor((e.dir > 0 ? e.x + EW : e.x) / T), ty = Math.floor((e.y + EH - 1) / T);
      const ahead = tileAt(L, tx, ty), below = tileAt(L, tx, ty + 1);
      if (solid(L, tx, ty) || ahead === 3 || ahead === 4 || !(below === 1 || below === 2)) { e.x = ox; e.dir = -e.dir; }
    } else {
      const nx = e.ox + e.range * Math.sin(t * 1.5 + e.ph) - EW / 2;
      e.dir = nx >= e.x ? 1 : -1;
      e.x = nx;
      e.y = e.oy + 10 * Math.sin(t * 3 + e.ph) - 10;
    }
  }

  if (p.dead) {
    p.deadT += DT;
    p.jh = inp.jump;
    if (p.deadT > 0.85) {
      s.p = newPlayer(s.sx, s.sy);
      s.p.jh = inp.jump;
      s.en = L.enemies.map(spawnEnemy);
      s.ev.push({ k: 'respawn', x: s.sx, y: s.sy });
    }
    return;
  }

  p.px = p.x; p.py = p.y;
  let carry = 0;
  if (p.ride >= 0) {
    const pl = L.plats[p.ride];
    carry = platX(pl, t) - platX(pl, t - DT);
    p.y = platY(pl, t) - PH;
  }

  // input
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const jp = inp.jump && !p.jh;
  p.jh = inp.jump;
  if (jp) p.buf = BUFFER; else p.buf -= DT;
  if (p.ground) p.coy = COYOTE; else p.coy -= DT;
  if (p.drop > 0) p.drop -= DT;

  if (dir) {
    let acc = p.ground ? 2600 : 1900;
    if (p.vx * dir < 0) acc *= 1.9;
    p.vx += dir * acc * DT;
    if (p.vx > RUN) p.vx = RUN; else if (p.vx < -RUN) p.vx = -RUN;
    p.face = dir;
  } else {
    const fr = (p.ground ? 2600 : 800) * DT;
    if (Math.abs(p.vx) <= fr) p.vx = 0; else p.vx -= Math.sign(p.vx) * fr;
  }

  if (p.buf > 0 && p.coy > 0) {
    if (inp.down && p.onOne && p.ride < 0) {
      p.drop = 0.2;
    } else {
      p.vy = -JUMP; p.spr = false;
      s.ev.push({ k: 'jump', x: p.x + PW / 2, y: p.y + PH });
    }
    p.buf = 0; p.coy = 0; p.ground = false; p.ride = -1;
  }

  let g = GRAV;
  if (p.vy < 0 && !inp.jump && !p.spr) g *= 2.8;          // variable jump height
  else if (Math.abs(p.vy) < 70 && inp.jump) g *= 0.55;     // a little hang time at the apex
  p.vy += g * DT;
  if (p.vy > MAXFALL) p.vy = MAXFALL;
  if (p.vy >= 0) p.spr = false;

  // move X
  let nx = p.x + p.vx * DT + carry;
  const mdx = nx - p.x;
  {
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 1e-4) / T);
    if (mdx > 0) {
      const tx = Math.floor((nx + PW - 1e-4) / T);
      for (let ty = y0; ty <= y1; ty++) if (solid(L, tx, ty)) { nx = tx * T - PW; if (p.vx > 0) p.vx = 0; break; }
    } else if (mdx < 0) {
      const tx = Math.floor(nx / T);
      for (let ty = y0; ty <= y1; ty++) if (solid(L, tx, ty)) { nx = (tx + 1) * T; if (p.vx < 0) p.vx = 0; break; }
    }
  }
  p.x = nx;

  // move Y
  const oldBottom = p.y + PH, fallV = p.vy;
  let ny = p.y + p.vy * DT, landed = false, ride = -1;
  p.onOne = false;
  {
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 1e-4) / T);
    if (p.vy < 0) {
      const ty = Math.floor(ny / T);
      for (let tx = x0; tx <= x1; tx++) if (solid(L, tx, ty)) { ny = (ty + 1) * T; p.vy = 0; break; }
    } else {
      const ty = Math.floor((ny + PH - 1e-4) / T);
      let hitSolid = false, hitOne = false;
      for (let tx = x0; tx <= x1; tx++) {
        if (solid(L, tx, ty)) hitSolid = true;
        else if (tileAt(L, tx, ty) === 2 && p.drop <= 0 && oldBottom <= ty * T + 0.01) hitOne = true;
      }
      if (hitSolid || hitOne) { ny = ty * T - PH; landed = true; p.onOne = !hitSolid; }
      for (let i = 0; i < L.plats.length; i++) {
        const pl = L.plats[i], ax = platX(pl, t);
        if (p.x + PW <= ax || p.x >= ax + pl.w) continue;
        const ay = platY(pl, t), oy = platY(pl, t - DT);
        if (oldBottom <= Math.max(oy, ay) + 6 && ny + PH >= ay) { ny = ay - PH; landed = true; ride = i; p.onOne = false; }
      }
    }
  }
  if (landed) {
    if (!p.ground && fallV > 300) s.ev.push({ k: 'land', x: p.x + PW / 2, y: ny + PH, v: fallV });
    p.vy = 0;
  }
  p.ground = landed; p.ride = ride; p.y = ny;

  if (p.y > L.h * T + 48) { kill(s); return; }

  // tiles the player overlaps: spikes, springs, coins
  {
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 1e-4) / T);
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 1e-4) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) continue;
      const idx = ty * L.w + tx, v = L.tiles[idx];
      if (v === 3) {
        const X = tx * T, Y = ty * T;
        if (p.x + PW > X + 6 && p.x < X + T - 6 && p.y + PH > Y + 15) { kill(s); return; }
      } else if (v === 4) {
        const X = tx * T, Y = ty * T;
        if (p.vy >= 0 && p.x + PW > X + 3 && p.x < X + T - 3 && p.y + PH > Y + 14) {
          p.vy = -SPRING; p.spr = true; p.ground = false; p.ride = -1; p.coy = 0;
          s.ev.push({ k: 'spring', x: tx, y: ty });
        }
      }
      const ci = L.coinAt[idx];
      if (ci >= 0 && !s.got[ci]) {
        const c = L.coins[ci];
        if (p.x + PW > c.x - 11 && p.x < c.x + 11 && p.y + PH > c.y - 11 && p.y < c.y + 11) {
          s.got[ci] = 1; s.nGot++;
          s.ev.push({ k: 'coin', x: c.x, y: c.y, i: ci });
        }
      }
    }
  }

  // enemies vs player
  for (let i = 0; i < s.en.length; i++) {
    const e = s.en[i];
    if (!e.alive) continue;
    const eh = e.type === 0 ? EH : 20;
    if (p.x + PW > e.x + 2 && p.x < e.x + EW - 2 && p.y + PH > e.y + 2 && p.y < e.y + eh) {
      if (p.vy > 0 && p.y + PH - e.y < 16) {
        e.alive = false; e.dt = 0;
        p.vy = inp.jump ? -650 : -420; p.spr = false; p.ground = false; p.ride = -1;
        s.ev.push({ k: 'stomp', x: e.x + EW / 2, y: e.y + eh / 2, type: e.type });
      } else { kill(s); return; }
    }
  }

  // checkpoints and goal
  for (let i = s.cp + 1; i < L.cps.length; i++) {
    const c = L.cps[i];
    if (p.x + PW > c.x && p.x < c.x + T && p.y + PH > c.y - T && p.y < c.y + T) {
      s.cp = i; s.sx = c.x + T / 2; s.sy = c.y + T;
      s.ev.push({ k: 'cp', x: c.x + T / 2, y: c.y });
    }
  }
  const gl = L.goal;
  if (gl && p.x + PW > gl.x - 2 && p.x < gl.x + T + 2 && p.y + PH > gl.y - 2 * T && p.y < gl.y + T) {
    s.done = true;
    s.ev.push({ k: 'win', x: gl.x + T / 2, y: gl.y });
  }
}

// ---------------------------------------------------------------- drawing helpers
const THEMES = {
  hills: { sky: ['#4fa8ea', '#bfe6ff'], far: '#9fd6b4', near: '#6dbd86', dirt: '#8f5f3e', dirt2: '#7c5033', edge: '#5f3c26',
    top: '#62cc55', top2: '#3e9b3f', topHi: '#9be87f', cloud: 'rgba(255,255,255,.85)', sun: '#fff6c8' },
  cave: { sky: ['#15112a', '#3a2a58'], far: '#231b3f', near: '#30254f', dirt: '#544a75', dirt2: '#473e65', edge: '#2c2545',
    top: '#8d83bd', top2: '#6a609a', topHi: '#b5acde', cloud: null, sun: null },
  sky: { sky: ['#f2778a', '#ffd9a0'], far: '#e98c8a', near: '#c96f86', dirt: '#7d5a80', dirt2: '#6b4b70', edge: '#4a3352',
    top: '#fff3dc', top2: '#e3c9b0', topHi: '#ffffff', cloud: 'rgba(255,240,225,.8)', sun: '#fff2c0' }
};

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function buildTiles(L) {
  const cv = document.createElement('canvas');
  cv.width = L.w * T; cv.height = L.h * T;
  const c = cv.getContext('2d'), th = THEMES[L.theme], rnd = rng(L.w * 131 + L.h * 7);
  const sol = function (x, y) { return x < 0 || x >= L.w || y >= L.h ? true : (y < 0 ? false : L.tiles[y * L.w + x] === 1); };
  for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
    const v = L.tiles[ty * L.w + tx], X = tx * T, Y = ty * T;
    if (v === 1) {
      c.fillStyle = th.dirt; c.fillRect(X, Y, T, T);
      c.fillStyle = th.dirt2;
      for (let i = 0; i < 3; i++) c.fillRect(X + (rnd() * 25 | 0), Y + (rnd() * 26 | 0), 4 + (rnd() * 4 | 0), 3 + (rnd() * 3 | 0));
      c.fillStyle = th.edge;
      if (!sol(tx - 1, ty)) c.fillRect(X, Y, 2, T);
      if (!sol(tx + 1, ty)) c.fillRect(X + T - 2, Y, 2, T);
      if (!sol(tx, ty + 1)) c.fillRect(X, Y + T - 3, T, 3);
      if (!sol(tx, ty - 1)) {
        c.fillStyle = th.top; c.fillRect(X, Y, T, 9);
        c.fillStyle = th.top2; c.fillRect(X, Y + 9, T, 2);
        for (let i = 0; i < 4; i++) c.fillRect(X + i * 8 + 1, Y + 11, 5, 2);
        c.fillStyle = th.topHi; c.fillRect(X, Y, T, 2);
        const above = tileAt(L, tx, ty - 1), r = rnd();
        if (above === 0 && ty > 0) {
          if (L.theme === 'hills') {
            if (r < 0.3) { c.fillStyle = th.top2; const gx = X + 4 + (rnd() * 18 | 0); c.fillRect(gx, Y - 5, 2, 5); c.fillRect(gx + 3, Y - 7, 2, 7); c.fillRect(gx + 6, Y - 4, 2, 4); }
            else if (r < 0.4) { const gx = X + 8 + (rnd() * 14 | 0); c.fillStyle = '#3e9b3f'; c.fillRect(gx, Y - 7, 2, 7); c.fillStyle = r < 0.35 ? '#ff6b8b' : '#ffd54a'; c.fillRect(gx - 2, Y - 11, 6, 5); c.fillStyle = '#fff'; c.fillRect(gx, Y - 9, 2, 2); }
          } else if (L.theme === 'cave') {
            if (r < 0.14) { const gx = X + 8 + (rnd() * 14 | 0), hh = 8 + (rnd() * 8 | 0); c.fillStyle = r < 0.07 ? '#6fe6ff' : '#c58bff'; c.beginPath(); c.moveTo(gx - 4, Y); c.lineTo(gx, Y - hh); c.lineTo(gx + 4, Y); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(gx - 1, Y); c.lineTo(gx, Y - hh); c.lineTo(gx + 1, Y); c.fill(); }
          } else if (r < 0.2) { c.fillStyle = '#ffb36b'; const gx = X + 4 + (rnd() * 18 | 0); c.fillRect(gx, Y - 4, 2, 4); c.fillRect(gx + 3, Y - 6, 2, 6); }
        }
      }
    } else if (v === 2) {
      c.fillStyle = '#b07a45'; c.fillRect(X, Y, T, 9);
      c.fillStyle = '#d9a566'; c.fillRect(X, Y, T, 3);
      c.fillStyle = '#7d5129'; c.fillRect(X, Y + 9, T, 2); c.fillRect(X + 15, Y + 3, 2, 6);
      if (tileAt(L, tx - 1, ty) !== 2) c.fillRect(X, Y, 2, 11);
      if (tileAt(L, tx + 1, ty) !== 2) c.fillRect(X + T - 2, Y, 2, 11);
    } else if (v === 3) {
      for (let i = 0; i < 3; i++) {
        const sx = X + 1 + i * 10;
        c.fillStyle = '#d9dde6'; c.beginPath(); c.moveTo(sx, Y + T); c.lineTo(sx + 5, Y + 11); c.lineTo(sx + 10, Y + T); c.fill();
        c.fillStyle = '#8b93a6'; c.beginPath(); c.moveTo(sx + 5, Y + 11); c.lineTo(sx + 10, Y + T); c.lineTo(sx + 6, Y + T); c.fill();
      }
    }
  }
  return cv;
}

function hillY(x, seed, amp, f) {
  return Math.sin(x * f + seed) * amp + Math.sin(x * f * 2.3 + seed * 1.7) * amp * 0.45 + Math.sin(x * f * 0.47 + seed * 3.1) * amp * 0.6;
}
function drawHills(c, color, off, base, amp, f, seed, vw, vh, inv) {
  c.fillStyle = color; c.beginPath(); c.moveTo(0, inv ? 0 : vh);
  for (let x = 0; x <= vw + 12; x += 12) c.lineTo(x, base + hillY(x + off, seed, amp, f));
  c.lineTo(vw + 12, inv ? 0 : vh); c.fill();
}
function drawCloud(c, x, y, s) {
  c.beginPath();
  const E = [[0, 0, 34, 14], [-24, 5, 22, 11], [26, 6, 24, 10], [6, -9, 20, 12]];
  for (let i = 0; i < 4; i++) { const e = E[i]; c.moveTo(x + (e[0] + e[2]) * s, y + e[1] * s); c.ellipse(x + e[0] * s, y + e[1] * s, e[2] * s, e[3] * s, 0, 0, 6.2832); }
  c.fill();
}
function drawBg(c, L, cx, cy, vw, vh, rt) {
  const th = THEMES[L.theme];
  const g = c.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, vw, vh);
  const vy = cy * 0.15;
  if (th.sun) {
    const sx = vw * 0.74, sy = (L.theme === 'sky' ? vh * 0.62 : vh * 0.2) - vy;
    c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(sx, sy, 78, 0, 7); c.fill();
    c.fillStyle = th.sun; c.beginPath(); c.arc(sx, sy, 48, 0, 7); c.fill();
  }
  if (th.cloud) {
    c.fillStyle = th.cloud;
    const r = rng(L.w), n = L.theme === 'sky' ? 12 : 7, span = vw + 400;
    for (let i = 0; i < n; i++) {
      const par = 0.12 + r() * 0.2, bx = r() * span, by = 30 + r() * vh * (L.theme === 'sky' ? 0.8 : 0.4), s = 0.6 + r() * 0.9;
      const x = (((bx - cx * par + rt * 6 * par) % span) + span) % span - 200;
      drawCloud(c, x, by - vy, s);
    }
  }
  if (L.theme === 'cave') {
    drawHills(c, th.far, cx * 0.25, 120 - vy, 50, 0.011, 3, vw, vh, true);
    drawHills(c, th.far, cx * 0.25, vh - 150 - vy, 60, 0.009, 1, vw, vh, false);
    drawHills(c, th.near, cx * 0.5, 60 - vy, 34, 0.021, 7, vw, vh, true);
    drawHills(c, th.near, cx * 0.5, vh - 70 - vy, 40, 0.017, 5, vw, vh, false);
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      const span = vw + 100, x = (((r() * span - cx * 0.35) % span) + span) % span - 50, y = r() * vh, tw = 0.5 + 0.5 * Math.sin(rt * 2 + i * 1.7);
      c.fillStyle = 'rgba(150,220,255,' + (0.15 + 0.35 * tw).toFixed(3) + ')';
      c.fillRect(x, y, 2, 2);
    }
  } else {
    drawHills(c, th.far, cx * 0.2, vh * 0.66 - vy, 46, 0.006, 2, vw, vh, false);
    drawHills(c, th.near, cx * 0.42, vh * 0.8 - vy, 34, 0.011, 9, vw, vh, false);
  }
}

function drawPlayer(c, x, footY, face, sqx, sqy, runPh, air, vy, rt) {
  c.save(); c.translate(x, footY); c.scale(face * sqx, sqy);
  // scarf tail
  c.fillStyle = '#35b6ff';
  const fl = Math.sin(rt * 14) * 2;
  c.beginPath(); c.moveTo(-9, -15); c.lineTo(-19, -17 + fl - (air ? vy * 0.006 : 0)); c.lineTo(-18, -11 + fl); c.lineTo(-9, -11); c.fill();
  // feet
  c.fillStyle = '#4a2d3c';
  if (air) { rr(c, -9, -5 + (vy < 0 ? 0 : -2), 8, 6, 2); c.fill(); rr(c, 2, -5 + (vy < 0 ? -2 : 0), 8, 6, 2); c.fill(); }
  else {
    const a = Math.sin(runPh) * 5, l1 = Math.max(0, Math.cos(runPh)) * 3, l2 = Math.max(0, -Math.cos(runPh)) * 3;
    rr(c, -8 + a, -6 - l1, 8, 6, 2); c.fill(); rr(c, 1 - a, -6 - l2, 8, 6, 2); c.fill();
  }
  // body
  c.fillStyle = '#f26a3d'; rr(c, -11, -31, 22, 27, 8); c.fill();
  c.fillStyle = '#ff9a5c'; rr(c, -9, -30, 14, 10, 5); c.fill();
  c.fillStyle = '#ffe2bd'; rr(c, -2, -17, 12, 12, 5); c.fill();
  // ears
  c.fillStyle = '#f26a3d';
  c.beginPath(); c.moveTo(-9, -28); c.lineTo(-7, -38); c.lineTo(-1, -30); c.fill();
  c.beginPath(); c.moveTo(2, -30); c.lineTo(8, -38); c.lineTo(10, -27); c.fill();
  // scarf
  c.fillStyle = '#35b6ff'; c.fillRect(-11, -16, 22, 4);
  // eyes
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-1, -22, 4, 0, 7); c.arc(7, -22, 4, 0, 7); c.fill();
  c.fillStyle = '#2a1b2e'; c.beginPath(); c.arc(0.5, -22 + (air && vy > 0 ? 1 : 0), 2, 0, 7); c.arc(8.5, -22 + (air && vy > 0 ? 1 : 0), 2, 0, 7); c.fill();
  c.restore();
}

function drawWalker(c, e, rt) {
  const cx = e.x + EW / 2, by = e.y + EH;
  c.save(); c.translate(cx, by);
  if (!e.alive) { const k = Math.max(0, 1 - e.dt * 4); c.globalAlpha = k; c.scale(1.3, 0.25); }
  else { const q = Math.sin(rt * 9 + e.x * 0.1) * 0.08; c.scale(1 + q, 1 - q); }
  c.fillStyle = '#7b4bd6';
  c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-15, -25, 0, -25); c.quadraticCurveTo(15, -25, 14, 0); c.fill();
  c.fillStyle = '#a57cf0'; c.beginPath(); c.ellipse(-4, -18, 5, 3, -0.4, 0, 7); c.fill();
  c.fillStyle = '#4b2a94'; c.fillRect(-14, -3, 28, 3);
  const d = e.dir;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-4 + d * 3, -12, 4, 0, 7); c.arc(5 + d * 3, -12, 4, 0, 7); c.fill();
  c.fillStyle = '#1d1030'; c.beginPath(); c.arc(-4 + d * 4.5, -11.5, 2, 0, 7); c.arc(5 + d * 4.5, -11.5, 2, 0, 7); c.fill();
  c.strokeStyle = '#1d1030'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9 + d * 3, -18); c.lineTo(-1 + d * 3, -15.5); c.moveTo(10 + d * 3, -18); c.lineTo(2 + d * 3, -15.5); c.stroke();
  c.restore();
}
function drawFlyer(c, e, rt) {
  const cx = e.x + EW / 2, cy = e.y + 10;
  c.save(); c.translate(cx, cy);
  if (!e.alive) { c.globalAlpha = Math.max(0, 1 - e.dt * 4); c.translate(0, e.dt * 120); c.rotate(e.dt * 8); }
  const fl = Math.sin(rt * 22 + e.ph) * 9;
  c.fillStyle = '#ffd0d8';
  c.beginPath(); c.moveTo(-8, -3); c.lineTo(-24, -8 - fl); c.lineTo(-18, 4); c.fill();
  c.beginPath(); c.moveTo(8, -3); c.lineTo(24, -8 - fl); c.lineTo(18, 4); c.fill();
  c.fillStyle = '#e8435e'; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill();
  c.fillStyle = '#ff7d8f'; c.beginPath(); c.ellipse(-3, -6, 5, 3, -0.4, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-4 + e.dir * 2, -1, 3.6, 0, 7); c.arc(5 + e.dir * 2, -1, 3.6, 0, 7); c.fill();
  c.fillStyle = '#2a0f18'; c.beginPath(); c.arc(-4 + e.dir * 3.2, -0.5, 1.8, 0, 7); c.arc(5 + e.dir * 3.2, -0.5, 1.8, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-4, 7); c.lineTo(-2, 11); c.lineTo(0, 7); c.lineTo(2, 11); c.lineTo(4, 7); c.fill();
  c.restore();
}

// F (effects) may be null; ppx/ppy is the interpolated player position.
function drawWorld(c, L, S, cx, cy, vw, vh, rt, F, ppx, ppy) {
  drawBg(c, L, cx, cy, vw, vh, rt);
  if (!L.cv) L.cv = buildTiles(L);
  c.save(); c.translate(-cx, -cy);

  // moving platform tracks
  c.fillStyle = 'rgba(255,255,255,.28)';
  for (let i = 0; i < L.plats.length; i++) {
    const pl = L.plats[i], n = Math.round((Math.abs(pl.ax) + Math.abs(pl.ay)) / 24);
    for (let j = 0; j <= n; j++) c.fillRect(pl.ox + pl.w / 2 + pl.ax * j / n - 2, pl.oy + 5 + pl.ay * j / n, 4, 4);
  }

  const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy));
  const sw = Math.min(L.cv.width - sx, Math.ceil(vw) + 2), sh = Math.min(L.cv.height - sy, Math.ceil(vh) + 2);
  if (sw > 0 && sh > 0) c.drawImage(L.cv, sx, sy, sw, sh, sx, sy, sw, sh);

  const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(L.w - 1, Math.floor((cx + vw) / T));
  const ty0 = Math.max(0, Math.floor(cy / T)), ty1 = Math.min(L.h - 1, Math.floor((cy + vh) / T));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const idx = ty * L.w + tx, v = L.tiles[idx], X = tx * T, Y = ty * T;
    if (v === 4) {
      const k = F && F.springs[idx] ? F.springs[idx] / 0.3 : 0, ext = k * 12;
      c.fillStyle = '#5a6072'; c.fillRect(X + 5, Y + T - 5, 22, 5);
      c.strokeStyle = '#c9ced9'; c.lineWidth = 3; c.beginPath();
      const top = Y + 15 - ext;
      for (let i = 0; i <= 4; i++) c.lineTo(X + (i % 2 ? 22 : 10), top + 4 + (Y + T - 7 - top - 4) * i / 4);
      c.stroke();
      c.fillStyle = '#ff4d5e'; rr(c, X + 3, top - 2, 26, 7, 3); c.fill();
      c.fillStyle = '#ff9aa4'; c.fillRect(X + 7, top - 1, 18, 2);
    }
    const ci = L.coinAt[idx];
    if (ci >= 0 && !S.got[ci]) {
      const co = L.coins[ci], w = Math.cos(rt * 4 + tx * 0.6), y = co.y + Math.sin(rt * 3 + tx * 0.8) * 2.5;
      c.fillStyle = '#c98a12'; c.beginPath(); c.ellipse(co.x, y, Math.abs(w) * 9 + 1.5, 10, 0, 0, 7); c.fill();
      c.fillStyle = '#ffd23e'; c.beginPath(); c.ellipse(co.x, y, Math.abs(w) * 7.5 + 0.8, 8.5, 0, 0, 7); c.fill();
      c.fillStyle = '#fff4b8'; c.beginPath(); c.ellipse(co.x - w * 2, y - 2, Math.abs(w) * 2.5 + 0.5, 4, 0, 0, 7); c.fill();
    }
  }

  // checkpoints
  for (let i = 0; i < L.cps.length; i++) {
    const cp = L.cps[i], on = i <= S.cp, X = cp.x + 10, Y = cp.y + T;
    c.fillStyle = '#6b7183'; c.fillRect(X, Y - 54, 4, 54);
    c.fillStyle = '#454a59'; c.fillRect(X - 5, Y - 4, 14, 4);
    const wv = on ? Math.sin(rt * 7) * 3 : 0;
    c.fillStyle = on ? '#4be06a' : '#9aa0b0';
    c.beginPath(); c.moveTo(X + 4, Y - 54); c.lineTo(X + 26, Y - 47 + wv); c.lineTo(X + 4, Y - 38); c.fill();
    if (on) { c.fillStyle = 'rgba(120,255,150,.18)'; c.beginPath(); c.arc(X + 2, Y - 46, 22 + Math.sin(rt * 4) * 3, 0, 7); c.fill(); }
  }
  // goal
  if (L.goal) {
    const X = L.goal.x + 14, Y = L.goal.y + T;
    c.fillStyle = 'rgba(255,230,120,.16)'; c.beginPath(); c.arc(X + 2, Y - 70, 46 + Math.sin(rt * 3) * 5, 0, 7); c.fill();
    c.fillStyle = '#e9edf5'; c.fillRect(X, Y - 96, 5, 96);
    c.fillStyle = '#8d93a5'; c.fillRect(X - 7, Y - 5, 19, 5);
    c.fillStyle = '#ffd23e'; c.beginPath(); c.arc(X + 2.5, Y - 99, 6, 0, 7); c.fill();
    c.fillStyle = '#ff5a6e'; c.beginPath(); c.moveTo(X + 5, Y - 94);
    for (let i = 0; i <= 6; i++) c.lineTo(X + 5 + i * 6, Y - 94 + Math.sin(rt * 6 + i * 0.9) * 2.5 * (i / 6));
    for (let i = 6; i >= 0; i--) c.lineTo(X + 5 + i * 6, Y - 68 + Math.sin(rt * 6 + i * 0.9) * 2.5 * (i / 6));
    c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X + 22, Y - 81, 5, 0, 7); c.fill();
  }

  // moving platforms
  for (let i = 0; i < L.plats.length; i++) {
    const pl = L.plats[i], X = platX(pl, rt), Y = platY(pl, rt);
    c.fillStyle = 'rgba(0,0,0,.18)'; rr(c, X + 2, Y + 4, pl.w, pl.h, 5); c.fill();
    c.fillStyle = '#566080'; rr(c, X, Y, pl.w, pl.h, 5); c.fill();
    c.fillStyle = '#8fa0d0'; rr(c, X + 2, Y + 1, pl.w - 4, 5, 3); c.fill();
    c.fillStyle = '#ffd23e'; c.fillRect(X + 6, Y + 8, 4, 3); c.fillRect(X + pl.w - 10, Y + 8, 4, 3);
  }

  // enemies
  for (let i = 0; i < S.en.length; i++) {
    const e = S.en[i];
    if (!e.alive && e.dt > 0.3) continue;
    if (e.x > cx + vw + 60 || e.x < cx - 60) continue;
    if (e.type === 0) drawWalker(c, e, rt); else drawFlyer(c, e, rt);
  }

  // player
  const p = S.p;
  if (!p.dead) {
    const x = (ppx === undefined ? p.x : ppx) + PW / 2, y = (ppy === undefined ? p.y : ppy) + PH;
    drawPlayer(c, x, y, p.face, F ? F.sqx : 1, F ? F.sqy : 1, F ? F.runPh : 0, !p.ground, p.vy, rt);
  }

  // particles
  if (F) {
    for (let i = 0; i < F.parts.length; i++) {
      const q = F.parts[i], k = q.life / q.max;
      c.globalAlpha = Math.min(1, k * 2); c.fillStyle = q.color;
      if (q.round) { c.beginPath(); c.arc(q.x, q.y, q.size * (0.4 + 0.6 * k), 0, 7); c.fill(); }
      else c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

// ---------------------------------------------------------------- public API (used by the test page)
window.EmberHop = { T: T, DT: DT, LEVELS: LEVELS, newState: newState, cloneState: cloneState, step: step, drawWorld: drawWorld };

// ---------------------------------------------------------------- game shell
const canvas = document.getElementById('game');
if (!canvas) return;
const ctx = canvas.getContext('2d');

let mode = 'title', li = 0, L = LEVELS[0], S = newState(L);
let acc = 0, last = 0, alpha = 1, fade = 0, modeT = 0, shake = 0;
let cam = { x: 0, y: 0, look: 0 };
let muted = false, bestNew = false;
const totals = { coins: 0, max: 0, time: 0, deaths: 0 };
const F = { parts: [], springs: {}, sqx: 1, sqy: 1, runPh: 0 };
const keys = {};
const input = { left: false, right: false, jump: false, down: false };

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* ignore */ }
  return null;
}
muted = store('emberhop_muted') === '1';

function readInput() {
  input.left = !!(keys.ArrowLeft || keys.KeyA);
  input.right = !!(keys.ArrowRight || keys.KeyD);
  input.down = !!(keys.ArrowDown || keys.KeyS);
  input.jump = !!(keys.Space || keys.ArrowUp || keys.KeyW || keys.KeyZ || keys.KeyX);
}

// ---- audio
let ac = null, master = null, nextNote = 0, noteI = 0;
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  } catch (e) { ac = null; }
}
function tone(freq, dur, type, vol, slide, when) {
  if (!ac || muted) return;
  const t = when || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol || 0.1, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}
const SFX = {
  jump() { tone(330, 0.16, 'square', 0.07, 330); },
  land() { tone(110, 0.07, 'triangle', 0.12, -50); },
  coin() { const t = ac ? ac.currentTime : 0; tone(988, 0.07, 'square', 0.06, 0, t); tone(1319, 0.2, 'square', 0.06, 0, t + 0.07); },
  stomp() { tone(260, 0.14, 'square', 0.09, -180); tone(120, 0.12, 'triangle', 0.15, -60); },
  spring() { tone(220, 0.3, 'sawtooth', 0.06, 700); },
  die() { tone(400, 0.45, 'sawtooth', 0.09, -340); tone(200, 0.45, 'square', 0.05, -160); },
  cp() { const t = ac ? ac.currentTime : 0; [523, 659, 784].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.13, 0, t + i * 0.09); }); },
  win() { const t = ac ? ac.currentTime : 0; [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'square', 0.07, 0, t + i * 0.12); }); }
};
const R = -99;
const MEL = [12, R, 16, R, 19, 16, 12, R, 14, R, 17, R, 21, 17, 14, R, 12, R, 16, 19, 24, R, 19, R, 17, 16, 14, R, 12, R, R, R];
const BASS = [0, 2, 0, 7];
const SONG = { hills: { tr: 0, minor: false, step: 0.2 }, cave: { tr: -4, minor: true, step: 0.25 }, sky: { tr: 3, minor: false, step: 0.18 } };
function music() {
  if (!ac || muted || mode !== 'play') { nextNote = 0; return; }
  const sg = SONG[L.theme], now = ac.currentTime;
  if (nextNote < now - 0.3) { nextNote = now + 0.05; }
  while (nextNote < now + 0.12) {
    const i = noteI % 32;
    let m = MEL[i];
    if (m !== R) {
      if (sg.minor && (m === 16 || m === 21)) m -= 1;
      tone(261.63 * Math.pow(2, (m + sg.tr) / 12), sg.step * 1.6, 'triangle', 0.045, 0, nextNote);
    }
    if (i % 4 === 0 || i % 8 === 6) {
      let bn = BASS[i >> 3] + (i % 8 === 6 ? 7 : 0);
      tone(65.41 * Math.pow(2, (bn + sg.tr) / 12), sg.step * 1.8, 'triangle', 0.09, 0, nextNote);
    }
    nextNote += sg.step; noteI++;
  }
}

// ---- effects
function burst(x, y, n, colors, spd, life, size, grav, round) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = spd * (0.3 + Math.random() * 0.7);
    F.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life,
      color: colors[i % colors.length], size: size * (0.6 + Math.random() * 0.8), g: grav, round: !!round });
  }
  if (F.parts.length > 500) F.parts.splice(0, F.parts.length - 500);
}
function dust(x, y, n, dirx) {
  for (let i = 0; i < n; i++) F.parts.push({ x: x + (Math.random() - 0.5) * 14, y: y - 2, vx: (Math.random() - 0.5) * 90 + (dirx || 0), vy: -20 - Math.random() * 50,
    life: 0.35, max: 0.35, color: 'rgba(255,255,255,.75)', size: 4 + Math.random() * 3, g: 60, round: true });
}
function processEvents() {
  const quiet = mode === 'title';
  for (let i = 0; i < S.ev.length; i++) {
    const e = S.ev[i];
    switch (e.k) {
      case 'jump': F.sqx = 0.72; F.sqy = 1.3; dust(e.x, e.y, 5); if (!quiet) SFX.jump(); break;
      case 'land': F.sqx = 1.32; F.sqy = 0.7; dust(e.x, e.y, 6); if (!quiet && e.v > 450) SFX.land(); break;
      case 'coin': burst(e.x, e.y, 9, ['#ffd23e', '#fff4b8', '#ffffff'], 130, 0.45, 4, 200); SFX.coin(); break;
      case 'stomp': burst(e.x, e.y, 14, e.type ? ['#e8435e', '#ffd0d8', '#fff'] : ['#7b4bd6', '#a57cf0', '#fff'], 190, 0.5, 5, 500); shake = 0.12; F.sqx = 1.25; F.sqy = 0.75; SFX.stomp(); break;
      case 'spring': F.springs[e.y * L.w + e.x] = 0.3; F.sqx = 0.6; F.sqy = 1.5; SFX.spring(); break;
      case 'die': burst(e.x, e.y, 26, ['#f26a3d', '#ff9a5c', '#35b6ff', '#fff'], 300, 0.8, 6, 700); shake = 0.3; SFX.die(); break;
      case 'respawn': F.sqx = 0.5; F.sqy = 1.5; burst(e.x, e.y - 14, 12, ['#fff', '#9be8ff'], 120, 0.4, 4, 0, true); break;
      case 'cp': burst(e.x, e.y - 14, 18, ['#4be06a', '#c8ffd2', '#fff'], 170, 0.6, 4, 250); SFX.cp(); break;
      case 'win': burst(e.x, e.y - 50, 60, ['#ffd23e', '#ff5a6e', '#35b6ff', '#4be06a', '#fff'], 380, 1.4, 6, 450); SFX.win(); break;
    }
  }
  S.ev.length = 0;
}
function updateFx(dt) {
  const k = 1 - Math.exp(-dt * 12);
  F.sqx += (1 - F.sqx) * k; F.sqy += (1 - F.sqy) * k;
  if (S.p.ground) F.runPh += Math.abs(S.p.vx) * dt * 0.075; else F.runPh = 0;
  for (const key in F.springs) { F.springs[key] -= dt; if (F.springs[key] <= 0) delete F.springs[key]; }
  for (let i = F.parts.length - 1; i >= 0; i--) {
    const q = F.parts[i];
    q.life -= dt;
    if (q.life <= 0) { F.parts[i] = F.parts[F.parts.length - 1]; F.parts.pop(); continue; }
    q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
  }
  if (shake > 0) shake -= dt;
  if (fade > 0) fade -= dt * 2.2;
  modeT += dt;
}

// ---- flow
function setMode(m) { mode = m; modeT = 0; }
function startLevel(i, cpIndex) {
  li = i; L = LEVELS[i]; S = newState(L);
  if (cpIndex !== undefined && L.cps[cpIndex]) {
    const c = L.cps[cpIndex];
    S.cp = cpIndex; S.sx = c.x + T / 2; S.sy = c.y + T; S.p = newPlayer(S.sx, S.sy);
  }
  F.parts.length = 0; F.springs = {};
  acc = 0; fade = 1; noteI = 0; nextNote = 0;
  snapCam();
  setMode('play');
}
function camTarget() {
  const p = S.p;
  const px = p.px + (p.x - p.px) * alpha + PW / 2, py = p.py + (p.y - p.py) * alpha + PH / 2;
  return {
    x: Math.max(0, Math.min(L.w * T - VW, px - VW / 2 + cam.look)),
    y: Math.max(0, Math.min(L.h * T - VH, py - VH * 0.56))
  };
}
function snapCam() { cam.look = 0; const t = camTarget(); cam.x = t.x; cam.y = t.y; }
function updateCam(dt) {
  const p = S.p;
  if (p.dead) return;
  cam.look += (p.face * 70 - cam.look) * (1 - Math.exp(-dt * 2.5));
  const t = camTarget();
  cam.x += (t.x - cam.x) * (1 - Math.exp(-dt * 9));
  cam.y += (t.y - cam.y) * (1 - Math.exp(-dt * 5));
}
function finishLevel() {
  totals.coins += S.nGot; totals.max += L.coins.length; totals.time += S.t; totals.deaths += S.deaths;
  const key = 'emberhop_best_' + li, prev = parseFloat(store(key));
  bestNew = !(prev > 0) || S.t < prev;
  if (bestNew) store(key, S.t.toFixed(2));
  setMode('done');
}
function confirmKey() {
  if (mode === 'title') { totals.coins = totals.max = totals.time = totals.deaths = 0; startLevel(0); }
  else if (mode === 'pause') setMode('play');
  else if (mode === 'done' && modeT > 0.7) {
    if (li + 1 < LEVELS.length) startLevel(li + 1); else setMode('win');
  } else if (mode === 'win' && modeT > 0.7) { li = 0; L = LEVELS[0]; S = newState(L); snapCam(); fade = 1; setMode('title'); }
}

window.addEventListener('keydown', function (e) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  initAudio();
  if (e.code === 'KeyM') { muted = !muted; store('emberhop_muted', muted ? '1' : '0'); }
  if (e.code === 'Enter' || (e.code === 'Space' && mode !== 'play' && mode !== 'pause')) confirmKey();
  else if (mode === 'title' && /^Digit[1-3]$/.test(e.code)) { totals.coins = totals.max = totals.time = totals.deaths = 0; startLevel(+e.code.slice(5) - 1); }
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') setMode('pause'); else if (mode === 'pause') setMode('play'); }
  else if (e.code === 'KeyR' && (mode === 'play' || mode === 'pause')) startLevel(li);
  else if (e.code === 'KeyT' && mode === 'pause') { li = 0; L = LEVELS[0]; S = newState(L); snapCam(); fade = 1; setMode('title'); }
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { for (const k in keys) keys[k] = false; if (mode === 'play') setMode('pause'); });
canvas.addEventListener('mousedown', function () { initAudio(); if (mode !== 'play') confirmKey(); });

function resize() {
  const k = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = Math.floor(VW * k) + 'px'; canvas.style.height = Math.floor(VH * k) + 'px';
  canvas.width = Math.max(320, Math.floor(VW * k * dpr)); canvas.height = Math.max(180, Math.floor(VH * k * dpr));
}
window.addEventListener('resize', resize);
resize();

// ---- HUD / overlays
const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
function txt(s, x, y, size, color, align, outline) {
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = outline === undefined ? Math.max(3, size / 6) : outline;
  ctx.strokeStyle = 'rgba(20,14,34,.85)';
  if (ctx.lineWidth > 0) ctx.strokeText(s, x, y);
  ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function panel(w, h) {
  ctx.fillStyle = 'rgba(14,10,28,.55)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(28,22,52,.92)'; rr(ctx, (VW - w) / 2, (VH - h) / 2, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; rr(ctx, (VW - w) / 2, (VH - h) / 2, w, h, 18); ctx.stroke();
}
function drawHud() {
  ctx.fillStyle = '#c98a12'; ctx.beginPath(); ctx.arc(30, 30, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(30, 30, 9.5, 0, 7); ctx.fill();
  txt(S.nGot + ' / ' + L.coins.length, 50, 31, 22, '#fff');
  txt((li + 1) + '. ' + L.name, VW / 2, 30, 20, '#fff', 'center');
  txt(fmt(S.t), VW - 22, 30, 22, '#fff', 'right');
  if (S.deaths) txt('falls: ' + S.deaths, VW - 22, 56, 15, '#ffc9c9', 'right');
  if (muted) txt('muted (M)', 22, 58, 13, '#cfd3e6');
  if (li === 0 && S.t < 9 && S.cp < 0) {
    ctx.globalAlpha = Math.min(1, (9 - S.t) / 1.5);
    txt('Arrows / A D to move   -   Space to jump (hold for higher)   -   stomp enemies from above', VW / 2, VH - 30, 16, '#fff', 'center');
    ctx.globalAlpha = 1;
  }
}
function drawOverlays() {
  if (mode === 'title') {
    ctx.fillStyle = 'rgba(14,10,28,.35)'; ctx.fillRect(0, 0, VW, VH);
    const bob = Math.sin(modeT * 2) * 5;
    txt('EMBER HOP', VW / 2, 150 + bob, 92, '#ff9a4d', 'center', 14);
    txt('EMBER HOP', VW / 2, 146 + bob, 92, '#ffe08a', 'center', 0);
    txt('a tiny platformer in three worlds', VW / 2, 222, 22, '#fff', 'center');
    if (Math.sin(modeT * 5) > -0.4) txt('Press ENTER or SPACE to start', VW / 2, 318, 28, '#fff', 'center');
    ctx.fillStyle = 'rgba(14,10,28,.55)'; rr(ctx, 100, 376, 760, 114, 14); ctx.fill();
    txt('Move: Arrows / A D      Jump: Space / Z / Up (hold = higher)      Drop through planks: Down + Jump', VW / 2, 400, 15, '#e8ebff', 'center');
    txt('P / Esc: pause      R: restart level      M: mute      1-3: jump straight to a level', VW / 2, 426, 15, '#e8ebff', 'center');
    txt('Collect coins, bounce on baddies, reach the flag.', VW / 2, 468, 16, '#ffe08a', 'center');
  } else if (mode === 'pause') {
    panel(440, 230);
    txt('PAUSED', VW / 2, 210, 48, '#ffe08a', 'center');
    txt('P / Esc / Enter - resume', VW / 2, 272, 18, '#fff', 'center');
    txt('R - restart level        T - title screen', VW / 2, 302, 18, '#fff', 'center');
    txt('M - sound ' + (muted ? 'off' : 'on'), VW / 2, 332, 18, '#fff', 'center');
  } else if (mode === 'done') {
    if (modeT < 0.5) return;
    panel(480, 300);
    txt('LEVEL CLEAR!', VW / 2, 170, 46, '#ffe08a', 'center');
    txt(L.name, VW / 2, 214, 20, '#cfd3ff', 'center');
    txt('Coins   ' + S.nGot + ' / ' + L.coins.length + (S.nGot === L.coins.length ? '   PERFECT!' : ''), VW / 2, 258, 22, '#fff', 'center');
    txt('Time   ' + fmt(S.t) + (bestNew ? '   NEW BEST!' : '   (best ' + fmt(parseFloat(store('emberhop_best_' + li)) || S.t) + ')'), VW / 2, 292, 22, '#fff', 'center');
    txt('Falls   ' + S.deaths, VW / 2, 326, 22, '#fff', 'center');
    if (modeT > 0.7 && Math.sin(modeT * 5) > -0.4) txt('Press ENTER to continue', VW / 2, 378, 20, '#9be8ff', 'center');
  } else if (mode === 'win') {
    panel(540, 320);
    txt('YOU DID IT!', VW / 2, 160, 54, '#ffe08a', 'center');
    txt('All three worlds cleared', VW / 2, 208, 20, '#cfd3ff', 'center');
    txt('Coins   ' + totals.coins + ' / ' + totals.max, VW / 2, 256, 24, '#fff', 'center');
    txt('Total time   ' + fmt(totals.time), VW / 2, 292, 24, '#fff', 'center');
    txt('Falls   ' + totals.deaths, VW / 2, 328, 24, '#fff', 'center');
    if (modeT > 0.7 && Math.sin(modeT * 5) > -0.4) txt('Press ENTER for the title screen', VW / 2, 384, 20, '#9be8ff', 'center');
  }
}

function render() {
  const k = canvas.width / VW;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const p = S.p;
  let cx = cam.x, cy = cam.y;
  if (shake > 0) { cx += (Math.random() - 0.5) * shake * 40; cy += (Math.random() - 0.5) * shake * 40; }
  const rt = S.t - (1 - alpha) * DT;
  drawWorld(ctx, L, S, cx, cy, VW, VH, rt, F, p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha);
  if (mode !== 'title' && mode !== 'win') drawHud();
  drawOverlays();
  if (fade > 0) { ctx.fillStyle = 'rgba(13,11,20,' + Math.min(1, fade).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
}

const NOINPUT = { left: false, right: false, jump: false, down: false };
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode === 'play' || mode === 'title') {
    readInput();
    acc += dt;
    while (acc >= DT) {
      step(L, S, mode === 'play' ? input : NOINPUT);
      acc -= DT;
      const won = S.done;
      processEvents();
      if (won && mode === 'play') { finishLevel(); break; }
    }
    alpha = mode === 'play' || mode === 'title' ? acc / DT : 1;
    updateCam(dt);
  }
  if (mode !== 'pause') updateFx(dt);
  music();
  render();
  requestAnimationFrame(frame);
}

// debug entry: index.html#lvl=2 or #lvl=2&cp=0 starts directly in a level (optionally at a checkpoint)
(function () {
  const m = /lvl=(\d)/.exec(location.hash), c = /cp=(\d)/.exec(location.hash);
  if (m && LEVELS[+m[1] - 1]) startLevel(+m[1] - 1, c ? +c[1] : undefined);
  else snapCam();
  if (/nofade/.test(location.hash)) fade = 0;
})();
requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
})();
