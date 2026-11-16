// Pip's Leap - a small 2D platformer. Plain JS + Canvas 2D, no dependencies.
'use strict';
(() => {
const W = 480, H = 270, T = 16, DT = 1 / 60;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}

// ---------------------------------------------------------------- tuning
const P = {
  w: 10, h: 14,
  maxRun: 140, accGround: 1500, decGround: 2000, accAir: 1100, decAir: 550, turnBoost: 1.7,
  jumpV: 420, gUp: 1500, gDown: 2200, apexMul: 0.55, apexBand: 45, maxFall: 430, cut: 0.45,
  coyote: 0.1, buffer: 0.13,
  wallSlide: 70, wallJumpVX: 165, wallJumpVY: 390, wallLock: 0.15, wallCoyote: 0.1,
  springV: 700, stompV: 300, stompVHeld: 440,
};

// ---------------------------------------------------------------- themes
const THEMES = {
  meadow: { sky: ['#5fb4ea', '#c8ecfb'], far: '#93c3d8', mid: '#7cbc6f', near: '#5ea85a',
    dirt: '#8b5a33', dirt2: '#6f4424', dots: '#a46e42', grass: '#62d342', grass2: '#3f9e2a',
    brick: '#b0aba6', brick2: '#86807b', mortar: '#5f5a56', wood: '#c08048', wood2: '#8a5730',
    bg: 'hills', song: 0, enemy: '#d9483b', enemyDark: '#7f231b', deco: 'flower' },
  cave: { sky: ['#110e22', '#2a2148'], far: '#211a3c', mid: '#2b2250', near: '#382c62',
    dirt: '#4b4170', dirt2: '#352e55', dots: '#5f548d', grass: '#6fe3d0', grass2: '#38a594',
    brick: '#6d6694', brick2: '#4f4972', mortar: '#332e55', wood: '#a06e45', wood2: '#6f4a2c',
    bg: 'cave', song: 1, enemy: '#b558d6', enemyDark: '#55206b', deco: 'crystal' },
  sky: { sky: ['#3d7fd8', '#ffd3a8'], far: '#ffffff', mid: '#fff0e2', near: '#f6f1ff',
    dirt: '#c4936b', dirt2: '#9f714c', dots: '#d9aa84', grass: '#9de870', grass2: '#5fb943',
    brick: '#e3d8ca', brick2: '#b7a996', mortar: '#8b7e6d', wood: '#c88d54', wood2: '#94622f',
    bg: 'clouds', song: 2, enemy: '#3fae6a', enemyDark: '#17502c', deco: 'flower' },
  castle: { sky: ['#1a0a0c', '#521c15'], far: '#2a1214', mid: '#371719', near: '#45201f',
    dirt: '#5d4f4f', dirt2: '#463b3b', dots: '#6e5f5f', grass: null, grass2: null,
    brick: '#77696a', brick2: '#584c4d', mortar: '#2f2728', wood: '#8a5a33', wood2: '#5e3b20',
    bg: 'castle', song: 3, enemy: '#4a4a5e', enemyDark: '#1b1b26', deco: null },
};

// ---------------------------------------------------------------- levels
// Levels are written with a small builder; coordinates are in tiles.
// Rows: 0 = top. Tiles: '#' ground, 'B' brick, '=' one-way ledge, '^' spikes, 'L' lava.
const LEVELS = [
  { name: 'Sunny Meadow', theme: 'meadow', w: 124, h: 17, build(b) {
    b.ground(0, 21); b.start(3, 13);
    b.sign(8, 10, 'Arrows / A D to run');
    b.sign(15, 10, 'Space / Z / Up to jump');
    b.coins(9, 12, 3);
    b.coins(22, 11, 2);
    b.ground(24, 47);
    b.rect(30, 12, 31, 13, 'B'); b.coins(30, 11, 2);
    b.sign(37, 7, 'Stomp enemies from above!');
    b.walker(41, 13);
    b.rect(39, 10, 44, 10, '='); b.coins(40, 9, 4);
    b.coins(48, 11, 3);
    b.ground(51, 79);
    b.check(54, 13);
    b.sign(60, 9, 'Springs launch you high');
    b.spring(62, 13);
    b.coins(63, 9); b.coins(64, 7); b.coins(65, 5);
    b.rect(66, 7, 67, 13, 'B'); b.coins(66, 6, 2);
    b.walker(72, 13); b.walker(77, 13, 1);
    b.coins(80, 11, 3);
    b.ground(83, 101);
    b.check(85, 13);
    b.rect(88, 13, 88, 13, 'B'); b.rect(89, 12, 89, 13, 'B'); b.rect(90, 11, 90, 13, 'B'); b.rect(91, 10, 95, 13, 'B');
    b.coins(91, 9, 5);
    b.walker(98, 13);
    b.coins(102, 12, 3);
    b.ground(105, 123);
    b.coins(108, 12, 3);
    b.goal(116, 13);
  } },
  { name: 'Crystal Caverns', theme: 'cave', w: 134, h: 17, build(b) {
    b.rect(0, 0, 133, 1); b.ground(0, 133);
    b.start(3, 13);
    b.sign(11, 9, 'Spikes hurt!'); b.rect(10, 13, 12, 13, '^'); b.coins(10, 10, 3);
    b.rect(16, 11, 19, 11, '='); b.rect(21, 8, 24, 8, '='); b.coins(21, 7, 4);
    b.sign(17, 4, 'Jump up through ledges.  Down + Jump drops');
    b.rect(29, 2, 29, 10, 'B'); b.rect(33, 4, 34, 13, 'B');
    b.sign(31, 13, 'Wall-jump!');
    b.coins(31, 10, 3, 0, -3);
    b.check(38, 13);
    b.rect(42, 13, 61, 13, '^');
    b.rect(44, 11, 46, 11, '='); b.rect(50, 10, 52, 10, '='); b.rect(56, 11, 58, 11, '=');
    b.coins(44, 10, 3); b.coins(50, 9, 3); b.coins(56, 10, 3);
    b.flyer(53, 6, 3, 0.6);
    b.rect(66, 2, 80, 8); b.walker(70, 13); b.walker(76, 13, 1); b.coins(68, 12, 11);
    b.rect(84, 14, 87, 16, ' '); b.rect(85, 12, 86, 12, '='); b.coins(85, 11, 2);
    b.check(92, 13);
    b.spring(97, 13); b.rect(100, 5, 101, 13, 'B'); b.coins(98, 8); b.coins(99, 5);
    b.rect(102, 13, 113, 13, '^'); b.rect(103, 9, 106, 9, '='); b.rect(109, 8, 112, 8, '=');
    b.coins(103, 8, 4); b.coins(109, 7, 4);
    b.coins(116, 12, 3); b.walker(120, 13);
    b.goal(127, 13);
  } },
  { name: 'Sky Bridges', theme: 'sky', w: 150, h: 20, yOff: 3, build(b) {
    b.rect(0, 13, 12, 16); b.start(3, 12);
    b.sign(7, 9, 'Ride the moving platforms');
    b.mover(13, 13, 3, 9, 0, 4);
    b.coins(16, 11, 6);
    b.rect(25, 11, 34, 16); b.walker(31, 10); b.coins(26, 10, 2);
    b.mover(36, 11, 2, 0, -5, 3.5);
    b.rect(40, 6, 47, 7); b.coins(41, 5, 6);
    b.rect(51, 8, 52, 8, 'B'); b.rect(56, 7, 57, 7, 'B'); b.rect(61, 9, 62, 9, 'B');
    b.flyer(54, 5, 0, 2, 1.6, 0); b.flyer(59, 5, 0, 2, 1.6, 1.6);
    b.coins(51, 7, 2); b.coins(56, 6, 2); b.coins(61, 8, 2);
    b.rect(65, 10, 74, 16); b.check(67, 9); b.walker(72, 9);
    b.mover(75, 10, 2, 6, 0, 3); b.mover(85, 10, 2, 6, 0, 3, 0.5);
    b.coins(78, 8, 3); b.coins(88, 8, 3);
    b.rect(95, 9, 104, 16); b.coins(96, 8, 3); b.spring(101, 8);
    b.sign(99, 4, 'Bounce!');
    b.coins(103, 4); b.coins(104, 2);
    b.rect(106, 4, 114, 4, 'B'); b.coins(107, 3, 7);
    b.rect(119, 8, 128, 9); b.check(121, 7); b.flyer(125, 4, 2, 0.5);
    b.rect(131, 10, 132, 10, '=');
    b.flyer(131, 7, 1, 1, 1.3);
    b.rect(134, 12, 149, 16); b.walker(139, 11); b.coins(136, 11, 2); b.goal(144, 11);
  } },
  { name: 'Lava Keep', theme: 'castle', w: 150, h: 17, build(b) {
    b.rect(0, 15, 149, 16, 'L'); b.rect(0, 0, 149, 1, 'B');
    b.rect(0, 13, 10, 16, 'B'); b.start(3, 12);
    b.sign(5, 8, 'Lava is deadly. Good luck!');
    b.rect(14, 12, 15, 16, 'B'); b.rect(19, 11, 20, 16, 'B'); b.rect(24, 12, 25, 16, 'B');
    b.coins(14, 11, 2); b.coins(19, 10, 2); b.coins(24, 11, 2);
    b.flyer(22, 7, 1.5, 0.5);
    b.mover(27, 12, 2, 6, 0, 3);
    b.rect(36, 12, 49, 16, 'B'); b.check(37, 11); b.walker(41, 11);
    b.rect(46, 2, 46, 8, 'B'); b.rect(50, 4, 51, 11, 'B');
    b.sign(41, 5, 'Climb the chimney');
    b.coins(48, 9, 3, 0, -3);
    b.rect(52, 12, 63, 16, 'B'); b.spring(53, 11); b.rect(55, 11, 57, 11, '^'); b.coins(55, 6, 3);
    b.check(61, 11);
    b.mover(65, 11, 3, 8, 0, 3.5); b.flyer(73, 7, 3, 1);
    b.rect(78, 10, 79, 16, 'B');
    b.mover(81, 12, 2, 0, -5, 3);
    b.rect(85, 7, 88, 16, 'B'); b.coins(85, 6, 4);
    b.rect(89, 12, 120, 16, 'B'); b.rect(95, 2, 105, 7, 'B');
    b.walker(97, 11); b.walker(102, 11, 1); b.walker(109, 11);
    b.rect(112, 11, 113, 11, '^');
    b.coins(96, 10, 9);
    b.check(116, 11);
    b.spring(119, 11); b.coins(121, 5, 2);
    b.rect(123, 6, 128, 6, 'B'); b.coins(123, 5, 6);
    b.flyer(131, 8, 1, 2);
    b.rect(133, 12, 149, 16, 'B'); b.walker(138, 11); b.goal(144, 11);
  } },
];

function makeLevel(def) {
  const cols = def.w, rows = def.h, off = def.yOff || 0;
  const grid = [];
  for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill(' '));
  const L = { name: def.name, cols, rows, grid, coins: [], enemies: [], springs: [], checks: [], movers: [], signs: [], start: null, goal: null };
  const Y = y => y + off;
  const b = {
    rect(x1, y1, x2, y2, ch = '#') {
      for (let y = Y(y1); y <= Y(y2); y++) for (let x = x1; x <= x2; x++)
        if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y][x] = ch;
    },
    ground(x1, x2, top = 14, ch = '#') { this.rect(x1, top, x2, rows - 1 - off, ch); },
    coins(x, y, n = 1, dx = 1, dy = 0) {
      for (let i = 0; i < n; i++) L.coins.push({ x: (x + i * dx) * T + 3, y: Y(y + i * dy) * T + 3, w: 10, h: 10, got: false });
    },
    start(x, y) { L.start = { x: x * T + 3, y: Y(y) * T + 2 }; },
    walker(x, y, dir = -1) {
      L.enemies.push({ type: 'walker', x: x * T + 2, y: Y(y) * T + 4, w: 12, h: 12, vx: dir * 32, vy: 0, alive: true, deadT: 0, t: x * 0.37, onGround: false });
    },
    flyer(x, y, ax = 2, ay = 0.5, speed = 1.6, phase = 0) {
      const bx = x * T + 2, by = Y(y) * T + 3;
      L.enemies.push({ type: 'flyer', bx, by, ax: ax * T, ay: ay * T, speed, t: phase, x: bx, y: by, w: 12, h: 10, vx: 0, vy: 0, alive: true, deadT: 0, rot: 0 });
    },
    spring(x, y) { L.springs.push({ x: x * T + 2, y: Y(y) * T + 8, w: 12, h: 8, anim: 0 }); },
    check(x, y) { L.checks.push({ tx: x, ty: Y(y), x: x * T + 1, y: (Y(y) - 2) * T, w: 14, h: 3 * T, active: false, raise: 0 }); },
    goal(x, y) { L.goal = { tx: x, ty: Y(y), x: x * T + 4, y: (Y(y) - 4) * T, w: 8, h: 5 * T }; },
    mover(x, y, w, dx, dy, period, phase = 0) {
      const ox = x * T, oy = Y(y) * T;
      L.movers.push({ ox, oy, x: ox, y: oy, prevX: ox, prevY: oy, w: w * T, h: 8, dx: dx * T, dy: dy * T, period, phase });
    },
    sign(x, y, text) { L.signs.push({ x: x * T + 8, y: Y(y) * T + 8, text }); },
  };
  def.build(b);
  return L;
}

// ---------------------------------------------------------------- tiles & collision
function tileAt(L, tx, ty) {
  if (tx < 0 || tx >= L.cols) return 'B';
  if (ty < 0 || ty >= L.rows) return ' ';
  return L.grid[ty][tx];
}
const isSolid = t => t === '#' || t === 'B';

function boxSolid(L, x, y, w, h) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(L, tx, ty))) return true;
  return false;
}

function moveX(L, e, dx) {
  if (!dx) return 0;
  e.x += dx;
  const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.001) / T);
  if (dx > 0) {
    const tx = Math.floor((e.x + e.w - 0.001) / T);
    for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(L, tx, ty))) { e.x = tx * T - e.w; return 1; }
  } else {
    const tx = Math.floor(e.x / T);
    for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(L, tx, ty))) { e.x = (tx + 1) * T; return -1; }
  }
  return 0;
}

// returns 1 (landed), -1 (bonked), 0
function moveY(L, e, dy, oneWay) {
  if (!dy) return 0;
  const prevBottom = e.y + e.h;
  e.y += dy;
  const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.001) / T);
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h - 0.001) / T);
    let hit = false, solid = false;
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(L, tx, ty);
      if (isSolid(t)) { hit = true; solid = true; }
      else if (oneWay && t === '=' && prevBottom <= ty * T + 0.01) hit = true;
    }
    if (hit) { e.y = ty * T - e.h; e.groundOneWay = !solid; return 1; }
  } else {
    const ty = Math.floor(e.y / T);
    for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(L, tx, ty))) { e.y = (ty + 1) * T; return -1; }
  }
  return 0;
}

// ---------------------------------------------------------------- audio
let actx = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
    sfxGain = actx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
    musicGain = actx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Music.start();
  } catch (e) { actx = null; }
}
function tone(f0, f1, dur, type = 'square', vol = 0.15, delay = 0, dest) {
  if (!actx) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), gn = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(gn); gn.connect(dest || sfxGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 1200, delay = 0, dest) {
  if (!actx) return;
  const t = actx.currentTime + delay;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const gn = actx.createGain();
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(gn); gn.connect(dest || sfxGain);
  s.start(t); s.stop(t + dur + 0.02);
}
let coinPitch = 0, coinPitchT = 0;
const SFX = {
  jump() { tone(260, 560, 0.13, 'square', 0.09); },
  wallJump() { tone(320, 700, 0.12, 'square', 0.09); noise(0.05, 0.08, 3000); },
  land() { noise(0.06, 0.12, 500); },
  coin() {
    const k = Math.pow(2, Math.min(coinPitch, 8) / 12);
    tone(988 * k, null, 0.06, 'square', 0.07); tone(1319 * k, null, 0.16, 'square', 0.07, 0.06);
  },
  stomp() { tone(500, 120, 0.16, 'square', 0.12); noise(0.1, 0.2, 900); },
  spring() { tone(180, 900, 0.28, 'triangle', 0.2); tone(360, 1500, 0.2, 'square', 0.04); },
  death() { tone(600, 70, 0.55, 'sawtooth', 0.12); noise(0.35, 0.25, 600); },
  checkpoint() { [523, 659, 784, 1047].forEach((f, i) => tone(f, null, 0.14, 'square', 0.07, i * 0.07)); },
  respawn() { tone(400, 800, 0.2, 'triangle', 0.12); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, null, i === 6 ? 0.5 : 0.14, 'square', 0.08, i * 0.1)); },
  select() { tone(660, 990, 0.1, 'square', 0.08); },
  pause() { tone(440, 330, 0.1, 'square', 0.07); },
};

const SONGS = [
  { bpm: 136, prog: [[60, 'M'], [67, 'M'], [69, 'm'], [65, 'M']] },
  { bpm: 108, prog: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']] },
  { bpm: 124, prog: [[65, 'M'], [60, 'M'], [62, 'm'], [58, 'M']] },
  { bpm: 150, prog: [[62, 'm'], [58, 'M'], [60, 'M'], [57, 'M']] },
];
const MEL = [4, -1, 2, -1, 0, -1, 2, 4, 5, -1, 4, -1, 2, -1, -1, -1, 4, -1, 2, -1, 0, -1, 1, 2, 2, -1, 0, -1, -1, -1, -1, -1];
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  on: true, song: 0, step: 0, next: 0, timer: null,
  start() {
    if (!actx || this.timer) return;
    this.next = actx.currentTime + 0.05;
    this.timer = setInterval(() => this.tick(), 25);
  },
  setSong(i) { if (this.song !== i) { this.song = i; this.step = 0; } },
  toggle() { this.on = !this.on; if (actx) { this.next = actx.currentTime + 0.05; } },
  tick() {
    if (!actx || !this.on) return;
    const song = SONGS[this.song], spb = 60 / song.bpm / 2;
    if (this.next < actx.currentTime) this.next = actx.currentTime + 0.02;
    while (this.next < actx.currentTime + 0.15) { this.play(this.step, this.next - actx.currentTime, spb); this.step++; this.next += spb; }
  },
  play(step, delay, spb) {
    const song = SONGS[this.song];
    const bar = Math.floor(step / 8) % 4, b = step % 8;
    const [root, q] = song.prog[bar];
    const tri = q === 'M' ? [0, 4, 7] : [0, 3, 7];
    const bassOff = [0, -1, 12, -1, 7, -1, 12, -1][b];
    if (bassOff >= 0) tone(midi(root - 24 + bassOff), null, spb * 1.7, 'triangle', 0.2, delay, musicGain);
    const arp = [0, 1, 2, 1, 2, 1, 0, 1][b];
    tone(midi(root + tri[arp]), null, spb * 0.7, 'square', 0.025, delay, musicGain);
    const mi = MEL[step % 32];
    if (mi >= 0) tone(midi(root + 12 + tri[mi % 3] + 12 * Math.floor(mi / 3)), null, spb * 1.8, 'triangle', 0.07, delay, musicGain);
    if (b % 2 === 1) noise(0.03, 0.03, 7000, delay, musicGain);
    if (b === 0 || b === 4) noise(0.08, 0.06, 150, delay, musicGain);
  },
};

// ---------------------------------------------------------------- world
function newPlayer(s) {
  return { x: s.x, y: s.y, w: P.w, h: P.h, vx: 0, vy: 0, onGround: false, groundOneWay: false, ride: null,
    coyote: 0, jumpBuf: 0, wallCoyote: 0, lastWall: 0, wallDir: 0, lock: 0, dropT: 0, jumping: false,
    facing: 1, sx: 1, sy: 1, dead: false, deadT: 0, runT: 0, prevY: s.y, sliding: false, spawnT: 0 };
}

function buildWorld(index, defOverride) {
  const def = defOverride || LEVELS[index];
  const L = makeLevel(def);
  const w = {
    index, def, L, theme: THEMES[def.theme], t: 0, time: 0, deaths: 0,
    coinsGot: 0, coinsTotal: L.coins.length,
    player: newPlayer(L.start), particles: [], cam: { x: 0, y: 0, look: 0 }, shake: 0,
    respawn: { x: L.start.x, y: L.start.y }, cleared: false, clearT: 0, canvas: null, pendingRelease: false,
  };
  snapCamera(w);
  return w;
}

function burst(w, x, y, n, colors, speed = 80, life = 0.6, grav = 300, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, c: pick(colors), s: size, g: grav });
  }
}
function dust(w, x, y, n, dir = 0) {
  for (let i = 0; i < n; i++) {
    w.particles.push({ x: x + rand(-4, 4), y: y - rand(0, 2), vx: rand(-30, 30) + dir * 40, vy: rand(-35, -5), life: rand(0.25, 0.45), max: 0.45, c: pick(['#ffffff', '#e8e2d6', '#cfc6b8']), s: pick([1, 2, 2]), g: 60 });
  }
}

const NOINPUT = { left: false, right: false, down: false, jump: false, jumpPressed: false, jumpReleased: false };

function stepWorld(w, inp) {
  w.t += DT;
  if (!w.cleared) w.time += DT; else w.clearT += DT;
  const L = w.L;
  // movers
  for (const m of L.movers) {
    m.prevX = m.x; m.prevY = m.y;
    const ph = (w.t / m.period + m.phase) % 1;
    const k = (1 - Math.cos(ph * Math.PI * 2)) / 2;
    m.x = m.ox + m.dx * k; m.y = m.oy + m.dy * k;
  }
  updatePlayer(w, w.cleared ? NOINPUT : inp);
  updateEnemies(w);
  for (const s of L.springs) s.anim = Math.max(0, s.anim - DT * 3);
  for (const c of L.checks) if (c.active) c.raise = Math.min(1, c.raise + DT * 3);
  // particles
  for (let i = w.particles.length - 1; i >= 0; i--) {
    const q = w.particles[i];
    q.vy += q.g * DT; q.x += q.vx * DT; q.y += q.vy * DT; q.life -= DT;
    if (q.life <= 0) w.particles.splice(i, 1);
  }
  w.shake = Math.max(0, w.shake - DT * 20);
  updateCamera(w);
}

function kill(w) {
  const p = w.player;
  if (p.dead || w.cleared) return;
  p.dead = true; p.deadT = 0; w.deaths++;
  w.shake = 6;
  burst(w, p.x + p.w / 2, p.y + p.h / 2, 26, ['#ff8c3a', '#ffe0b5', '#4a1d0e', '#ffffff'], 160, 0.8, 400, 2);
  SFX.death();
}

function respawn(w) {
  const p = newPlayer(w.respawn);
  p.facing = w.player.facing; p.spawnT = 0.5;
  w.player = p;
  burst(w, p.x + p.w / 2, p.y + p.h / 2, 16, ['#ffffff', '#fff3a0', '#9ef'], 90, 0.5, 0, 2);
  SFX.respawn();
}

function touchingWall(L, p, d) {
  const x = d > 0 ? p.x + p.w + 0.5 : p.x - 0.5;
  const tx = Math.floor(x / T);
  const y0 = Math.floor((p.y + 2) / T), y1 = Math.floor((p.y + p.h - 3) / T);
  for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(L, tx, ty))) return true;
  return false;
}

function updatePlayer(w, inp) {
  const p = w.player, L = w.L;
  if (p.dead) { p.deadT += DT; if (p.deadT > 1.0) respawn(w); return; }
  if (p.spawnT > 0) p.spawnT -= DT;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const wasGround = p.onGround;

  // carried by a moving platform
  if (p.ride) {
    const m = p.ride;
    moveX(L, p, m.x - m.prevX);
    p.y = m.y - p.h;
    if (boxSolid(L, p.x, p.y, p.w, p.h)) { p.y = m.prevY - p.h; p.ride = null; }
  }
  p.prevY = p.y;

  // timers
  if (inp.jumpPressed) p.jumpBuf = P.buffer; else p.jumpBuf -= DT;
  p.coyote -= DT; p.wallCoyote -= DT; p.lock -= DT; p.dropT -= DT;

  // horizontal
  if (p.lock <= 0) {
    let a;
    if (dir !== 0) {
      a = wasGround ? P.accGround : P.accAir;
      if (p.vx !== 0 && Math.sign(p.vx) !== dir) a *= P.turnBoost;
    } else a = wasGround ? P.decGround : P.decAir;
    p.vx = approach(p.vx, dir * P.maxRun, a * DT);
    if (dir) p.facing = dir;
  }

  // walls
  p.wallDir = 0;
  if (!wasGround) {
    if (touchingWall(L, p, 1)) p.wallDir = 1;
    else if (touchingWall(L, p, -1)) p.wallDir = -1;
    if (p.wallDir) { p.wallCoyote = P.wallCoyote; p.lastWall = p.wallDir; }
  }

  // jumping
  if (p.jumpBuf > 0) {
    if (wasGround || p.coyote > 0) {
      if (inp.down && wasGround && p.groundOneWay && !p.ride) {
        p.dropT = 0.2; p.y += 2; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      } else {
        p.vy = -P.jumpV; p.jumpBuf = 0; p.coyote = 0; p.jumping = true; p.ride = null; p.onGround = false;
        p.sx = 0.7; p.sy = 1.35;
        dust(w, p.x + p.w / 2, p.y + p.h, 5);
        SFX.jump();
      }
    } else if (p.wallCoyote > 0) {
      const d = -p.lastWall;
      p.vx = d * P.wallJumpVX; p.vy = -P.wallJumpVY; p.lock = P.wallLock; p.facing = d;
      p.jumpBuf = 0; p.wallCoyote = 0; p.jumping = true;
      p.sx = 0.75; p.sy = 1.3;
      dust(w, p.x + (d > 0 ? 0 : p.w), p.y + p.h / 2, 5, d);
      SFX.wallJump();
    }
  }
  if (inp.jumpReleased && p.jumping && p.vy < 0) { p.vy *= P.cut; p.jumping = false; }

  // gravity
  let gr = p.vy < 0 ? P.gUp : P.gDown;
  if (inp.jump && Math.abs(p.vy) < P.apexBand && !wasGround) gr *= P.apexMul;
  p.vy += gr * DT;
  let maxF = P.maxFall;
  p.sliding = false;
  if (p.wallDir && dir === p.wallDir && p.vy > 0) {
    maxF = P.wallSlide; p.sliding = true;
    if (Math.random() < 0.3) dust(w, p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h - 4, 1, 0);
  }
  if (p.vy > maxF) p.vy = Math.max(maxF, p.vy - 2400 * DT);

  // integrate X
  if (moveX(L, p, p.vx * DT)) p.vx = 0;
  // integrate Y (with corner correction on ceilings)
  const impact = p.vy;
  p.onGround = false; p.ride = null;
  const dy = p.vy * DT;
  if (dy < 0) {
    const ny = p.y + dy;
    if (boxSolid(L, p.x, ny, p.w, p.h)) {
      let fixed = false;
      for (let o = 1; o <= 4 && !fixed; o++) {
        for (const s of [o, -o]) {
          if (!boxSolid(L, p.x + s, ny, p.w, p.h) && !boxSolid(L, p.x + s, p.y, p.w, p.h)) { p.x += s; fixed = true; break; }
        }
      }
      if (!fixed) { moveY(L, p, dy, false); p.vy = 0; p.jumping = false; }
      else p.y = ny;
    } else p.y = ny;
  } else if (moveY(L, p, dy, p.dropT <= 0) === 1) {
    p.vy = 0; p.onGround = true;
  }
  // moving platforms (one-way from above)
  if (p.vy >= 0) {
    for (const m of L.movers) {
      const bottom = p.y + p.h, prevBottom = p.prevY + p.h;
      if (p.x + p.w > m.x && p.x < m.x + m.w && prevBottom <= Math.max(m.y, m.prevY) + 2 && bottom >= m.y - 0.01) {
        p.y = m.y - p.h; p.vy = 0; p.onGround = true; p.ride = m; p.groundOneWay = false; break;
      }
    }
  }
  if (p.onGround) {
    p.coyote = P.coyote; p.jumping = false;
    if (!wasGround) {
      const k = clamp(impact / P.maxFall, 0.2, 1);
      p.sx = 1 + 0.35 * k; p.sy = 1 - 0.3 * k;
      if (impact > 150) { dust(w, p.x + p.w / 2, p.y + p.h, Math.round(4 + 4 * k)); SFX.land(); }
    }
    if (Math.abs(p.vx) > 20) {
      p.runT += DT * Math.abs(p.vx) / P.maxRun;
      if (dir && Math.sign(p.vx) !== dir && Math.random() < 0.5) dust(w, p.x + p.w / 2, p.y + p.h, 1, -dir);
    } else p.runT = 0;
  }
  p.sx += (1 - p.sx) * Math.min(1, DT * 12);
  p.sy += (1 - p.sy) * Math.min(1, DT * 12);

  // hazards
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.001) / T);
  const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(L, tx, ty);
    if (t === '^' && overlap(p, { x: tx * T + 2, y: ty * T + 8, w: 12, h: 8 })) kill(w);
    else if (t === 'L' && overlap(p, { x: tx * T, y: ty * T + 5, w: T, h: T - 5 })) kill(w);
  }
  if (p.y > L.rows * T + 24) kill(w);
  if (p.dead) return;

  // coins
  for (const c of L.coins) {
    if (!c.got && overlap(p, c)) {
      c.got = true; w.coinsGot++;
      if (w.t - coinPitchT < 0.6) coinPitch++; else coinPitch = 0;
      coinPitchT = w.t;
      burst(w, c.x + 5, c.y + 5, 8, ['#fff6a8', '#ffd23f', '#ffffff'], 70, 0.4, 0, 1);
      SFX.coin();
    }
  }
  // springs
  for (const s of L.springs) {
    if (p.vy >= 0 && overlap(p, s)) {
      p.vy = -P.springV; p.jumping = false; p.onGround = false; p.ride = null; p.coyote = 0;
      p.y = Math.min(p.y, s.y - p.h + 4);
      s.anim = 1; p.sx = 0.6; p.sy = 1.45;
      burst(w, s.x + 6, s.y, 8, ['#ffffff', '#ffe08a'], 60, 0.35, 100, 1);
      SFX.spring();
    }
  }
  // enemies
  const hb = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 1 };
  for (const e of L.enemies) {
    if (!e.alive || !overlap(hb, e)) continue;
    if (p.vy > 0 && p.prevY + p.h <= e.y + 7) {
      e.alive = false; e.deadT = 0;
      if (e.type === 'flyer') { e.vy = -60; e.vx = p.vx * 0.3; }
      p.vy = inp.jump ? -P.stompVHeld : -P.stompV; p.jumping = true;
      p.sx = 1.3; p.sy = 0.75;
      w.shake = Math.max(w.shake, 2.5);
      burst(w, e.x + e.w / 2, e.y + e.h / 2, 12, ['#ffffff', w.theme.enemy, '#ffe08a'], 110, 0.45, 200, 2);
      SFX.stomp();
    } else { kill(w); return; }
  }
  // checkpoints
  for (const c of L.checks) {
    if (!c.active && overlap(p, c)) {
      c.active = true;
      w.respawn = { x: c.tx * T + 3, y: c.ty * T + 2 };
      burst(w, c.x + 8, c.y + 8, 18, ['#7dff9a', '#ffffff', '#fff3a0'], 100, 0.6, 150, 2);
      SFX.checkpoint();
    }
  }
  // goal
  if (L.goal && !w.cleared && overlap(p, L.goal)) {
    w.cleared = true; w.clearT = 0;
    for (let i = 0; i < 4; i++) burst(w, L.goal.x + 4, L.goal.y + 10 + i * 16, 16, ['#ff5d73', '#ffd23f', '#5ce1e6', '#7dff9a', '#ffffff', '#b38cff'], 180, 1.4, 200, 2);
    SFX.win();
  }
}

function updateEnemies(w) {
  const L = w.L;
  for (let i = L.enemies.length - 1; i >= 0; i--) {
    const e = L.enemies[i];
    if (!e.alive) {
      e.deadT += DT;
      if (e.type === 'flyer') { e.vy += 900 * DT; e.y += e.vy * DT; e.x += e.vx * DT; e.rot += DT * 10; }
      if (e.deadT > 1.5) L.enemies.splice(i, 1);
      continue;
    }
    e.t += DT;
    if (e.type === 'walker') {
      e.vy = Math.min(e.vy + 1800 * DT, 400);
      if (moveX(L, e, e.vx * DT)) e.vx = -e.vx;
      const r = moveY(L, e, e.vy * DT, true);
      if (r === 1) { e.vy = 0; e.onGround = true; } else if (r === -1) e.vy = 0; else e.onGround = false;
      if (e.onGround) {
        const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
        const ftx = Math.floor(fx / T);
        const below = tileAt(L, ftx, Math.floor((e.y + e.h + 1) / T));
        const front = tileAt(L, ftx, Math.floor((e.y + e.h - 1) / T));
        if ((!isSolid(below) && below !== '=') || front === '^') e.vx = -e.vx;
      }
      if (e.y > L.rows * T + 40) L.enemies.splice(i, 1);
    } else {
      const k = e.t * e.speed;
      e.prevX = e.x;
      e.x = e.bx + Math.sin(k) * e.ax;
      e.y = e.by + Math.sin(k * (e.ax ? 2 : 1)) * e.ay;
      e.vx = (e.x - e.prevX) / DT;
    }
  }
}

function snapCamera(w) {
  const p = w.player;
  w.cam.look = 0;
  w.cam.x = clamp(p.x + p.w / 2 - W / 2, 0, w.L.cols * T - W);
  w.cam.y = clamp(p.y + p.h / 2 - H / 2 - 10, 0, w.L.rows * T - H);
}
function updateCamera(w) {
  const p = w.player, c = w.cam;
  if (p.dead) return;
  c.look = approach(c.look, p.facing * 28 + p.vx * 0.12, 90 * DT);
  const tx = p.x + p.w / 2 + c.look - W / 2;
  const ty = p.y + p.h / 2 - H / 2 - 10;
  c.x += (tx - c.x) * Math.min(1, DT * 7);
  c.y += (ty - c.y) * Math.min(1, DT * (p.onGround ? 5 : 3.5));
  c.x = clamp(c.x, 0, w.L.cols * T - W);
  c.y = clamp(c.y, 0, w.L.rows * T - H);
}

// ---------------------------------------------------------------- rendering
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const low = document.createElement('canvas'); low.width = W; low.height = H;
const g = low.getContext('2d');
let S = 2, offX = 0, offY = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(cw * dpr)); canvas.height = Math.max(1, Math.floor(ch * dpr));
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  let s = Math.min(canvas.width / W, canvas.height / H);
  if (Math.floor(s) >= 1 && Math.floor(s) / s > 0.82) s = Math.floor(s);
  S = s;
  offX = Math.floor((canvas.width - W * s) / 2); offY = Math.floor((canvas.height - H * s) / 2);
}
window.addEventListener('resize', resize);
resize();

function renderLevelCanvas(L, th) {
  const c = document.createElement('canvas');
  c.width = L.cols * T; c.height = L.rows * T;
  const x = c.getContext('2d');
  for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) {
    const t = L.grid[ty][tx], px = tx * T, py = ty * T;
    const up = tileAt(L, tx, ty - 1), dn = tileAt(L, tx, ty + 1);
    const lf = tileAt(L, tx - 1, ty), rt = tileAt(L, tx + 1, ty);
    if (t === '#') {
      x.fillStyle = th.dirt; x.fillRect(px, py, T, T);
      for (let k = 0; k < 4; k++) {
        x.fillStyle = k % 2 ? th.dots : th.dirt2;
        x.fillRect(px + Math.floor(hash(tx * 3 + k, ty * 7 + k) * 14), py + Math.floor(hash(tx + k * 11, ty * 5 + k) * 14), 2, 2);
      }
      if (!isSolid(lf) && tx > 0) { x.fillStyle = th.dirt2; x.fillRect(px, py, 2, T); }
      if (!isSolid(rt) && tx < L.cols - 1) { x.fillStyle = th.dirt2; x.fillRect(px + T - 2, py, 2, T); }
      if (!isSolid(dn) && ty < L.rows - 1) { x.fillStyle = th.dirt2; x.fillRect(px, py + T - 3, T, 3); }
      if (!isSolid(up) && ty > 0) {
        if (th.grass) {
          x.fillStyle = th.grass2; x.fillRect(px, py, T, 6);
          x.fillStyle = th.grass; x.fillRect(px, py, T, 4);
          for (let i = 0; i < 4; i++) {
            const r = hash(tx * 13 + i, ty * 3);
            if (r > 0.45) x.fillRect(px + i * 4 + 1, py - 1 - (r > 0.8 ? 1 : 0), 1, 2 + (r > 0.8 ? 1 : 0));
            x.fillStyle = th.grass2; if (r < 0.3) x.fillRect(px + i * 4, py + 6, 2, 1); x.fillStyle = th.grass;
          }
          // decorations on top
          const r = hash(tx * 7, ty * 19);
          if (up === ' ' && r < 0.18 && th.deco === 'flower') {
            const fx = px + 4 + Math.floor(r * 40) % 8;
            x.fillStyle = '#3f9e2a'; x.fillRect(fx, py - 5, 1, 5);
            x.fillStyle = pickBy(['#ff6b8b', '#ffe066', '#ffffff', '#b38cff'], r * 100); x.fillRect(fx - 1, py - 7, 3, 3);
            x.fillStyle = '#fff3a0'; x.fillRect(fx, py - 6, 1, 1);
          } else if (up === ' ' && r < 0.2 && th.deco === 'crystal') {
            const fx = px + 3 + Math.floor(r * 60) % 9;
            x.fillStyle = '#5ce1e6'; x.fillRect(fx, py - 6, 3, 6); x.fillRect(fx + 1, py - 8, 1, 2);
            x.fillStyle = '#c9fbff'; x.fillRect(fx, py - 6, 1, 5);
            x.fillStyle = '#3aa8c7'; x.fillRect(fx + 3, py - 3, 2, 3);
          }
        } else {
          x.fillStyle = th.dots; x.fillRect(px, py, T, 2);
        }
      }
      if (th.deco === 'crystal' && dn === ' ' && ty < L.rows - 1) {
        const r = hash(tx * 5, ty * 23);
        if (r < 0.35) {
          const sx = px + 2 + Math.floor(r * 50) % 10, len = 3 + Math.floor(r * 30) % 6;
          x.fillStyle = th.dirt2;
          for (let i = 0; i < len; i++) x.fillRect(sx + Math.floor(i / 3), py + T + i, Math.max(1, 4 - Math.floor(i / 2)), 1);
        }
      }
    } else if (t === 'B') {
      x.fillStyle = th.mortar; x.fillRect(px, py, T, T);
      for (let row = 0; row < 2; row++) {
        const oy = py + row * 8, shift = ((ty + row) % 2) * 4;
        for (let bx = -1; bx < 3; bx++) {
          const x0 = Math.max(px, px + bx * 8 + shift), x1 = Math.min(px + T, px + bx * 8 + shift + 7);
          if (x1 <= x0) continue;
          x.fillStyle = th.brick; x.fillRect(x0, oy, x1 - x0, 7);
          x.fillStyle = th.brick2; x.fillRect(x0, oy + 5, x1 - x0, 2);
          if (hash(tx * 4 + bx, ty * 2 + row) < 0.2) { x.fillStyle = th.brick2; x.fillRect(x0 + 1, oy + 2, 2, 1); }
        }
      }
      if (!isSolid(up)) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(px, py, T, 1); }
    } else if (t === '=') {
      x.fillStyle = th.wood2; x.fillRect(px, py, T, 6);
      x.fillStyle = th.wood; x.fillRect(px, py, T, 4);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px, py, T, 1);
      x.fillStyle = th.wood2; x.fillRect(px + 7, py + 1, 1, 3);
      if (lf !== '=') { x.fillStyle = th.wood2; x.fillRect(px + 2, py + 6, 2, 4); }
      if (rt !== '=') { x.fillStyle = th.wood2; x.fillRect(px + 12, py + 6, 2, 4); }
    } else if (t === '^') {
      x.fillStyle = '#5b5f6a'; x.fillRect(px, py + 14, T, 2);
      for (let k = 0; k < 2; k++) {
        const bx = px + k * 8;
        for (let i = 0; i < 7; i++) {
          const half = Math.floor(i / 2);
          x.fillStyle = '#e6e9ef'; x.fillRect(bx + 4 - half - 1, py + 7 + i, half + 1, 1);
          x.fillStyle = '#9aa1ad'; x.fillRect(bx + 4, py + 7 + i, half + (i > 0 ? 1 : 0), 1);
        }
        x.fillStyle = '#ffffff'; x.fillRect(bx + 3, py + 7, 1, 1);
      }
    }
  }
  return c;
}
function pickBy(arr, v) { return arr[Math.floor(Math.abs(v)) % arr.length]; }

const gradCache = {};
function skyGrad(th) {
  if (!gradCache[th.bg]) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    gradCache[th.bg] = gr;
  }
  return gradCache[th.bg];
}
function ridge(color, par, base, amp, freq, seed, cx, mode) {
  g.fillStyle = color; g.beginPath();
  const top = mode === 'top';
  g.moveTo(0, top ? -80 : H + 80);
  const off = cx * par;
  for (let x = 0; x <= W + 4; x += 4) {
    const wx = x + off;
    let y;
    if (mode === 'puff') y = base - Math.abs(Math.sin(wx * freq + seed)) * amp - Math.abs(Math.sin(wx * freq * 2.7 + seed * 3)) * amp * 0.45;
    else if (mode === 'jag' || top) {
      const tri = Math.abs(((wx * freq * 0.5 + seed) % 2 + 2) % 2 - 1);
      y = base + (top ? 1 : -1) * (tri * amp + Math.sin(wx * freq * 3.1 + seed) * amp * 0.25);
    } else y = base + Math.sin(wx * freq + seed) * amp + Math.sin(wx * freq * 2.3 + seed * 2) * amp * 0.5;
    g.lineTo(x, Math.round(y));
  }
  g.lineTo(W + 4, top ? -80 : H + 80);
  g.fill();
}
function cloud(x, y, s, color) {
  g.fillStyle = color;
  g.fillRect(x, y + 4 * s, 28 * s, 6 * s);
  g.fillRect(x + 4 * s, y + 1 * s, 10 * s, 6 * s);
  g.fillRect(x + 12 * s, y - 2 * s, 10 * s, 8 * s);
  g.fillRect(x + 2 * s, y + 3 * s, 24 * s, 5 * s);
}
function forEachTiled(cx, par, spacing, fn) {
  const off = cx * par;
  const i0 = Math.floor(off / spacing) - 1, i1 = Math.floor((off + W) / spacing) + 1;
  for (let i = i0; i <= i1; i++) fn(i, Math.round(i * spacing - off));
}

function drawBackground(th, cx, cy, t) {
  g.fillStyle = skyGrad(th); g.fillRect(0, 0, W, H);
  const vy = Math.round(-cy * 0.25);
  if (th.bg === 'hills') {
    g.fillStyle = 'rgba(255,250,210,0.35)'; g.beginPath(); g.arc(390, 52 + vy, 30, 0, 7); g.fill();
    g.fillStyle = '#fff7cf'; g.beginPath(); g.arc(390, 52 + vy, 20, 0, 7); g.fill();
    forEachTiled(cx - t * 8, 0.12, 130, (i, x) => cloud(x + Math.floor(hash(i, 1) * 60), 20 + Math.floor(hash(i, 2) * 60) + vy, 1 + (hash(i, 3) > 0.6 ? 1 : 0), 'rgba(255,255,255,0.85)'));
    g.save(); g.translate(0, vy);
    ridge(th.far, 0.12, 165, 32, 0.012, 1, cx, 'jag');
    ridge(th.mid, 0.3, 195, 16, 0.02, 4, cx);
    ridge(th.near, 0.5, 225, 10, 0.03, 9, cx);
    g.restore();
  } else if (th.bg === 'cave') {
    forEachTiled(cx, 0.15, 23, (i, x) => {
      const r = hash(i, 7);
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.8 + r) + i));
      g.fillStyle = `rgba(120,230,230,${(a * 0.6).toFixed(2)})`;
      g.fillRect(x + Math.floor(r * 20), 30 + Math.floor(hash(i, 8) * 200) + vy, r > 0.7 ? 2 : 1, r > 0.7 ? 2 : 1);
    });
    g.save(); g.translate(0, vy);
    ridge(th.far, 0.15, 60, 40, 0.02, 2, cx, 'top');
    ridge(th.far, 0.15, 190, 45, 0.02, 5, cx, 'jag');
    ridge(th.mid, 0.3, 40, 30, 0.03, 7, cx, 'top');
    ridge(th.mid, 0.3, 215, 30, 0.03, 3, cx, 'jag');
    g.restore();
  } else if (th.bg === 'clouds') {
    g.fillStyle = 'rgba(255,240,200,0.4)'; g.beginPath(); g.arc(120, 70 + vy, 40, 0, 7); g.fill();
    g.fillStyle = '#fff4d6'; g.beginPath(); g.arc(120, 70 + vy, 26, 0, 7); g.fill();
    forEachTiled(cx - t * 10, 0.1, 150, (i, x) => cloud(x + Math.floor(hash(i, 4) * 70), 15 + Math.floor(hash(i, 5) * 50) + vy, 1, 'rgba(255,255,255,0.7)'));
    g.save(); g.translate(0, vy);
    g.globalAlpha = 0.55; ridge(th.far, 0.15, 175, 26, 0.02, 1, cx, 'puff');
    g.globalAlpha = 0.75; ridge(th.mid, 0.3, 215, 22, 0.025, 6, cx, 'puff');
    g.globalAlpha = 1; ridge(th.near, 0.5, 255, 16, 0.035, 2, cx, 'puff');
    g.restore();
  } else if (th.bg === 'castle') {
    g.fillStyle = 'rgba(255,120,60,0.15)'; g.fillRect(0, H - 80, W, 80);
    const towers = (par, spacing, col, hmin, hvar, layer) => forEachTiled(cx, par, spacing, (i, x) => {
      const r1 = hash(i, layer), r2 = hash(i, layer + 9);
      const tw = 22 + Math.floor(r1 * 22), th2 = hmin + Math.floor(r2 * hvar);
      const bx = x + Math.floor(r2 * 20), by = H - th2 + vy;
      g.fillStyle = col; g.fillRect(bx, by, tw, th2 + 40);
      for (let k = 0; k < tw; k += 6) g.fillRect(bx + k, by - 4, 4, 4);
      if (r1 > 0.35) {
        const flick = 0.6 + 0.4 * Math.sin(t * 6 + i * 3);
        g.fillStyle = `rgba(255,170,60,${(0.5 * flick + 0.3).toFixed(2)})`;
        g.fillRect(bx + Math.floor(tw / 2) - 1, by + 12, 3, 5);
      }
    });
    towers(0.12, 90, th.far, 90, 70, 3);
    towers(0.3, 120, th.mid, 50, 60, 11);
    forEachTiled(cx, 0.6, 37, (i, x) => {
      const r = hash(i, 21);
      const yy = H - ((t * (20 + r * 30) + r * 400) % (H + 20));
      g.fillStyle = r > 0.5 ? '#ffb347' : '#ff6a2a';
      g.fillRect(x + Math.floor(Math.sin(t * 2 + i) * 6), Math.round(yy), 1, 1);
    });
  }
}

function drawHero(c, px, py, facing, sx, sy, f, airborne, blink, leafBob) {
  c.save(); c.translate(px, py); c.scale(facing * sx, sy);
  const O = '#4a1d0e', B = '#ff8c3a', HL = '#ffb46b', BE = '#ffe0b5';
  // sprout
  c.fillStyle = '#2f8f2f'; c.fillRect(-1, -17 + leafBob, 1, 4);
  c.fillStyle = '#5bd85b'; c.fillRect(0, -19 + leafBob, 4, 2); c.fillRect(-4, -18 + leafBob, 3, 2);
  // outline + body
  c.fillStyle = O; c.fillRect(-6, -15, 12, 14); c.fillRect(-7, -14, 14, 12);
  c.fillStyle = B; c.fillRect(-5, -14, 10, 12); c.fillRect(-6, -13, 12, 10);
  c.fillStyle = HL; c.fillRect(-5, -13, 3, 2); c.fillRect(-5, -11, 1, 2);
  c.fillStyle = BE; c.fillRect(-3, -7, 6, 4);
  // eyes
  if (blink) { c.fillStyle = O; c.fillRect(0, -10, 2, 1); c.fillRect(3, -10, 2, 1); }
  else {
    c.fillStyle = '#ffffff'; c.fillRect(0, -12, 2, 4); c.fillRect(3, -12, 2, 4);
    c.fillStyle = '#1b1b2e'; c.fillRect(1, -11, 1, 3); c.fillRect(4, -11, 1, 3);
  }
  c.fillStyle = '#ff6b6b'; c.fillRect(-2, -8, 1, 1); c.fillRect(5, -8, 1, 1);
  // feet
  c.fillStyle = O;
  if (airborne) { c.fillRect(-5, -2, 4, 2); c.fillRect(1, -3, 4, 2); }
  else { c.fillRect(-5 + f, -2 - (f > 0 ? 1 : 0), 4, 2); c.fillRect(1 - f, -2 - (f < 0 ? 1 : 0), 4, 2); }
  c.restore();
}

function drawWorld(w, showPlayer = true) {
  const L = w.L, th = w.theme;
  if (!w.canvas) w.canvas = renderLevelCanvas(L, th);
  const shx = w.shake > 0 ? (Math.random() * 2 - 1) * w.shake : 0;
  const shy = w.shake > 0 ? (Math.random() * 2 - 1) * w.shake : 0;
  const cx = Math.round(w.cam.x + shx), cy = Math.round(w.cam.y + shy);
  w.rcx = cx; w.rcy = cy;
  const t = w.t;
  drawBackground(th, cx, cy, t);
  g.drawImage(w.canvas, cx, cy, W, H, 0, 0, W, H);

  const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(L.cols - 1, Math.floor((cx + W) / T));
  const ty0 = Math.max(0, Math.floor(cy / T)), ty1 = Math.min(L.rows - 1, Math.floor((cy + H) / T));
  // lava
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (L.grid[ty][tx] !== 'L') continue;
    const px = tx * T - cx, py = ty * T - cy;
    if (tileAt(L, tx, ty - 1) !== 'L') {
      for (let i = 0; i < T; i += 2) {
        const wx = tx * T + i;
        const s = py + 3 + Math.round(Math.sin(t * 3 + wx * 0.2) * 1.5 + Math.sin(t * 1.7 + wx * 0.07));
        g.fillStyle = '#ff7a1f'; g.fillRect(px + i, s, 2, py + T - s);
        g.fillStyle = '#ffd25a'; g.fillRect(px + i, s, 2, 2);
      }
      if (hash(tx, Math.floor(t * 2)) < 0.04) { g.fillStyle = '#ffe28a'; g.fillRect(px + 6, py + 1 - ((t * 20) % 6), 2, 2); }
    } else {
      g.fillStyle = '#d8401b'; g.fillRect(px, py, T, T);
      g.fillStyle = '#ff6a1f';
      const k = Math.floor(hash(tx, ty) * 10);
      g.fillRect(px + (k + Math.floor(t * 4)) % 14, py + (k * 3) % 12, 3, 2);
    }
  }
  // movers
  for (const m of L.movers) {
    const x = Math.round(m.x - cx), y = Math.round(m.y - cy);
    if (x > W || x + m.w < 0) continue;
    g.fillStyle = '#3b3f4a'; g.fillRect(x, y, m.w, 8);
    g.fillStyle = '#9aa3b5'; g.fillRect(x + 1, y, m.w - 2, 5);
    g.fillStyle = '#d9dfeb'; g.fillRect(x + 1, y, m.w - 2, 1);
    g.fillStyle = '#ffcf3f';
    for (let i = 4; i < m.w - 4; i += 8) g.fillRect(x + i, y + 2, 4, 2);
    g.fillStyle = '#3b3f4a'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + m.w - 3, y + 2, 1, 1);
  }
  // springs
  for (const s of L.springs) {
    const x = Math.round(s.x - cx), by = Math.round(s.y + s.h - cy);
    if (x > W || x < -16) continue;
    const ext = s.anim > 0 ? Math.round(Math.sin(s.anim * Math.PI) * 6) : 0;
    const topY = by - 7 - ext;
    g.fillStyle = '#4a4f5c'; g.fillRect(x, by - 2, 12, 2);
    g.fillStyle = '#c9ced8';
    const coilH = by - 2 - (topY + 3);
    for (let i = 0; i < coilH; i += 2) g.fillRect(x + 3 + ((i / 2) % 2) * 2, topY + 3 + i, 4, 1);
    g.fillStyle = '#e04848'; g.fillRect(x - 1, topY, 14, 3);
    g.fillStyle = '#ff8a8a'; g.fillRect(x - 1, topY, 14, 1);
  }
  // checkpoints
  for (const c of L.checks) {
    const x = Math.round(c.tx * T + 7 - cx), base = Math.round((c.ty + 1) * T - cy);
    if (x > W + 20 || x < -20) continue;
    g.fillStyle = '#4a4f5c'; g.fillRect(x - 3, base - 3, 8, 3);
    g.fillStyle = '#e8e8f0'; g.fillRect(x, base - 32, 2, 29);
    g.fillStyle = '#ffd23f'; g.fillRect(x - 1, base - 34, 4, 3);
    const fy = Math.round(base - 12 - c.raise * 18);
    const wave = c.active ? Math.round(Math.sin(t * 8) * 1) : 0;
    g.fillStyle = c.active ? '#3ddc84' : '#c84b4b';
    for (let i = 0; i < 9; i++) {
      const hgt = 7 - Math.floor(i * 0.6);
      g.fillRect(x + 2 + i, fy + Math.round(Math.sin(t * 8 - i * 0.6) * (c.active ? 1 : 0)) + Math.floor((7 - hgt) / 2) + wave * 0, 1, hgt);
    }
  }
  // goal
  if (L.goal) {
    const gl = L.goal, x = Math.round(gl.tx * T + 7 - cx), base = Math.round((gl.ty + 1) * T - cy);
    if (x > -40 && x < W + 40) {
      g.fillStyle = '#4a4f5c'; g.fillRect(x - 5, base - 4, 13, 4);
      g.fillStyle = '#f2f2f7'; g.fillRect(x, base - 72, 3, 68);
      g.fillStyle = '#c9c9d6'; g.fillRect(x + 2, base - 72, 1, 68);
      g.fillStyle = '#ffd23f'; g.fillRect(x - 1, base - 77, 5, 5); g.fillStyle = '#fff3a0'; g.fillRect(x, base - 76, 2, 2);
      for (let i = 0; i < 20; i++) {
        const yy = base - 70 + Math.round(Math.sin(t * 6 - i * 0.45) * 1.5 * (i / 20));
        for (let j = 0; j < 14; j += 2) {
          g.fillStyle = ((Math.floor(i / 4) + j / 2) % 2) ? '#ffffff' : '#ff4d6d';
          g.fillRect(x + 3 + i, yy + j, 1, 2);
        }
      }
      const pulse = 0.25 + 0.15 * Math.sin(t * 4);
      g.fillStyle = `rgba(255,240,150,${pulse.toFixed(2)})`; g.fillRect(x - 4, base - 78, 11, 2);
    }
  }
  // coins
  for (const c of L.coins) {
    if (c.got) continue;
    const ccx = c.x + 5 - cx, ccy = c.y + 5 - cy + Math.sin(t * 3 + c.x * 0.1) * 1.5;
    if (ccx < -10 || ccx > W + 10) continue;
    const s = Math.abs(Math.cos(t * 3.2 + c.x * 0.03));
    const hw = Math.max(1, Math.round(4 * s));
    const X = Math.round(ccx), Y = Math.round(ccy);
    g.fillStyle = '#b8770b'; g.fillRect(X - hw, Y - 4, hw * 2, 9); g.fillRect(X - hw - (hw > 2 ? 1 : 0), Y - 3, hw * 2 + (hw > 2 ? 2 : 0), 7);
    g.fillStyle = '#ffd23f'; g.fillRect(X - hw + (hw > 1 ? 1 : 0), Y - 3, Math.max(1, hw * 2 - (hw > 1 ? 2 : 0)), 7);
    if (hw > 2) { g.fillStyle = '#fff3a0'; g.fillRect(X - hw + 1, Y - 3, 1, 4); g.fillStyle = '#e0a106'; g.fillRect(X - 1, Y - 2, 2, 5); }
  }
  // enemies
  for (const e of L.enemies) {
    const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
    if (x < -20 || x > W + 20) continue;
    if (e.type === 'walker') drawWalker(e, x, y, th, t);
    else drawFlyer(e, x, y, th, t);
  }
  // player
  const p = w.player;
  if (showPlayer && !p.dead) {
    const vis = p.spawnT <= 0 || Math.floor(p.spawnT * 20) % 2 === 0;
    if (vis) {
      const f = p.onGround && Math.abs(p.vx) > 20 ? Math.round(Math.sin(p.runT * 18)) : 0;
      const blink = (t % 3.3) < 0.12;
      const bob = p.onGround ? (Math.abs(p.vx) > 20 ? Math.round(Math.abs(Math.sin(p.runT * 18))) : Math.round(Math.sin(t * 3) * 0.6)) : (p.vy < 0 ? 1 : -1);
      drawHero(g, Math.round(p.x + p.w / 2 - cx), Math.round(p.y + p.h - cy), p.facing, p.sx, p.sy, f, !p.onGround, blink, bob);
    }
  }
  // particles
  for (const q of w.particles) {
    g.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1);
    g.fillStyle = q.c; g.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.s, q.s);
  }
  g.globalAlpha = 1;
}

function drawWalker(e, x, y, th, t) {
  const C = th.enemy, D = th.enemyDark;
  if (!e.alive) {
    g.globalAlpha = clamp(1.5 - e.deadT, 0, 1);
    g.fillStyle = D; g.fillRect(x, y + 8, 12, 4);
    g.fillStyle = C; g.fillRect(x + 1, y + 8, 10, 3);
    g.fillStyle = '#fff'; g.fillRect(x + 3, y + 9, 2, 1); g.fillRect(x + 7, y + 9, 2, 1);
    g.globalAlpha = 1;
    return;
  }
  const step = Math.floor(e.t * 8) % 2;
  const d = e.vx > 0 ? 1 : -1;
  g.fillStyle = D;
  g.fillRect(x + 1 + step, y + 10, 4, 2); g.fillRect(x + 7 - step, y + 10, 4, 2);
  g.fillRect(x + 2, y, 8, 1); g.fillRect(x, y + 2, 12, 8); g.fillRect(x + 1, y + 1, 10, 10);
  g.fillStyle = C; g.fillRect(x + 1, y + 2, 10, 7); g.fillRect(x + 2, y + 1, 8, 9);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, y + 2, 3, 1);
  const ex = d > 0 ? 1 : 0;
  g.fillStyle = '#fff'; g.fillRect(x + 2 + ex * 2, y + 4, 3, 3); g.fillRect(x + 6 + ex * 2, y + 4, 3, 3);
  g.fillStyle = '#111'; g.fillRect(x + 3 + ex * 3, y + 5, 1, 2); g.fillRect(x + 7 + ex * 3, y + 5, 1, 2);
  g.fillStyle = D; g.fillRect(x + 2 + ex * 2, y + 3, 3, 1); g.fillRect(x + 6 + ex * 2, y + 3, 3, 1);
}

function drawFlyer(e, x, y, th, t) {
  const C = '#6b3fa0', D = '#2e1747';
  if (!e.alive) g.globalAlpha = clamp(1.5 - e.deadT, 0, 1);
  const flap = Math.floor(t * 12 + e.bx) % 2;
  g.fillStyle = D;
  if (flap) { g.fillRect(x - 4, y + 1, 5, 2); g.fillRect(x - 5, y - 1, 3, 2); g.fillRect(x + 11, y + 1, 5, 2); g.fillRect(x + 14, y - 1, 3, 2); }
  else { g.fillRect(x - 4, y + 4, 5, 2); g.fillRect(x - 5, y + 6, 3, 2); g.fillRect(x + 11, y + 4, 5, 2); g.fillRect(x + 14, y + 6, 3, 2); }
  g.fillRect(x + 1, y, 10, 10); g.fillRect(x, y + 1, 12, 8);
  g.fillStyle = C; g.fillRect(x + 1, y + 1, 10, 8);
  g.fillStyle = D; g.fillRect(x + 2, y - 2, 2, 2); g.fillRect(x + 8, y - 2, 2, 2);
  if (e.alive) {
    g.fillStyle = '#ffe14d'; g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + 7, y + 3, 2, 2);
    g.fillStyle = '#fff'; g.fillRect(x + 4, y + 7, 1, 2); g.fillRect(x + 7, y + 7, 1, 2);
  } else {
    g.fillStyle = '#fff'; g.fillRect(x + 3, y + 4, 2, 1); g.fillRect(x + 7, y + 4, 2, 1);
  }
  g.globalAlpha = 1;
}

// --- crisp text & UI on the full-resolution canvas
function text(str, x, y, size, color = '#fff', align = 'left', outline = true) {
  ctx.font = `bold ${Math.max(8, Math.round(size * S))}px "Trebuchet MS", "Segoe UI", Verdana, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const px = offX + x * S, py = offY + y * S;
  if (outline) {
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * S * 0.25);
    ctx.strokeStyle = 'rgba(10,8,20,0.85)'; ctx.strokeText(str, px, py);
  }
  ctx.fillStyle = color; ctx.fillText(str, px, py);
}
function panel(x, y, w, h, alpha = 0.82) {
  const px = offX + x * S, py = offY + y * S, pw = w * S, ph = h * S, r = 6 * S;
  ctx.beginPath();
  ctx.moveTo(px + r, py); ctx.arcTo(px + pw, py, px + pw, py + ph, r); ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r); ctx.arcTo(px, py, px + pw, py, r); ctx.closePath();
  ctx.fillStyle = `rgba(18,14,36,${alpha})`; ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * S); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
}
function dim(a = 0.5) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(offX, offY, W * S, H * S); }
function coinIcon(x, y, r) {
  const px = offX + x * S, py = offY + y * S;
  ctx.fillStyle = '#b8770b'; ctx.beginPath(); ctx.ellipse(px, py, r * S * 0.8, r * S, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(px, py, r * S * 0.6, r * S * 0.8, 0, 0, 7); ctx.fill();
}

// ---------------------------------------------------------------- input
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  Enter: 'start', NumpadEnter: 'start', Escape: 'pause', KeyP: 'pause', KeyR: 'restart', KeyM: 'music', KeyQ: 'quit',
  Digit1: 'd1', Digit2: 'd2', Digit3: 'd3', Digit4: 'd4', Numpad1: 'd1', Numpad2: 'd2', Numpad3: 'd3', Numpad4: 'd4',
};
const heldCodes = new Set();
const edges = new Set();
window.addEventListener('keydown', e => {
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  initAudio();
  if (!e.repeat) edges.add(a);
  heldCodes.add(e.code);
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) { heldCodes.delete(e.code); e.preventDefault(); } });
window.addEventListener('blur', () => {
  heldCodes.clear();
  if (state === 'play' && world && !world.cleared && !replay) { state = 'pause'; }
});
canvas.addEventListener('mousedown', () => { initAudio(); canvas.focus(); });
function actionHeld(a) { for (const c of heldCodes) if (KEYMAP[c] === a) return true; return false; }

const pad = { left: false, right: false, down: false, jump: false, start: false, prevStart: false, prevJump: false };
function pollPad() {
  const gp = navigator.getGamepads ? navigator.getGamepads() : [];
  let p = null;
  for (const x of gp) if (x && x.connected) { p = x; break; }
  if (!p) { pad.left = pad.right = pad.down = pad.jump = false; return; }
  const btn = i => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  pad.left = ax < -0.4 || btn(14); pad.right = ax > 0.4 || btn(15); pad.down = ay > 0.6 || btn(13);
  const j = btn(0) || btn(1), st = btn(9);
  if (j && !pad.prevJump) edges.add('jump');
  if (st && !pad.prevStart) { edges.add('start'); edges.add('pause'); }
  pad.jump = j; pad.prevJump = j; pad.prevStart = st;
}

// scripted input for automated testing: ?replay=r*60,rj*20,_*30  (l r j d, _ = nothing)
let replay = null;
if (params.has('replay')) {
  const seq = [];
  for (const tok of params.get('replay').split(',')) {
    const [k, n] = tok.split('*');
    for (let i = 0; i < (parseInt(n, 10) || 1); i++) seq.push(k);
  }
  replay = { seq, i: 0 };
}

let prevIn = { left: false, right: false, down: false, jump: false };
function readInput() {
  const cur = {
    left: actionHeld('left') || pad.left, right: actionHeld('right') || pad.right,
    down: actionHeld('down') || pad.down, jump: actionHeld('jump') || pad.jump,
  };
  if (replay && state === 'play') {
    const k = replay.seq[replay.i] || '_';
    if (replay.i < replay.seq.length) replay.i++;
    cur.left = k.includes('l'); cur.right = k.includes('r'); cur.down = k.includes('d'); cur.jump = k.includes('j');
  }
  const inp = {
    ...cur,
    jumpPressed: (cur.jump && !prevIn.jump) || edges.has('jump'),
    jumpReleased: !cur.jump && (prevIn.jump || pendingRelease),
    start: edges.has('start'), pause: edges.has('pause'), restart: edges.has('restart'),
    music: edges.has('music'), quit: edges.has('quit'),
    digit: edges.has('d1') ? 1 : edges.has('d2') ? 2 : edges.has('d3') ? 3 : edges.has('d4') ? 4 : 0,
  };
  pendingRelease = edges.has('jump') && !cur.jump;
  prevIn = cur;
  edges.clear();
  return inp;
}
let pendingRelease = false;

// ---------------------------------------------------------------- save data
const SAVE_KEY = 'pips-leap-save-v1';
let save = { unlocked: 1, best: {}, coins: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.unlocked) save = Object.assign(save, s); } catch (e) { /* ignore */ }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------------------------------------------------------------- game states
let state = 'title';
let world = null;
let titleWorld = buildWorld(0);
let titleT = 0;
let run = { time: 0, deaths: 0, coins: 0, total: 0 };
let lastClear = null;

function startLevel(i) {
  world = buildWorld(i);
  state = 'play';
  Music.setSong(world.theme.song);
}
function newRun(i) { run = { time: 0, deaths: 0, coins: 0, total: 0 }; startLevel(i); }

function finishLevel() {
  const w = world, i = w.index;
  run.time += w.time; run.deaths += w.deaths; run.coins += w.coinsGot; run.total += w.coinsTotal;
  const prevBest = save.best[i];
  const isBest = prevBest === undefined || w.time < prevBest;
  if (isBest) save.best[i] = w.time;
  save.coins[i] = Math.max(save.coins[i] || 0, w.coinsGot);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
  writeSave();
  lastClear = { isBest };
}

function update() {
  const inp = readInput();
  if (inp.music) { initAudio(); Music.toggle(); }
  if (state === 'title') {
    titleT += DT;
    stepWorld(titleWorld, NOINPUT);
    const maxX = titleWorld.L.cols * T - W;
    titleWorld.cam.x = (Math.sin(titleT * 0.08 - Math.PI / 2) * 0.5 + 0.5) * maxX;
    titleWorld.cam.y = titleWorld.L.rows * T - H;
    if (inp.start || inp.jumpPressed) { initAudio(); SFX.select(); newRun(0); }
    else if (inp.digit && inp.digit <= save.unlocked) { initAudio(); SFX.select(); newRun(inp.digit - 1); }
  } else if (state === 'play') {
    if (world.cleared) {
      stepWorld(world, NOINPUT);
      if (world.clearT > 1.0 && (inp.start || inp.jumpPressed)) {
        if (!world.finished) { finishLevel(); world.finished = true; }
        if (world.index + 1 < LEVELS.length) startLevel(world.index + 1);
        else { state = 'win'; titleT = 0; }
        SFX.select();
      } else if (world.clearT > 1.0 && !world.finished) { finishLevel(); world.finished = true; }
      return;
    }
    if (inp.pause) { state = 'pause'; SFX.pause(); return; }
    if (inp.restart) { const d = world.deaths; startLevel(world.index); world.deaths = d; return; }
    stepWorld(world, inp);
  } else if (state === 'pause') {
    if (inp.pause || inp.start) { state = 'play'; SFX.pause(); }
    else if (inp.restart) { const d = world.deaths; startLevel(world.index); world.deaths = d; }
    else if (inp.quit) { state = 'title'; titleT = 0; }
  } else if (state === 'win') {
    titleT += DT;
    stepWorld(world, NOINPUT);
    if (titleT > 1 && (inp.start || inp.jumpPressed)) { state = 'title'; titleT = 0; }
  }
}

function blit() {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, W, H, offX, offY, W * S, H * S);
}

function drawSigns(w) {
  for (const s of w.L.signs) {
    const x = s.x - w.rcx, y = s.y - w.rcy;
    if (x < -150 || x > W + 150) continue;
    ctx.font = `bold ${Math.max(8, Math.round(7 * S))}px "Trebuchet MS", "Segoe UI", Verdana, sans-serif`;
    const tw = ctx.measureText(s.text).width / S;
    ctx.fillStyle = 'rgba(15,10,30,0.55)';
    ctx.fillRect(offX + (x - tw / 2 - 4) * S, offY + (y - 6) * S, (tw + 8) * S, 12 * S);
    text(s.text, x, y, 7, '#fff8dc', 'center', false);
  }
}

function drawHUD(w) {
  panel(4, 4, 70, 18, 0.55);
  coinIcon(14, 13, 5);
  text(`${w.coinsGot} / ${w.coinsTotal}`, 23, 13.5, 9, '#ffe680');
  panel(W - 104, 4, 100, 18, 0.55);
  text(fmtTime(w.time), W - 60, 13.5, 9, '#ffffff', 'right');
  text(`☠ ${w.deaths}`, W - 10, 13.5, 9, '#ff9a9a', 'right');
  text(`${w.index + 1}-${LEVELS.length}  ${w.def.name}`, W / 2, 13, 8, 'rgba(255,255,255,0.85)', 'center');
  if (!Music.on) text('music off (M)', W / 2, H - 8, 6, 'rgba(255,255,255,0.6)', 'center');
  // level intro banner
  if (w.t < 2.4 && !w.cleared) {
    const a = clamp(Math.min(w.t * 3, (2.4 - w.t) * 2), 0, 1);
    ctx.globalAlpha = a;
    text(`World ${w.index + 1}`, W / 2, 92, 10, '#ffe680', 'center');
    text(w.def.name, W / 2, 110, 20, '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state === 'title') {
    drawWorld(titleWorld, false);
    const bob = Math.round(Math.sin(titleT * 3) * 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(W / 2 - 18, 134, 36, 4);
    drawHero(g, W / 2, 134 + Math.min(0, bob), 1, 3 * (bob > 2 ? 1.05 : 1), 3 * (bob > 2 ? 0.95 : 1), 0, bob < 0, (titleT % 3) < 0.1, 0);
    blit();
    dim(0.25);
    const ty = 48 + Math.sin(titleT * 2) * 2;
    text("PIP'S LEAP", W / 2, ty, 38, '#ffd23f', 'center');
    text('a tiny platforming adventure', W / 2, ty + 26, 9, '#ffffff', 'center');
    panel(W / 2 - 150, 152, 300, 92, 0.75);
    text('Move: Arrows / A D      Jump: Space / Z / Up', W / 2, 166, 8, '#ffffff', 'center');
    text('Wall-jump: jump while touching a wall', W / 2, 180, 8, '#ffffff', 'center');
    text('Drop through ledges: Down + Jump', W / 2, 194, 8, '#ffffff', 'center');
    text('P / Esc pause    R restart    M music', W / 2, 208, 8, '#c9c3ff', 'center');
    if (Math.floor(titleT * 2.2) % 2 === 0 || titleT < 0.5) text('Press ENTER or SPACE to start', W / 2, 228, 10, '#7dff9a', 'center');
    if (save.unlocked > 1) {
      let s = 'Level select: ';
      for (let i = 0; i < LEVELS.length; i++) s += (i < save.unlocked ? `[${i + 1}] ` : '[-] ');
      text(s, W / 2, 256, 7, '#ffe680', 'center');
    }
  } else {
    drawWorld(world, true);
    blit();
    drawSigns(world);
    drawHUD(world);
    if (state === 'pause') {
      dim(0.55);
      panel(W / 2 - 110, 70, 220, 120, 0.85);
      text('PAUSED', W / 2, 92, 20, '#ffffff', 'center');
      text('P / Esc / Enter  -  resume', W / 2, 122, 8, '#ffffff', 'center');
      text('R  -  restart level', W / 2, 138, 8, '#ffffff', 'center');
      text('M  -  toggle music', W / 2, 154, 8, '#ffffff', 'center');
      text('Q  -  quit to title', W / 2, 170, 8, '#ffffff', 'center');
    } else if (state === 'play' && world.cleared && world.clearT > 0.8) {
      const a = clamp((world.clearT - 0.8) * 4, 0, 1);
      ctx.globalAlpha = a;
      dim(0.4);
      panel(W / 2 - 110, 60, 220, 140, 0.88);
      text('LEVEL CLEAR!', W / 2, 82, 18, '#ffd23f', 'center');
      text(`Time   ${fmtTime(world.time)}`, W / 2, 108, 10, '#ffffff', 'center');
      const best = save.best[world.index];
      if (lastClear && world.finished && lastClear.isBest) text('New best time!', W / 2, 123, 8, '#7dff9a', 'center');
      else if (best !== undefined) text(`Best   ${fmtTime(best)}`, W / 2, 123, 8, '#c9c3ff', 'center');
      text(`Coins  ${world.coinsGot} / ${world.coinsTotal}${world.coinsGot === world.coinsTotal ? '  - all!' : ''}`, W / 2, 140, 10, '#ffe680', 'center');
      text(`Deaths  ${world.deaths}`, W / 2, 156, 10, '#ff9a9a', 'center');
      if (world.clearT > 1.0 && Math.floor(world.clearT * 2.2) % 2 === 0)
        text(world.index + 1 < LEVELS.length ? 'Press ENTER for the next level' : 'Press ENTER to finish', W / 2, 182, 9, '#7dff9a', 'center');
      ctx.globalAlpha = 1;
    } else if (state === 'win') {
      dim(0.5);
      panel(W / 2 - 130, 40, 260, 180, 0.9);
      text('YOU DID IT!', W / 2, 66, 22, '#ffd23f', 'center');
      text('Pip conquered all four worlds.', W / 2, 90, 9, '#ffffff', 'center');
      text(`Total time   ${fmtTime(run.time)}`, W / 2, 116, 10, '#ffffff', 'center');
      text(`Coins   ${run.coins} / ${run.total}`, W / 2, 134, 10, '#ffe680', 'center');
      text(`Deaths   ${run.deaths}`, W / 2, 152, 10, '#ff9a9a', 'center');
      const rank = run.coins === run.total && run.deaths === 0 ? 'S' : run.coins >= run.total * 0.8 && run.deaths <= 5 ? 'A' : run.coins >= run.total * 0.5 ? 'B' : 'C';
      text(`Rank  ${rank}`, W / 2, 174, 14, '#7dff9a', 'center');
      if (titleT > 1 && Math.floor(titleT * 2.2) % 2 === 0) text('Press ENTER to return to the title', W / 2, 202, 8, '#ffffff', 'center');
    }
  }
  if (DEBUG) {
    const w = state === 'title' ? titleWorld : world, p = w.player;
    document.getElementById('dbg').textContent =
      `state=${state} lvl=${w.index} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(0)} vy=${p.vy.toFixed(0)} ground=${p.onGround} dead=${p.dead} deaths=${w.deaths} coins=${w.coinsGot}/${w.coinsTotal} cleared=${w.cleared} t=${w.t.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------- self tests (?test)
function runTests() {
  const out = [];
  const ok = (name, cond, info = '') => out.push({ name, pass: !!cond, info });
  const mk = (build, h = 17) => buildWorld(-1, { name: 'test', theme: 'meadow', w: 60, h, build });
  const sim = (w, frames, keys = '', each) => {
    for (let i = 0; i < frames; i++) {
      const inp = { left: keys.includes('l'), right: keys.includes('r'), down: keys.includes('d'), jump: keys.includes('j') };
      inp.jumpPressed = inp.jump && !w._pj; inp.jumpReleased = !inp.jump && !!w._pj; w._pj = inp.jump;
      stepWorld(w, inp);
      if (each) each(w);
    }
  };
  let w, minY, y0;
  // landing
  w = mk(b => { b.ground(0, 59); b.start(5, 9); });
  sim(w, 60);
  ok('falls and lands on ground', w.player.onGround && Math.abs(w.player.y + w.player.h - 224) < 0.01, `y=${w.player.y}`);
  // full jump
  y0 = w.player.y; minY = y0;
  sim(w, 70, 'j', w2 => { minY = Math.min(minY, w2.player.y); });
  ok('full jump height ~3.5-4 tiles', y0 - minY >= 54 && y0 - minY <= 66, `h=${(y0 - minY).toFixed(1)}`);
  sim(w, 60);
  // short hop
  y0 = w.player.y; minY = y0;
  sim(w, 3, 'j'); sim(w, 60, '', w2 => { minY = Math.min(minY, w2.player.y); });
  ok('tap jump is a short hop', y0 - minY < 30 && y0 - minY > 8, `h=${(y0 - minY).toFixed(1)}`);
  // run speed
  sim(w, 40, 'r');
  ok('reaches max run speed', Math.abs(w.player.vx - P.maxRun) < 0.01, `vx=${w.player.vx}`);
  sim(w, 20, '');
  ok('stops when released', w.player.vx === 0, `vx=${w.player.vx}`);
  // wall
  w = mk(b => { b.ground(0, 59); b.rect(20, 10, 20, 13, 'B'); b.start(5, 13); });
  sim(w, 150, 'r');
  ok('blocked by wall', Math.abs(w.player.x + w.player.w - 320) < 0.01, `x=${w.player.x}`);
  // coyote time
  w = mk(b => { b.ground(0, 10); b.ground(30, 59); b.start(8, 13); });
  let leftAt = -1, f = 0;
  sim(w, 60, 'r', w2 => { f++; if (leftAt < 0 && !w2.player.onGround) leftAt = f; });
  w = mk(b => { b.ground(0, 10); b.ground(30, 59); b.start(8, 13); });
  sim(w, leftAt + 3, 'r'); sim(w, 1, 'rj');
  ok('coyote jump after leaving ledge', w.player.vy < -300, `vy=${w.player.vy.toFixed(0)} left@${leftAt}`);
  // jump buffer
  w = mk(b => { b.ground(0, 59); b.start(5, 6); });
  let landF = -1; f = 0;
  sim(w, 80, '', w2 => { f++; if (landF < 0 && w2.player.onGround) landF = f; });
  w = mk(b => { b.ground(0, 59); b.start(5, 6); });
  sim(w, landF - 5); sim(w, 6, 'j');
  ok('buffered jump fires on landing', w.player.vy < 0 && !w.player.onGround, `vy=${w.player.vy.toFixed(0)}`);
  // stomp
  w = mk(b => { b.ground(0, 59); b.start(12, 7); b.walker(12, 13, 1); });
  w.L.enemies[0].vx = 0;
  let bounced = false;
  sim(w, 60, '', w2 => { if (w2.player.vy < -200) bounced = true; });
  ok('stomping kills enemy and bounces', !w.L.enemies[0] || !w.L.enemies[0].alive, '');
  ok('stomp bounce happened, player alive', bounced && !w.player.dead && w.deaths === 0, `deaths=${w.deaths}`);
  // side hit
  w = mk(b => { b.ground(0, 59); b.start(5, 13); b.walker(12, 13, -1); });
  sim(w, 90, 'r');
  ok('touching enemy from the side kills', w.deaths === 1, `deaths=${w.deaths}`);
  // one-way platform
  w = mk(b => { b.ground(0, 59); b.rect(4, 11, 8, 11, '='); b.start(6, 13); });
  sim(w, 20); sim(w, 50, 'j'); sim(w, 30);
  ok('jump up through one-way and stand on it', w.player.onGround && Math.abs(w.player.y + w.player.h - 176) < 0.01, `bottom=${w.player.y + w.player.h}`);
  sim(w, 2, 'dj'); sim(w, 40, '');
  ok('down+jump drops through one-way', w.player.onGround && Math.abs(w.player.y + w.player.h - 224) < 0.01, `bottom=${w.player.y + w.player.h}`);
  // spring
  w = mk(b => { b.ground(0, 59); b.start(6, 9); b.spring(6, 13); });
  minY = 999;
  sim(w, 90, '', w2 => { minY = Math.min(minY, w2.player.y); });
  ok('spring launches high (>8 tiles)', 210 - minY > 8 * 16, `rise=${(210 - minY).toFixed(0)}`);
  // spikes
  w = mk(b => { b.ground(0, 59); b.start(4, 13); b.rect(9, 13, 9, 13, '^'); });
  sim(w, 80, 'r');
  ok('spikes kill', w.deaths >= 1, `deaths=${w.deaths}`);
  sim(w, 70, '');
  ok('respawns after death', !w.player.dead, '');
  // moving platform
  w = mk(b => { b.start(5, 8); b.mover(4, 12, 3, 6, 0, 3); });
  const x0 = w.player.x;
  sim(w, 45);
  ok('mover carries player', w.player.onGround && w.player.ride && w.player.x - x0 > 30, `dx=${(w.player.x - x0).toFixed(1)}`);
  // vertical mover
  w = mk(b => { b.start(5, 8); b.mover(4, 12, 3, 0, -5, 3); });
  sim(w, 100);
  ok('vertical mover carries player up', w.player.onGround && w.player.y + w.player.h < 12 * 16 - 40 && !w.player.dead, `bottom=${(w.player.y + w.player.h).toFixed(1)}`);
  // wall jump
  w = mk(b => { b.ground(0, 59); b.rect(10, 2, 10, 13, 'B'); b.start(8, 13); });
  sim(w, 10, 'r'); sim(w, 12, 'rj'); sim(w, 3, 'r');
  const preY = w.player.y;
  sim(w, 1, 'rj');
  ok('wall jump pushes away and up', w.player.vx < 0 && w.player.vy < -300, `vx=${w.player.vx.toFixed(0)} vy=${w.player.vy.toFixed(0)} y=${preY.toFixed(0)}`);
  // checkpoint + goal
  w = mk(b => { b.ground(0, 59); b.start(3, 13); b.check(8, 13); b.goal(14, 13); });
  sim(w, 120, 'r');
  ok('checkpoint activates', w.L.checks[0].active && w.respawn.x === 8 * T + 3, '');
  ok('touching goal clears level', w.cleared, '');
  // real levels sanity
  LEVELS.forEach((def, i) => {
    const lw = buildWorld(i);
    const L = lw.L;
    const startFree = !boxSolid(L, L.start.x, L.start.y, P.w, P.h);
    sim(lw, 60);
    ok(`level ${i + 1} start valid & stable`, startFree && lw.player.onGround && !lw.player.dead && lw.deaths === 0, `coins=${lw.coinsTotal}`);
    ok(`level ${i + 1} has goal and checkpoints`, !!L.goal && L.checks.length >= 1, `checks=${L.checks.length}`);
    for (const c of L.checks) {
      const below = tileAt(L, c.tx, c.ty + 1);
      if (!isSolid(below)) ok(`level ${i + 1} checkpoint at ${c.tx} has ground`, false, below);
    }
    for (const s of L.springs) if (!isSolid(tileAt(L, Math.floor((s.x + 6) / T), Math.floor(s.y / T) + 1))) ok(`level ${i + 1} spring grounded`, false, `${s.x / T}`);
    const gl = L.goal;
    if (gl && !isSolid(tileAt(L, gl.tx, gl.ty + 1))) ok(`level ${i + 1} goal has ground`, false, '');
    for (const c of L.coins) if (boxSolid(L, c.x, c.y, c.w, c.h)) ok(`level ${i + 1} coin inside solid at ${Math.floor(c.x / T)},${Math.floor(c.y / T)}`, false, '');
  });
  return out;
}

// ---------------------------------------------------------------- dev tool: level solver (?solve=N)
// Beam search over the real physics to prove a level can be finished; outputs a replay string.
function cloneWorld(w) {
  const n = Object.assign({}, w);
  n.L = Object.assign({}, w.L);
  n.L.movers = w.L.movers.map(m => ({ ...m }));
  n.L.enemies = w.L.enemies.map(e => ({ ...e }));
  n.L.springs = w.L.springs.map(s => ({ ...s }));
  n.L.checks = w.L.checks.map(c => ({ ...c }));
  n.player = { ...w.player };
  if (w.player.ride) n.player.ride = n.L.movers[w.L.movers.indexOf(w.player.ride)];
  n.particles = []; n.cam = { ...w.cam }; n.respawn = { ...w.respawn };
  return n;
}
function solveLevel(i, beam = 900, maxDepth = 700) {
  const MF = 8;
  const ACTS = [['', 0], ['r', 0], ['l', 0], ['r', 1], ['l', 1], ['', 1], ['r', 2], ['l', 2], ['', 2]]; // 0 none, 1 press, 2 hold
  const root = buildWorld(i);
  const movers = root.L.movers.length > 0;
  const seen = new Set();
  let layer = [{ w: root, held: false, path: null }];
  const goalX = root.L.goal.x;
  for (let depth = 0; depth < maxDepth && layer.length; depth++) {
    const next = [];
    for (const node of layer) {
      for (const [dir, jm] of ACTS) {
        if (jm === 2 && !node.held) continue;
        const w = cloneWorld(node.w);
        let pj = node.held, frames = [];
        for (let f = 0; f < MF; f++) {
          const jump = jm === 2 || (jm === 1 && f > 0);
          const inp = { left: dir === 'l', right: dir === 'r', down: false, jump, jumpPressed: jump && !pj, jumpReleased: !jump && pj };
          pj = jump;
          frames.push(dir + (jump ? 'j' : ''));
          stepWorld(w, inp);
          if (w.deaths > 0 || w.cleared) break;
        }
        if (w.deaths > 0) continue;
        const path = { frames, prev: node.path };
        if (w.cleared) return { ok: true, depth, path, t: w.t };
        const p = w.player;
        const k = [Math.floor(p.x / 6), Math.floor(p.y / 6), Math.sign(Math.round(p.vx / 50)), Math.floor(p.vy / 120), pj ? 1 : 0, p.onGround ? 1 : 0, movers ? Math.floor(w.t * 3) % 36 : 0].join(',');
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ w, held: pj, path, score: p.x - Math.abs(p.x - goalX) * 0 - p.y * 0.15 });
      }
    }
    next.sort((a, b) => b.score - a.score);
    // keep the best, but also a spread of others for diversity
    if (next.length > beam) {
      const keep = next.slice(0, beam * 0.7);
      const rest = next.slice(beam * 0.7);
      for (let j = 0; j < beam * 0.3; j++) keep.push(rest[Math.floor(j * rest.length / (beam * 0.3))]);
      layer = keep;
    } else layer = next;
  }
  let best = layer[0];
  return { ok: false, x: best ? best.w.player.x / T : -1, y: best ? best.w.player.y / T : -1 };
}
function pathToReplay(path) {
  const frames = [];
  for (let n = path; n; n = n.prev) frames.unshift(n.frames);
  const flat = [].concat(...frames);
  const out = [];
  for (let i = 0; i < flat.length;) {
    let j = i; while (j < flat.length && flat[j] === flat[i]) j++;
    out.push((flat[i] || '_') + '*' + (j - i)); i = j;
  }
  return out.join(',');
}

// ---------------------------------------------------------------- boot
if (params.has('solve')) {
  const i = clamp((parseInt(params.get('solve'), 10) || 1) - 1, 0, LEVELS.length - 1);
  const t0 = performance.now();
  const r = solveLevel(i, parseInt(params.get('beam'), 10) || 900);
  const el = document.getElementById('dbg');
  el.style.cssText = 'position:fixed;left:8px;top:8px;color:#fff;font:12px monospace;white-space:pre-wrap;word-break:break-all;width:95%';
  el.textContent = r.ok ? `SOLVED level ${i + 1} gameTime=${r.t.toFixed(1)}s ms=${(performance.now() - t0).toFixed(0)}
REPLAY=${pathToReplay(r.path)}` : `FAILED level ${i + 1} best x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} ms=${(performance.now() - t0).toFixed(0)}`;
  return;
}

if (params.has('test')) {
  let results;
  try { results = runTests(); } catch (e) { results = [{ name: 'test crash: ' + e.message, pass: false, info: e.stack }]; }
  const fails = results.filter(r => !r.pass);
  const lines = results.map(r => `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.info}`);
  lines.unshift(`${results.length - fails.length}/${results.length} passed`);
  document.getElementById('dbg').textContent = lines.join('\n');
  document.getElementById('dbg').style.cssText = 'position:fixed;left:8px;top:8px;color:#fff;font:14px monospace;white-space:pre;background:#000c;padding:8px';
  for (const f of fails) console.error('TEST FAIL', f.name, f.info);
  console.log(lines.join('\n'));
  return;
}

if (params.has('map')) {
  // render a whole level for visual inspection
  const i = clamp(parseInt(params.get('map'), 10) - 1 || 0, 0, LEVELS.length - 1);
  const w = buildWorld(i);
  const c = renderLevelCanvas(w.L, w.theme);
  const x = c.getContext('2d');
  for (const k of w.L.coins) { x.fillStyle = '#ffd23f'; x.fillRect(k.x + 1, k.y + 1, 8, 8); }
  for (const e of w.L.enemies) { x.fillStyle = e.type === 'walker' ? '#f00' : '#a0f'; x.fillRect(e.x, e.y, e.w, e.h); }
  for (const m of w.L.movers) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(m.ox, m.oy, m.w, 8); x.fillStyle = 'rgba(0,0,255,0.3)'; x.fillRect(m.ox, m.oy, m.w + m.dx, 8 + Math.abs(m.dy)); }
  for (const s of w.L.springs) { x.fillStyle = '#f44'; x.fillRect(s.x, s.y, s.w, s.h); }
  for (const k of w.L.checks) { x.fillStyle = '#0f0'; x.fillRect(k.x, k.y, k.w, k.h); }
  for (let ty = 0; ty < w.L.rows; ty++) for (let tx = 0; tx < w.L.cols; tx++) if (w.L.grid[ty][tx] === 'L') { x.fillStyle = '#f60'; x.fillRect(tx * T, ty * T, T, T); }
  if (w.L.goal) { x.fillStyle = '#ff0'; x.fillRect(w.L.goal.x, w.L.goal.y, w.L.goal.w, w.L.goal.h); }
  x.fillStyle = '#fff'; x.fillRect(w.L.start.x, w.L.start.y, P.w, P.h);
  x.fillStyle = 'rgba(255,255,255,0.15)';
  for (let tx = 0; tx < w.L.cols; tx += 10) x.fillRect(tx * T, 0, 1, c.height);
  const drawMap = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#5fb4ea'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const half = Math.ceil(c.width / 2);
  const sc = Math.min(canvas.width / half, canvas.height / (c.height * 2 + 10));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, half, c.height, 0, 0, half * sc, c.height * sc);
  ctx.drawImage(c, half, 0, c.width - half, c.height, 0, (c.height + 10) * sc, (c.width - half) * sc, c.height * sc);
  requestAnimationFrame(drawMap);
  };
  drawMap();
  return;
}

if (params.has('level')) {
  const i = clamp((parseInt(params.get('level'), 10) || 1) - 1, 0, LEVELS.length - 1);
  newRun(i);
  if (params.has('sx')) {
    const L = world.L;
    L.start = { x: parseFloat(params.get('sx')) * T + 3, y: (parseFloat(params.get('sy')) || 0) * T + 2 };
    world.player = newPlayer(L.start); world.respawn = { ...L.start }; snapCamera(world);
  }
}

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now; acc += dt;
  pollPad();
  let n = 0;
  while (acc >= DT && n < 6) { update(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  render();
  requestAnimationFrame(frame);
}
canvas.focus();
if (replay) {
  // deterministic driver for automated runs (headless Chrome throttles rAF): 2 fixed steps per tick
  let extra = 90;
  const tick = () => {
    update(); update();
    if (replay.i >= replay.seq.length) extra -= 2;
    if (extra > 0) setTimeout(tick, 16);
    else { const show = () => { render(); requestAnimationFrame(show); }; requestAnimationFrame(show); }
  };
  tick();
} else requestAnimationFrame(frame);
window.__pip = { get world() { return world; }, get state() { return state; }, LEVELS, P };
})();
