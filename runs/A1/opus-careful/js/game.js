// GLOAMREACH - input, world/collisions, camera, game states, HUD, main loop.
(function () {
  var T = CFG.TILE, W = CFG.W, H = CFG.H, DT = CFG.DT;
  var canvas, ctx;

  // ====================================================================== input
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyX: 'attack', KeyJ: 'attack',
    KeyC: 'dash', KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyV: 'bolt', KeyL: 'bolt', KeyF: 'heal',
    Escape: 'pause', KeyP: 'pause', KeyR: 'restart', Enter: 'enter', NumpadEnter: 'enter',
    KeyM: 'mute', F1: 'debugGod', F2: 'debugWarp'
  };
  var Input = {
    held: {}, edge: {},
    down: function (a) { return !!this.held[a]; },
    pressed: function (a) { return !!this.edge[a]; },
    endStep: function () { this.edge = {}; },
    press: function (a) { if (!this.held[a]) this.edge[a] = true; this.held[a] = true; },
    release: function (a) { this.held[a] = false; }
  };
  window.addEventListener('keydown', function (ev) {
    var a = KEYMAP[ev.code];
    if (!a && ev.key === 'Enter') a = 'enter';
    Snd.init();
    if (a) { ev.preventDefault(); Input.press(a); }
  });
  window.addEventListener('keyup', function (ev) {
    var a = KEYMAP[ev.code];
    if (!a && ev.key === 'Enter') a = 'enter';
    if (a) { ev.preventDefault(); Input.release(a); }
  });
  window.addEventListener('blur', function () { Input.held = {}; if (G.state === 'play') G.state = 'paused'; });

  // ====================================================================== state
  var G = window.G = {
    state: 'title', t: 0, titleT: 0, map: LEVEL.map, mapW: LEVEL.map[0].length * T, mapH: LEVEL.map.length * T,
    cam: { x: 0, y: 0 }, shakeAmt: 0, shakeX: 0, shakeY: 0, hitStop: 0, timeScale: 1,
    enemies: [], projectiles: [], bolts: [], particles: [], ambient: [],
    decor: [], signs: [], rest: null, heart: null, arena: null, bossDef: null, boss: null,
    broken: false, breakHp: 3, arenaClosed: false, arenaGate: 0, bossGateClosed: false, bossGate: 0,
    bossState: 'waiting', bossSpikes: false, bossSpikeAnim: 0, rain: 0, rainTarget: 0, brazier: 1, brazierTarget: 1,
    darkBoost: 0, lightning: 0, phaseRed: 0,
    maxHp: CFG.player.maxHp, heartTaken: false, rested: false, respawn: null,
    deaths: 0, playTime: 0, deathT: -1, fadeIn: 0, spikeResetT: 0,
    toast: { text: '', t: 0 }, areaCardT: -1, bossCardT: 0, bossBarA: 0, hurtPulse: 0,
    hud: { lostT: 0, gainT: 0, godMode: false }, godMode: false, victoryDelay: -1, victoryT: 0, flash: 0
  };

  // ====================================================================== world
  var World = window.World = {
    tile: function (tx, ty) {
      if (ty < 0 || ty >= G.map.length || tx < 0) return '#';
      var row = G.map[ty]; if (tx >= row.length) return '#';
      return row.charAt(tx);
    },
    solidAt: function (tx, ty) {
      var c = this.tile(tx, ty);
      if (c === '#') return true;
      if (c === 'B') return !G.broken;
      if (c === 'a') return G.arenaClosed;
      if (c === 'G') return G.bossGateClosed;
      return false;
    },
    oneWayAt: function (tx, ty) { return this.tile(tx, ty) === '-'; },
    spikeAt: function (tx, ty) {
      if (this.tile(tx, ty) === '^') return true;
      if (G.bossSpikes && G.bossSpikeAnim > 0.6) {
        for (var i = 0; i < BOSS_SPIKES.length; i++) if (BOSS_SPIKES[i][0] === tx && BOSS_SPIKES[i][1] === ty) return true;
      }
      return false;
    },
    solidAtPx: function (x, y) { return this.solidAt(Math.floor(x / T), Math.floor(y / T)); },
    solidOrLedgeAtPx: function (x, y) { var tx = Math.floor(x / T), ty = Math.floor(y / T); return this.solidAt(tx, ty) || this.oneWayAt(tx, ty); },
    spikeAtPx: function (x, y) { return this.spikeAt(Math.floor(x / T), Math.floor(y / T)); },
    oneWayHitPx: function (x, y, vy) { if (vy <= 0) return false; var ty = Math.floor(y / T); return this.oneWayAt(Math.floor(x / T), ty) && (y - ty * T) < 10; },
    rectSolid: function (x, y, w, h) {
      var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return true;
      return false;
    },
    // spikes occupy the lower part of their tile
    rectSpikes: function (x, y, w, h) {
      var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
        if (this.spikeAt(tx, ty) && overlap({ x: x, y: y, w: w, h: h }, { x: tx * T + 3, y: ty * T + 14, w: T - 6, h: T - 14 })) return true;
      }
      return false;
    },
    spikesNear: function (p) {
      var ty = Math.floor((p.y + p.h - 4) / T), x0 = Math.floor(p.x / T) - 2, x1 = Math.floor((p.x + p.w) / T) + 2;
      for (var tx = x0; tx <= x1; tx++) if (this.spikeAt(tx, ty) || this.spikeAt(tx, ty + 1)) return true;
      return false;
    },
    onGround: function (b, dropping) {
      var y = b.y + b.h + 0.5, ty = Math.floor(y / T);
      var x0 = Math.floor((b.x + 0.5) / T), x1 = Math.floor((b.x + b.w - 0.5) / T);
      for (var tx = x0; tx <= x1; tx++) {
        if (this.solidAt(tx, ty)) return true;
        if (!dropping && this.oneWayAt(tx, ty) && Math.abs(b.y + b.h - ty * T) < 1.5) return true;
      }
      return false;
    },
    moveBody: function (b, dx, dy, oneWay, dropping) {
      var res = { hitX: 0, hitY: 0 }, tx, ty, x0, x1, y0, y1;
      if (dx !== 0) {
        b.x += dx;
        y0 = Math.floor(b.y / T); y1 = Math.floor((b.y + b.h - 0.01) / T);
        if (dx > 0) {
          tx = Math.floor((b.x + b.w - 0.01) / T);
          for (ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { b.x = tx * T - b.w; res.hitX = 1; break; }
        } else {
          tx = Math.floor(b.x / T);
          for (ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { b.x = (tx + 1) * T; res.hitX = -1; break; }
        }
      }
      if (dy !== 0) {
        var prevBottom = b.y + b.h;
        b.y += dy;
        x0 = Math.floor(b.x / T); x1 = Math.floor((b.x + b.w - 0.01) / T);
        if (dy > 0) {
          ty = Math.floor((b.y + b.h - 0.01) / T);
          for (tx = x0; tx <= x1; tx++) {
            if (this.solidAt(tx, ty) || (oneWay && !dropping && this.oneWayAt(tx, ty) && prevBottom <= ty * T + 0.5)) {
              b.y = ty * T - b.h; res.hitY = 1; break;
            }
          }
        } else {
          ty = Math.floor(b.y / T);
          for (tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) { b.y = (ty + 1) * T; res.hitY = -1; break; }
        }
      }
      return res;
    }
  };
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  window.overlap = overlap;
  var BOSS_SPIKES = [];

  // ====================================================================== particles
  function part(o) { if (G.particles.length < 900) G.particles.push(o); return o; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var FX = window.FX = {
    dust: function (x, y, n) {
      for (var i = 0; i < n; i++) part({ x: x + rnd(-8, 8), y: y - 2, vx: rnd(-90, 90), vy: rnd(-70, -10), life: rnd(0.3, 0.6), max: 0.6, size: rnd(2, 4), color: 'rgba(150,180,200,0.5)', drag: 0.9, grav: 60, shrink: true });
    },
    wallDust: function (p) {
      var x = p.wallDir > 0 ? p.x + p.w : p.x;
      part({ x: x, y: p.y + p.h * 0.6, vx: -p.wallDir * rnd(10, 40), vy: rnd(-20, 20), life: 0.4, max: 0.4, size: 2, color: 'rgba(150,180,200,0.5)', drag: 0.9, shrink: true });
    },
    dashBurst: function (p) {
      for (var i = 0; i < 10; i++) part({ x: p.x + p.w / 2, y: p.y + p.h / 2 + rnd(-12, 12), vx: -p.dashDir * rnd(60, 220), vy: rnd(-30, 30), life: rnd(0.2, 0.4), max: 0.4, size: rnd(1.5, 3), color: '#9fefff', add: true, drag: 0.9, shrink: true });
    },
    hit: function (x, y, dir, color) {
      for (var i = 0; i < 10; i++) {
        var a = rnd(-0.9, 0.9) + (dir < 0 ? Math.PI : 0);
        var sp = rnd(150, 420);
        part({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.15, 0.35), max: 0.35, size: rnd(1.5, 2.5), color: color || '#ffffff', add: true, drag: 0.86, shape: 'streak' });
      }
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.18, max: 0.18, size: 8, grow: 26, color: 'rgba(230,250,255,0.9)', add: true, shape: 'ring' });
    },
    sparks: function (x, y) {
      for (var i = 0; i < 7; i++) part({ x: x, y: y, vx: rnd(-200, 200), vy: rnd(-260, -40), life: rnd(0.15, 0.3), max: 0.3, size: 1.5, color: '#ffe9b8', add: true, grav: 900, shape: 'streak' });
    },
    enemyDeath: function (x, y, type) {
      var col = type === 'flyer' || type === 'wisp' ? '#c9a8ff' : type === 'spitter' ? '#d2ff8c' : type === 'grub' ? '#bff6ff' : '#7ff0dc';
      for (var i = 0; i < 26; i++) {
        var a = rnd(0, Math.PI * 2), sp = rnd(60, 340);
        part({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: rnd(0.4, 0.9), max: 0.9, size: rnd(1.5, 4), color: col, add: true, drag: 0.92, grav: 200, shrink: true });
      }
      for (var j = 0; j < 8; j++) part({ x: x, y: y, vx: rnd(-120, 120), vy: rnd(-220, -60), life: rnd(0.5, 0.9), max: 0.9, size: rnd(2, 4), color: '#0b1420', grav: 700, drag: 0.98 });
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 10, grow: 50, color: col, add: true, shape: 'ring' });
    },
    trail: function (x, y, col) { part({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: 0, vy: 0, life: 0.3, max: 0.3, size: rnd(1.5, 3), color: col, add: true, shrink: true }); },
    pop: function (x, y, col) { for (var i = 0; i < 10; i++) part({ x: x, y: y, vx: rnd(-150, 150), vy: rnd(-200, 20), life: rnd(0.2, 0.45), max: 0.45, size: rnd(1.5, 3), color: col, add: true, grav: 500, shrink: true }); },
    ember: function (x, y) { part({ x: x + rnd(-6, 6), y: y, vx: rnd(-20, 20), vy: rnd(-80, -30), life: rnd(0.3, 0.6), max: 0.6, size: rnd(1.5, 2.5), color: '#c9a8ff', add: true, shrink: true }); },
    shatter: function (x, y) { for (var i = 0; i < 12; i++) part({ x: x, y: y, vx: rnd(-180, 180), vy: rnd(-260, -40), life: rnd(0.4, 0.8), max: 0.8, size: rnd(2, 4), color: '#3a4660', grav: 900 }); },
    healMote: function (p) { part({ x: p.x + p.w / 2 + rnd(-16, 16), y: p.y + p.h - rnd(0, 10), vx: 0, vy: rnd(-90, -40), life: 0.6, max: 0.6, size: rnd(1.5, 2.5), color: '#bff6ff', add: true, shrink: true }); },
    healBurst: function (p) { for (var i = 0; i < 24; i++) { var a = rnd(0, Math.PI * 2); part({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: Math.cos(a) * rnd(60, 200), vy: Math.sin(a) * rnd(60, 200), life: 0.6, max: 0.6, size: 2.5, color: '#dffbff', add: true, drag: 0.9, shrink: true }); } },
    roarRing: function (x, y) {
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 20, grow: 380, color: 'rgba(200,160,255,0.8)', add: true, shape: 'ring' });
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 10, grow: 220, color: 'rgba(255,220,180,0.7)', add: true, shape: 'ring' });
    },
    bossBurst: function (x, y) {
      for (var i = 0; i < 14; i++) { var a = rnd(0, Math.PI * 2), sp = rnd(80, 360); part({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.4, 0.9), max: 0.9, size: rnd(2, 4), color: Math.random() < 0.5 ? '#ffd27a' : '#c9a8ff', add: true, drag: 0.93, shrink: true }); }
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 6, grow: 60, color: '#ffe9c0', add: true, shape: 'ring' });
    },
    bossExplode: function (x, y) {
      for (var i = 0; i < 160; i++) { var a = rnd(0, Math.PI * 2), sp = rnd(60, 700); part({ x: x + rnd(-30, 30), y: y + rnd(-30, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rnd(0.8, 2.2), max: 2.2, size: rnd(2, 5), color: ['#ffd27a', '#ffe9c0', '#c9a8ff', '#bff6ff'][i % 4], add: true, drag: 0.96, grav: 40, shrink: true }); }
      for (var k = 0; k < 3; k++) part({ x: x, y: y, vx: 0, vy: 0, life: 0.8 + k * 0.3, max: 0.8 + k * 0.3, size: 20, grow: 500 + k * 200, color: 'rgba(255,230,190,0.9)', add: true, shape: 'ring' });
      // the swallowed lanterns drift free
      for (var j = 0; j < 12; j++) part({ x: x + rnd(-40, 40), y: y + rnd(-20, 20), vx: rnd(-40, 40), vy: rnd(-90, -30), life: rnd(3, 5), max: 5, size: rnd(3, 5), color: '#ffd27a', add: true, drag: 0.995, float: true });
    },
    playerDeath: function (p) {
      var x = p.x + p.w / 2, y = p.y + p.h / 2;
      for (var i = 0; i < 40; i++) { var a = rnd(0, Math.PI * 2), sp = rnd(40, 300); part({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.6, 1.4), max: 1.4, size: rnd(1.5, 3.5), color: '#bff6ff', add: true, drag: 0.94, shrink: true }); }
      part({ x: x, y: y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 10, grow: 120, color: '#dffbff', add: true, shape: 'ring' });
    },
    restBurst: function (x, y) { for (var i = 0; i < 30; i++) part({ x: x + rnd(-20, 20), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-140, -40), life: rnd(0.8, 1.6), max: 1.6, size: rnd(1.5, 3), color: '#ffd27a', add: true, drag: 0.97, shrink: true }); },
    wallBreak: function (x, y) { for (var i = 0; i < 40; i++) part({ x: x + rnd(-10, 10), y: y + rnd(-48, 48), vx: rnd(-80, 260), vy: rnd(-300, 0), life: rnd(0.6, 1.2), max: 1.2, size: rnd(2, 5), color: '#202c40', grav: 1000, drag: 0.98 }); },
    spawnPuff: function (x, y) { for (var i = 0; i < 18; i++) { var a = rnd(0, Math.PI * 2); part({ x: x, y: y, vx: Math.cos(a) * rnd(40, 160), vy: Math.sin(a) * rnd(40, 160), life: 0.5, max: 0.5, size: rnd(2, 4), color: '#b48cff', add: true, drag: 0.9, shrink: true }); } }
  };
  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      if (p.grav) p.vy += p.grav * dt;
      if (p.drag) { var d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
      if (p.float) p.vx += Math.sin(G.t * 2 + i) * 20 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function updateAmbient(dt) {
    var cam = G.cam;
    while (G.ambient.length < 70) {
      var fly = Math.random() < 0.45;
      G.ambient.push({
        kind: fly ? 'fly' : 'spore', x: cam.x + Math.random() * W, y: cam.y + Math.random() * H,
        vx: rnd(-10, 10), vy: fly ? rnd(-10, 10) : rnd(-18, -6), ph: rnd(0, 6), sp: rnd(1, 3),
        color: fly ? (Math.random() < 0.6 ? '#ffd27a' : '#bff6ff') : (Math.random() < 0.5 ? '#9fdcd0' : '#c9b8ff'),
        alpha: fly ? rnd(0.6, 1) : rnd(0.25, 0.6), size: rnd(0.8, 2)
      });
    }
    for (var i = G.ambient.length - 1; i >= 0; i--) {
      var a = G.ambient[i];
      if (a.kind === 'fly') { a.vx += Math.sin(G.t * a.sp + a.ph) * 30 * dt; a.vy += Math.cos(G.t * a.sp * 0.7 + a.ph) * 30 * dt; a.vx *= 0.98; a.vy *= 0.98; }
      else a.vx = Math.sin(G.t * 0.5 + a.ph) * 12;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < cam.x - 60 || a.x > cam.x + W + 60 || a.y < cam.y - 60 || a.y > cam.y + H + 60 || World.solidAtPx(a.x, a.y)) {
        // respawn at a random spot on screen (prefer edges so they drift in)
        a.x = cam.x + Math.random() * W; a.y = cam.y + Math.random() * H;
        if (World.solidAtPx(a.x, a.y)) { G.ambient.splice(i, 1); }
      }
    }
  }

  // ====================================================================== level setup
  var player = null;
  function parseLevel() {
    G.decor = []; G.signs = [];
    LEVEL.entities.forEach(function (d) {
      var px = d.x * T + T / 2, py = (d.y + 1) * T;
      if (d.type === 'lantern' || d.type === 'crystal' || d.type === 'brazier') G.decor.push({ type: d.type, px: d.type === 'lantern' ? px - 12 : px, py: py });
      else if (d.type === 'hanglamp') {
        var top = d.y; while (top > 0 && !World.solidAt(d.x, top - 1)) top--;
        G.decor.push({ type: 'hanglamp', px: px, py: d.y * T + 26, top: top * T });
      }
      else if (d.type === 'sign') G.signs.push({ px: px, py: py, text: d.text });
      else if (d.type === 'rest') G.rest = { px: px, py: py, tx: d.x, ty: d.y };
      else if (d.type === 'heart') G.heart = { px: px, py: py };
      else if (d.type === 'arena') G.arena = { def: d, state: 'idle', wave: 0, waveT: 0 };
      else if (d.type === 'boss') G.bossDef = d;
    });
    var bd = G.bossDef;
    BOSS_SPIKES = [];
    [bd.x0, bd.x0 + 1, bd.x1 - 1, bd.x1].forEach(function (tx) { BOSS_SPIKES.push([tx, bd.y]); });
  }
  function spawnLevelEnemies() {
    G.enemies = [];
    LEVEL.entities.forEach(function (d) {
      if (d.type === 'crawler' || d.type === 'flyer' || d.type === 'spitter' || d.type === 'grub') G.enemies.push(createEnemy(d));
    });
  }
  function resetBoss() {
    G.boss = createBoss(G.bossDef);
    G.bossState = 'waiting'; G.bossGateClosed = false; G.bossSpikes = false; G.bossSpikeAnim = 0;
    G.rainTarget = 0; G.brazierTarget = 1; G.darkBoost = 0; G.phaseRed = 0;
    Snd.setIntensity(1);
  }
  function resetArena() {
    if (G.arena && G.arena.state !== 'done') { G.arena.state = 'idle'; G.arena.wave = 0; }
    G.arenaClosed = false;
  }
  function newGame() {
    G.map = LEVEL.map; parseLevel();
    G.maxHp = CFG.player.maxHp; G.heartTaken = false; G.rested = false; G.broken = false; G.breakHp = 3;
    if (G.arena) G.arena.state = 'idle';
    G.respawn = { x: LEVEL.playerStart.x, y: LEVEL.playerStart.y };
    G.deaths = 0; G.playTime = 0; G.bossSeen = false;
    G.areaCardT = 0;
    spawnAll();
    snapCamera();
  }
  function spawnAll() {
    player = createPlayer(G.respawn.x, G.respawn.y, G.maxHp);
    G.player = player;
    G.projectiles = []; G.bolts = []; G.particles = [];
    spawnLevelEnemies(); resetArena(); resetBoss();
    G.deathT = -1; G.spikeResetT = 0; G.timeScale = 1; G.hitStop = 0;
    G.victoryDelay = -1;
    Snd.music('explore');
  }
  function respawn() {
    var energy = player ? player.energy : 0;
    spawnAll();
    player.energy = Math.min(energy, CFG.player.energyMax);
    G.fadeIn = 1;
    snapCamera();
  }

  // ====================================================================== Game API (used by entities)
  var Game = window.Game = {
    shake: function (a) { G.shakeAmt = Math.max(G.shakeAmt, a); },
    hitStop: function (d) { G.hitStop = Math.max(G.hitStop, d); },
    onScreen: function (x, y) { return x > G.cam.x - 60 && x < G.cam.x + W + 60 && y > G.cam.y - 60 && y < G.cam.y + H + 60; },
    spawnProjectile: function (pr) { pr.dead = false; G.projectiles.push(pr); },
    spawnBolt: function (p) {
      G.bolts.push({ x: p.x + p.w / 2 + p.facing * 14, y: p.y + p.h * 0.45, dir: p.facing, life: 0.9 });
      Snd.play('bolt'); Game.shake(3);
      for (var i = 0; i < 8; i++) part({ x: p.x + p.w / 2 + p.facing * 16, y: p.y + p.h * 0.45, vx: p.facing * rnd(50, 250), vy: rnd(-80, 80), life: 0.3, max: 0.3, size: 2, color: '#bff6ff', add: true, drag: 0.9, shrink: true });
    },
    spawnWisp: function (x, y) {
      var e = createEnemy({ type: 'wisp', px: x, py: y });
      e.cd = 0.8 + Math.random() * 0.6; e.bossMinion = true;
      G.enemies.push(e); FX.spawnPuff(x, y);
    },
    countWisps: function () { var n = 0; G.enemies.forEach(function (e) { if (e.type === 'wisp' && !e.dead && e.dying <= 0) n++; }); return n; },
    hudGain: function () { G.hud.gainT = 0.5; },
    bossTitle: function () { G.bossCardT = 3.2; Snd.music('boss'); },
    bossFightStart: function () { G.bossState = 'fight'; },
    bossRoarPush: function (b) {
      var dir = (player.x + player.w / 2) < (b.x + b.w / 2) ? -1 : 1;
      if (!player.dead) { player.vx = dir * 420; player.vy = -260; player.hurtT = 0.12; }
      G.projectiles = [];
    },
    bossPhaseChange: function (ph) {
      if (ph === 2) { G.rainTarget = 0.6; G.brazierTarget = 0.45; G.darkBoost = 0.05; Snd.setIntensity(2); showToast('The lanterns gutter. Rain begins to fall.', 2.2); }
      if (ph === 3) { G.rainTarget = 1; G.brazierTarget = 0.25; G.darkBoost = 0.08; G.bossSpikes = true; G.phaseRed = 1; Snd.setIntensity(3); showToast('Thorns rise from the drowned stone.', 2.2); }
    },
    bossDying: function (b) {
      G.timeScale = 0.3;
      Snd.music('none');
      Snd.play('roar');
      G.projectiles = [];
      G.enemies.forEach(function (e) { if (e.bossMinion && e.dying <= 0) { e.dying = 0.4; FX.enemyDeath(e.x + e.w / 2, e.y + e.h / 2, e.type); } });
      Game.hitStop(0.15);
    },
    bossExplode: function (b) {
      FX.bossExplode(b.x + b.w / 2, b.y + b.h / 2);
      Snd.play('bossDie'); Game.shake(26); G.flash = 1;
      G.timeScale = 1; G.victoryDelay = 3.2; G.bossState = 'dead'; G.rainTarget = 0;
      Snd.stopMusicNow();
      G.bossGateClosed = false;
    }
  };
  function showToast(text, dur) { G.toast.text = text; G.toast.t = dur || 2.5; }

  function hurtPlayer(dmg, srcX, opts) {
    var p = player;
    if (p.dead || G.deathT >= 0) return false;
    if (p.invuln > 0) return false;
    if (G.godMode) { p.invuln = 0.4; return false; }
    var P = CFG.player;
    p.hp -= dmg; p.invuln = P.invuln; p.hurtT = P.hurtStun;
    p.healing = false; p.healT = 0; p.dashT = 0; p.slashT = 0; p.slashAnim = 0;
    var kdir = (p.x + p.w / 2) < srcX ? -1 : 1;
    p.vx = kdir * P.knockbackX; p.vy = P.knockbackY;
    Game.hitStop(CFG.hitStop.hurt); Game.shake(dmg > 1 ? 16 : 10);
    G.hurtPulse = 1; G.hud.lostT = 1;
    Snd.play('hurt');
    FX.hit(p.x + p.w / 2, p.y + p.h / 2, kdir, '#ff8fa3');
    if (p.hp <= 0) { killPlayer(); return true; }
    if (opts && opts.spikes) { G.spikeResetT = 0.5; }
    return true;
  }
  function killPlayer() {
    var p = player;
    p.hp = 0; p.dead = true;
    FX.playerDeath(p); Snd.play('death');
    Game.hitStop(0.12); Game.shake(14);
    G.deathT = 0; G.deaths++;
    if (G.bossState !== 'waiting') Snd.music('none');
  }

  // ====================================================================== update
  function step(rdt) {
    G.t += rdt;
    Snd.update();
    if (Input.pressed('mute')) Snd.toggleMute();
    switch (G.state) {
      case 'title':
        G.titleT += rdt;
        G.cam.x += 30 * rdt; if (G.cam.x > 3200) G.cam.x = 0;
        G.cam.y = 1250;
        updateAmbient(rdt); updateParticles(rdt);
        if (Input.pressed('enter')) { Snd.init(); Snd.play('ui'); newGame(); G.state = 'play'; G.fadeIn = 1; }
        break;
      case 'paused':
        if (Input.pressed('pause') || Input.pressed('enter')) G.state = 'play';
        if (Input.pressed('restart')) { G.state = 'play'; respawn(); }
        break;
      case 'victory':
        G.victoryT += rdt;
        updateParticles(rdt); updateAmbient(rdt);
        if (G.victoryT > 2.5 && Input.pressed('enter')) { G.state = 'title'; G.titleT = 0; Snd.music('explore'); }
        break;
      case 'play':
        if (Input.pressed('pause')) { G.state = 'paused'; Snd.play('ui'); break; }
        if (Input.pressed('restart') && G.deathT < 0) { respawn(); break; }
        if (Input.pressed('debugGod')) { G.godMode = !G.godMode; G.hud.godMode = G.godMode; }
        if (Input.pressed('debugWarp')) { debugWarp(); }
        updatePlay(rdt);
        break;
    }
  }

  function debugWarp() {
    var t = LEVEL.bossGateTeleport;
    player.x = t.x * T + (T - player.w) / 2; player.y = (t.y + 1) * T - player.h; player.vx = player.vy = 0;
    if (G.arena) G.arena.state = 'done'; G.arenaClosed = false;
    snapCamera();
  }

  function updatePlay(rdt) {
    // screen-level timers (real time)
    G.shakeAmt *= Math.pow(0.86, rdt * 60); if (G.shakeAmt < 0.3) G.shakeAmt = 0;
    G.shakeX = (Math.random() * 2 - 1) * G.shakeAmt; G.shakeY = (Math.random() * 2 - 1) * G.shakeAmt;
    G.hurtPulse = Math.max(0, G.hurtPulse - rdt * 1.6);
    G.hud.lostT = Math.max(0, G.hud.lostT - rdt * 1.5); G.hud.gainT = Math.max(0, G.hud.gainT - rdt * 1.5);
    G.toast.t -= rdt; G.fadeIn = Math.max(0, G.fadeIn - rdt * 1.4); G.flash = Math.max(0, G.flash - rdt * 1.2);
    if (G.areaCardT >= 0) { G.areaCardT += rdt; if (G.areaCardT > 8) G.areaCardT = -1; }
    G.bossCardT = Math.max(0, G.bossCardT - rdt);
    G.phaseRed = Math.max(0, G.phaseRed - rdt * 0.8);
    var showBar = (G.bossState === 'fight' || (G.bossState === 'intro' && G.boss.roared)) && !G.boss.gone;
    G.bossBarA += ((showBar ? 1 : 0) - G.bossBarA) * Math.min(1, rdt * 3);
    G.rain += (G.rainTarget - G.rain) * Math.min(1, rdt * 0.8);
    G.brazier += (G.brazierTarget - G.brazier) * Math.min(1, rdt * 1.5);
    G.bossSpikeAnim = G.bossSpikes ? Math.min(1, G.bossSpikeAnim + rdt * 1.5) : 0;
    G.arenaGate += ((G.arenaClosed ? 1 : 0) - G.arenaGate) * Math.min(1, rdt * 10);
    G.bossGate += ((G.bossGateClosed ? 1 : 0) - G.bossGate) * Math.min(1, rdt * 10);
    if (G.rain > 0.5 && Math.random() < rdt * 0.25) G.lightning = 1;
    G.lightning = Math.max(0, G.lightning - rdt * 3);

    // victory countdown (silence after the death)
    if (G.victoryDelay > 0) {
      G.victoryDelay -= rdt;
      if (G.victoryDelay <= 0) { G.state = 'victory'; G.victoryT = 0; Snd.play('victory'); }
    }

    // death sequence
    if (G.deathT >= 0) {
      G.deathT += rdt;
      updateParticles(rdt * 0.5);
      if (G.deathT > 2.2) { respawn(); }
      return;
    }
    if (G.hitStop > 0) { G.hitStop -= rdt; return; }

    var dt = rdt * G.timeScale;
    G.playTime += rdt;

    // spike reset: freeze, fade, return to safe ground
    if (G.spikeResetT > 0) {
      G.spikeResetT -= rdt;
      if (G.spikeResetT <= 0) {
        player.x = player.safeX; player.y = player.safeY; player.vx = 0; player.vy = 0; player.hurtT = 0;
        player.invuln = Math.max(player.invuln, 0.8);
        G.fadeIn = 0.7;
      }
      updateParticles(dt);
      return;
    }

    updatePlayer(player, Input, dt);
    if (player.y > G.mapH + 100) { hurtPlayer(1, player.x, { spikes: true }); }
    resolvePlayerAttacks();

    // enemies
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (!Game.onScreenWide(e) && !e.arena && !e.bossMinion) continue;
      updateEnemy(e, dt, player);
      if (e.dead) G.enemies.splice(i, 1);
    }
    // boss
    updateBossFlow(dt);
    // projectiles
    for (var j = G.projectiles.length - 1; j >= 0; j--) {
      var pr = G.projectiles[j];
      updateProjectile(pr, dt);
      if (pr.dead) G.projectiles.splice(j, 1);
    }
    updateBolts(dt);
    // damage to player
    playerDamageChecks();
    updateArena(dt);
    updateInteractions();
    updateParticles(dt);
    updateAmbient(dt);
    updateCamera(rdt);
  }
  Game.onScreenWide = function (e) { return e.x > G.cam.x - 500 && e.x < G.cam.x + W + 500 && e.y > G.cam.y - 400 && e.y < G.cam.y + H + 400; };

  function gainEnergy(n) { player.energy = Math.min(CFG.player.energyMax, player.energy + n); }

  function resolvePlayerAttacks() {
    var p = player, box = playerSlashBox(p);
    if (!box) return;
    var P = CFG.player, hitAny = false;
    var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    var dY = p.slashDir === 'up' ? -1 : p.slashDir === 'down' ? 1 : -0.25;
    // enemies
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dying > 0 || p.slashHits.indexOf(e) >= 0) continue;
      if (!overlap(box, enemyBox(e))) continue;
      p.slashHits.push(e);
      var dX = p.slashDir === 'fwd' ? p.facing : ((e.x + e.w / 2) > pcx ? 1 : -1) * 0.4;
      var killed = hurtEnemy(e, P.slashDamage, dX, dY);
      gainEnergy(P.energyPerHit);
      Game.hitStop(killed ? CFG.hitStop.kill : CFG.hitStop.hit); Game.shake(killed ? 6 : 3);
      Snd.play('hit');
      playerSlashRecoil(p, true); hitAny = true;
    }
    // boss
    var b = G.boss;
    if (b && !b.gone && p.slashHits.indexOf(b) < 0 && overlap(box, bossBox(b))) {
      p.slashHits.push(b);
      if (hurtBoss(b, P.slashDamage, p.facing)) {
        gainEnergy(P.energyPerHit);
        Game.hitStop(CFG.hitStop.bossHit); Game.shake(4); Snd.play('hit');
        var hx = Math.max(box.x, Math.min(box.x + box.w, b.x + b.w / 2)), hy = Math.max(box.y, Math.min(box.y + box.h, pcy));
        FX.hit(hx, hy, p.facing, '#f0e0ff');
        playerSlashRecoil(p, true); hitAny = true;
      } else if (b.state !== 'dormant') { Snd.play('clink'); FX.sparks(pcx + p.facing * 30, pcy); playerSlashRecoil(p, true); }
    }
    // projectiles: slash destroys seeds/embers/debris; down-slash pogos off any of them
    for (var j = 0; j < G.projectiles.length; j++) {
      var pr = G.projectiles[j];
      if (pr.dead || p.slashHits.indexOf(pr) >= 0) continue;
      if (!overlap(box, projectileBox(pr))) continue;
      p.slashHits.push(pr);
      if (pr.kind !== 'wave') { pr.dead = true; FX.pop(pr.x, pr.y, '#ffffff'); }
      Snd.play('clink'); Game.hitStop(0.04);
      playerSlashRecoil(p, true); hitAny = true;
    }
    // spikes (pogo)
    if (p.slashDir === 'down' && !p.pogoDone && World.rectSpikes(box.x, box.y, box.w, box.h)) {
      playerSlashRecoil(p, true);
      Snd.play('clink'); FX.sparks(pcx, p.y + p.h + 14); Game.shake(2); Game.hitStop(0.03);
      hitAny = true;
    }
    // breakable wall
    if (!G.broken && p.slashHits.indexOf('wall') < 0 && rectHasBreakable(box)) {
      p.slashHits.push('wall');
      G.breakHp--;
      Game.shake(4); Game.hitStop(0.05); Snd.play('crumble'); Snd.play('hit');
      FX.sparks(pcx + p.facing * 34, pcy);
      playerSlashRecoil(p, false);
      if (G.breakHp <= 0) { G.broken = true; Snd.play('breakWall'); Game.shake(9); FX.wallBreak(breakableX() + T / 2, breakableY()); }
    } else if (p.slashDir === 'fwd' && p.slashHits.indexOf('rock') < 0 && World.rectSolid(box.x, box.y + 10, box.w, box.h - 20) && !hitAny) {
      p.slashHits.push('rock');
      Snd.play('clink'); FX.sparks(p.facing > 0 ? box.x + box.w - 20 : box.x + 20, pcy);
    }
  }
  var BREAKABLES = null;
  function getBreakables() {
    if (!BREAKABLES) { BREAKABLES = []; for (var y = 0; y < G.map.length; y++) for (var x = 0; x < G.map[y].length; x++) if (G.map[y].charAt(x) === 'B') BREAKABLES.push([x, y]); }
    return BREAKABLES;
  }
  function rectHasBreakable(box) {
    var bs = getBreakables();
    for (var i = 0; i < bs.length; i++) if (overlap(box, { x: bs[i][0] * T, y: bs[i][1] * T, w: T, h: T })) return true;
    return false;
  }
  function breakableX() { return getBreakables()[0][0] * T; }
  function breakableY() { var bs = getBreakables(); return (bs[0][1] + bs[bs.length - 1][1] + 1) / 2 * T; }

  function updateBolts(dt) {
    var P = CFG.player;
    for (var i = G.bolts.length - 1; i >= 0; i--) {
      var bl = G.bolts[i];
      bl.life -= dt; bl.x += bl.dir * P.boltSpeed * dt;
      if (Math.random() < 0.8) part({ x: bl.x, y: bl.y + rnd(-3, 3), vx: -bl.dir * rnd(20, 80), vy: rnd(-20, 20), life: 0.3, max: 0.3, size: 2, color: '#bff6ff', add: true, shrink: true });
      var box = { x: bl.x - 12, y: bl.y - 9, w: 24, h: 18 };
      var dead = bl.life <= 0;
      for (var j = 0; j < G.enemies.length && !dead; j++) {
        var e = G.enemies[j];
        if (e.dying > 0) continue;
        if (overlap(box, enemyBox(e))) { var k = hurtEnemy(e, P.boltDamage, bl.dir, -0.2); Game.hitStop(k ? CFG.hitStop.kill : CFG.hitStop.hit); Snd.play('hit'); Game.shake(4); dead = true; }
      }
      var b = G.boss;
      if (!dead && b && !b.gone && overlap(box, bossBox(b)) && bossVulnerable(b)) { hurtBoss(b, P.boltDamage, bl.dir); FX.hit(bl.x, bl.y, bl.dir, '#bff6ff'); Snd.play('hit'); Game.hitStop(CFG.hitStop.bossHit); Game.shake(5); dead = true; }
      if (!dead && !G.broken && rectHasBreakable(box)) { G.breakHp = 0; G.broken = true; Snd.play('breakWall'); Game.shake(9); FX.wallBreak(breakableX() + T / 2, breakableY()); dead = true; }
      if (!dead && World.solidAtPx(bl.x + bl.dir * 8, bl.y)) dead = true;
      if (dead) { FX.pop(bl.x, bl.y, '#bff6ff'); G.bolts.splice(i, 1); }
    }
  }

  function playerDamageChecks() {
    var p = player;
    if (p.dead) return;
    var pb = { x: p.x + 4, y: p.y + 6, w: p.w - 8, h: p.h - 8 };
    // spikes
    if (World.rectSpikes(pb.x, pb.y, pb.w, pb.h)) {
      if (p.invuln > 0 || G.godMode) { if (p.vy > 0) { p.vy = -520; } }
      else hurtPlayer(1, p.x + p.w / 2 - p.vx * 0.01, { spikes: true });
      return;
    }
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.harmless || e.dying > 0) continue;
      if (overlap(pb, enemyBox(e))) { hurtPlayer(1, e.x + e.w / 2); return; }
    }
    for (var j = 0; j < G.projectiles.length; j++) {
      var pr = G.projectiles[j];
      if (pr.dead) continue;
      if (overlap(pb, projectileBox(pr))) {
        if (hurtPlayer(1, pr.x) && pr.kind !== 'wave') { pr.dead = true; FX.pop(pr.x, pr.y, '#ffcf8a'); }
        return;
      }
    }
    var b = G.boss;
    if (b && bossCanHurtPlayer(b) && overlap(pb, bossBox(b))) hurtPlayer(bossContactDamage(b), b.x + b.w / 2);
  }

  function updateArena(dt) {
    var A = G.arena; if (!A) return;
    var d = A.def, p = player;
    var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    if (A.state === 'idle') {
      if (pcx > d.x0 * T && pcx < (d.x1 + 1) * T && pcy > d.y0 * T && pcy < (d.y1 + 1) * T && p.onGround) {
        A.state = 'active'; A.wave = 0; A.waveT = 0.9;
        G.arenaClosed = true; Snd.play('gate'); Game.shake(6);
        showToast('The way is barred.', 1.6);
      }
    } else if (A.state === 'active') {
      var alive = 0;
      G.enemies.forEach(function (e) { if (e.arena && e.dying <= 0) alive++; });
      if (A.waveT > 0) {
        A.waveT -= dt;
        if (A.waveT <= 0) {
          d.waves[A.wave].forEach(function (s) {
            var e = createEnemy({ type: s.type, x: s.x, y: s.y, arena: true });
            e.cd = 0.8 + Math.random(); G.enemies.push(e);
            FX.spawnPuff(e.x + e.w / 2, e.y + e.h / 2);
          });
          Snd.play('windSummon');
          A.wave++;
        }
      } else if (alive === 0) {
        if (A.wave < d.waves.length) A.waveT = 1.1;
        else { A.state = 'done'; G.arenaClosed = false; Snd.play('gate'); Snd.play('pickup'); showToast('The bars lift.', 1.6); }
      }
    }
  }

  function updateInteractions() {
    var p = player;
    var pcx = p.x + p.w / 2;
    // rest point
    var r = G.rest;
    if (r && Math.abs(pcx - r.px) < 40 && Math.abs(p.y + p.h - r.py) < 20 && p.onGround) {
      r.near = true;
      if (Input.pressed('up')) {
        p.hp = p.maxHp; G.rested = true; G.respawn = { x: r.tx, y: r.ty };
        Snd.play('rest'); FX.restBurst(r.px, r.py - 30);
        showToast('The shrine kindles. You will return here.', 2.6);
        G.hud.gainT = 0.5;
      }
    } else if (r) r.near = false;
    // heart upgrade
    var h = G.heart;
    if (h && !G.heartTaken && overlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: h.px - 14, y: h.py - 44, w: 28, h: 40 })) {
      G.heartTaken = true; G.maxHp++; p.maxHp = G.maxHp; p.hp = p.maxHp;
      Snd.play('pickup'); FX.restBurst(h.px, h.py - 26); Game.hitStop(0.1);
      showToast('Ember Heart  -  your flame grows (+1 max health)', 3);
      G.hud.gainT = 0.6;
    }
  }

  function updateBossFlow(dt) {
    var b = G.boss; if (!b) return;
    var p = player;
    if (G.bossState === 'waiting') {
      if (p.x > G.bossDef.triggerX * T && p.y > b.top && !p.dead) {
        G.bossState = 'intro'; b.state = 'intro'; b.t = G.bossSeen ? 1.1 : 0; G.bossSeen = true;
        G.bossGateClosed = true; Snd.play('gate'); Game.shake(8);
        Snd.music('none');
      }
    }
    if (G.bossState !== 'waiting' || b.state === 'dormant') updateBoss(b, dt, p);
  }

  // ====================================================================== camera
  function cameraTarget() {
    var p = player;
    var b = G.boss;
    if (b && (G.bossState === 'intro' || G.bossState === 'fight' || (G.bossState === 'dead' && G.state === 'play'))) {
      return { x: (b.x0 + b.x1) / 2 - W / 2, y: b.floorY - 452, lock: true };
    }
    var tx = p.x + p.w / 2 + p.facing * 70 + p.vx * 0.12 - W / 2;
    var ty = p.y + p.h / 2 - H * 0.52 + (p.vy > 500 ? 90 : 0);
    if (G.arena && G.arena.state === 'active') {
      var d = G.arena.def;
      tx = ((d.x0 + d.x1 + 1) / 2) * T - W / 2;
      ty = ((d.y0 + d.y1 + 1) / 2) * T - H / 2 - 10;
    }
    return { x: tx, y: ty };
  }
  function clampCam(c) {
    c.x = Math.max(0, Math.min(G.mapW - W, c.x));
    c.y = Math.max(0, Math.min(G.mapH - H, c.y));
  }
  function updateCamera(dt) {
    var t = cameraTarget();
    if (!t.lock) clampCam(t);
    var kx = 1 - Math.exp(-dt * (t.lock ? 4 : 6)), ky = 1 - Math.exp(-dt * (t.lock ? 4 : 5));
    G.cam.x += (t.x - G.cam.x) * kx; G.cam.y += (t.y - G.cam.y) * ky;
    if (!t.lock) clampCam(G.cam);
  }
  function snapCamera() { var t = cameraTarget(); if (!t.lock) clampCam(t); G.cam.x = t.x; G.cam.y = t.y; }

  // ====================================================================== render
  function gatherLights() {
    var L = [], tint = [], p = player;
    if (p && !p.dead) {
      L.push({ x: p.x + p.w / 2, y: p.y + 6, r: CFG.player.lightRadius + (p.healing ? 40 : 0), i: 0.95 });
      tint.push({ x: p.x + p.w / 2, y: p.y - 4, r: 120, c: '#7fe3ff', a: 0.08 });
    }
    G.decor.forEach(function (d) {
      if (d.type === 'lantern') { L.push({ x: d.px + 16, y: d.py - 64, r: 250, i: 0.92 }); tint.push({ x: d.px + 16, y: d.py - 60, r: 160, c: '#ffc36b', a: 0.12 }); }
      else if (d.type === 'hanglamp') { L.push({ x: d.px, y: d.py - 4, r: 220, i: 0.9 }); tint.push({ x: d.px, y: d.py, r: 140, c: '#ffc36b', a: 0.12 }); }
      else if (d.type === 'crystal') { L.push({ x: d.px, y: d.py - 14, r: 170, i: 0.8 }); tint.push({ x: d.px, y: d.py - 14, r: 120, c: '#7fe3ff', a: 0.12 }); }
      else if (d.type === 'brazier') { L.push({ x: d.px, y: d.py - 50, r: 120 + 260 * G.brazier, i: 0.9 }); tint.push({ x: d.px, y: d.py - 50, r: 80 + 140 * G.brazier, c: '#b48cff', a: 0.16 * G.brazier }); }
    });
    if (G.rest) { var rr = G.rested ? 380 : 300; L.push({ x: G.rest.px, y: G.rest.py - 34, r: rr, i: 0.97 }); tint.push({ x: G.rest.px, y: G.rest.py - 34, r: 200, c: '#ffc36b', a: G.rested ? 0.26 : 0.17 }); }
    if (G.heart && !G.heartTaken) { L.push({ x: G.heart.px, y: G.heart.py - 26, r: 150, i: 0.85 }); tint.push({ x: G.heart.px, y: G.heart.py - 26, r: 90, c: '#ff9a5a', a: 0.16 }); }
    if (!G.broken) { var bs = getBreakables(); L.push({ x: bs[0][0] * T + 16, y: breakableY(), r: 60, i: 0.5 }); }
    G.enemies.forEach(function (e) {
      var wind = e.state === 'wind';
      L.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: wind ? 130 : 95, i: wind ? 0.75 : 0.55 });
      if (wind) tint.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 70, c: e.type === 'spitter' ? '#c8ff8a' : '#ff5c8a', a: 0.18 });
    });
    G.projectiles.forEach(function (pr) {
      L.push({ x: pr.x, y: pr.y - (pr.kind === 'wave' ? 14 : 0), r: pr.kind === 'debris' ? 50 : 100, i: 0.7 });
      tint.push({ x: pr.x, y: pr.y - (pr.kind === 'wave' ? 14 : 0), r: 60, c: pr.kind === 'spit' ? '#c8ff8a' : pr.kind === 'orb' ? '#ffb86b' : '#b48cff', a: 0.15 });
    });
    G.bolts.forEach(function (bl) { L.push({ x: bl.x, y: bl.y, r: 170, i: 0.9 }); tint.push({ x: bl.x, y: bl.y, r: 90, c: '#7fe3ff', a: 0.2 }); });
    var b = G.boss;
    if (b && !b.gone && b.y + b.h > b.top) {
      var glowR = b.state === 'dormant' ? 120 : 240;
      L.push({ x: b.x + b.w / 2, y: b.y + b.h * 0.4, r: glowR, i: 0.85 });
      tint.push({ x: b.x + b.w / 2, y: b.y + b.h * 0.4, r: 110, c: '#ffc36b', a: 0.1 });
    }
    if (b && (b.state === 'diveTrack' || b.state === 'diveLock')) L.push({ x: b.markerX, y: b.floorY - 20, r: 140, i: 0.8 });
    if (b) b.warnings.forEach(function (w) { L.push({ x: w.x, y: b.floorY - 10, r: 90, i: 0.7 }); });
    // a whisper of moonlight on the boss arena so the fight stays readable
    if (G.bossState !== 'waiting' && b) L.push({ x: (b.x0 + b.x1) / 2, y: b.top + 60, r: 520, i: 0.35 - G.darkBoost });
    return { L: L, tint: tint };
  }

  function darknessLevel() {
    var d = CFG.colors.darkBase;
    var p = player;
    if (G.bossState !== 'waiting' && G.bossState !== 'dead') d = 0.8 + G.darkBoost;
    if (G.lightning > 0) d -= 0.25 * G.lightning;
    return Math.max(0.3, d);
  }

  function render() {
    var rs = G.rs;
    ctx.setTransform(rs, 0, 0, rs, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    var camX = Math.round((G.cam.x + G.shakeX) * rs) / rs, camY = Math.round((G.cam.y + G.shakeY) * rs) / rs;
    var cam = { x: camX, y: camY };
    var t = G.t;
    var mood = { moon: G.bossState !== 'waiting' && G.bossState !== 'dead' ? 0.5 : 1 };
    drawBackground(ctx, cam, t, mood);

    if (G.state === 'title') {
      drawFog(ctx, cam, t, 1.2);
      drawAmbientScreen(cam, t);
      drawVignette(ctx, 0, t, 0);
      drawTitleScreen(ctx, G.titleT);
      return;
    }

    ctx.save();
    ctx.translate(-camX, -camY);
    drawTiles(ctx, G.map, cam);
    // dynamic tiles
    if (!G.broken) getBreakables().forEach(function (bt) { drawBreakable(ctx, bt[0], bt[1], t, G.breakHp); });
    var ad = G.arena && G.arena.def;
    drawGate(ctx, 151, 26, 29, G.arenaGate, t);
    drawGate(ctx, 176, 26, 29, G.arenaGate, t);
    drawGate(ctx, 197, 34, 37, G.bossGate, t);
    if (G.bossSpikes) BOSS_SPIKES.forEach(function (s) { drawRisingSpikes(ctx, s[0], s[1], G.bossSpikeAnim); });
    // decor
    G.decor.forEach(function (d) {
      if (d.type === 'lantern') drawLanternPost(ctx, d, t);
      else if (d.type === 'hanglamp') drawHangLamp(ctx, d, t);
      else if (d.type === 'crystal') drawCrystal(ctx, d, t);
      else if (d.type === 'brazier') drawBrazier(ctx, d, t, G.brazier);
    });
    if (G.rest) drawRestPoint(ctx, G.rest, t, G.rested, G.rest.near);
    if (G.heart && !G.heartTaken) drawHeartPickup(ctx, G.heart, t);
    // boss (clipped to its arena so the dive vanishes into the dark ceiling)
    var b = G.boss;
    if (b) {
      if (b.state === 'diveTrack' || b.state === 'diveLock') drawDiveMarker(ctx, b.markerX, b.floorY, b.state === 'diveLock', t);
      b.warnings.forEach(function (w) { drawDebrisWarning(ctx, w, t, b.floorY); });
      ctx.save(); ctx.beginPath(); ctx.rect(b.x0 - 40, b.top, b.x1 - b.x0 + 80, b.floorY - b.top + 40); ctx.clip();
      drawBoss(ctx, b, t);
      ctx.restore();
    }
    G.enemies.forEach(function (e) { drawEnemy(ctx, e, t); });
    G.projectiles.forEach(function (pr) { drawProjectile(ctx, pr, t); });
    G.bolts.forEach(function (bl) { drawBolt(ctx, bl, t); });
    drawAfterimages(ctx, player);
    if (G.spikeResetT <= 0 || G.spikeResetT > 0.35) drawPlayer(ctx, player, t);
    drawSlash(ctx, player);
    drawHealRing(ctx, player);
    drawParticles(ctx, G.particles);
    ctx.restore();

    drawFog(ctx, cam, t, G.bossState === 'fight' ? 0.7 : 1);
    drawRain(ctx, cam, t, G.rain);
    var lights = gatherLights();
    drawLighting(ctx, lights.L, cam, darknessLevel(), lights.tint);

    // after lighting: signs, ambient motes
    ctx.save(); ctx.translate(-camX, -camY);
    var pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    G.signs.forEach(function (s) {
      var d = Math.abs(s.px - pcx), dy = Math.abs(s.py - 20 - pcy);
      var a = dy < 140 ? clamp01((170 - d) / 70) : 0;
      if (s.px > camX - 400 && s.px < camX + W + 400) drawSign(ctx, s, t, a);
    });
    drawAmbient(ctx, G.ambient, t);
    ctx.restore();

    if (G.lightning > 0) { ctx.fillStyle = 'rgba(180,200,255,' + (0.08 * G.lightning) + ')'; ctx.fillRect(0, 0, W, H); }
    drawVignette(ctx, G.hurtPulse, t, G.phaseRed * 0.5 + (player.hp === 1 && !player.dead ? 0.12 + 0.08 * Math.sin(t * 5) : 0));

    // HUD
    if (G.state !== 'victory') {
      drawHUD(ctx, player, t, G.hud);
      if (b) drawBossBar(ctx, b, t, G.bossBarA);
    }
    // area title card
    if (G.areaCardT >= 0) {
      var ac = G.areaCardT, aa = ac < 1 ? 0 : ac < 2.5 ? (ac - 1) / 1.5 : ac < 5.5 ? 1 : 1 - (ac - 5.5) / 2;
      drawBigText(ctx, 'The Unlit Hollow', 'GLOAMREACH', aa);
    }
    if (G.bossCardT > 0) {
      var bc = G.bossCardT, ba = bc > 2.6 ? (3.2 - bc) / 0.6 : bc < 0.8 ? bc / 0.8 : 1;
      drawBossTitleCard(ctx, ba);
    }
    if (G.toast.t > 0) drawToast(ctx, G.toast.text, Math.min(1, G.toast.t * 2));

    // fades
    if (G.deathT >= 0) drawFade(ctx, clamp01((G.deathT - 0.7) / 1.1));
    if (G.spikeResetT > 0) drawFade(ctx, clamp01((0.5 - G.spikeResetT) / 0.25));
    drawFade(ctx, G.fadeIn);
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,245,225,' + (G.flash * 0.7) + ')'; ctx.fillRect(0, 0, W, H); }

    if (G.state === 'paused') drawPauseScreen(ctx, t);
    if (G.state === 'victory') drawVictoryScreen(ctx, G.victoryT, { time: fmtTime(G.playTime), deaths: G.deaths, heart: G.heartTaken });
  }
  function drawAmbientScreen(cam, t) {
    ctx.save(); ctx.translate(-cam.x, -cam.y); drawAmbient(ctx, G.ambient, t); ctx.restore();
  }
  function fmtTime(s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ====================================================================== loop
  var last = 0, acc = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = (now - last) / 1000; last = now;
    if (dt > CFG.MAX_FRAME) dt = CFG.MAX_FRAME;
    if (dt < 0) dt = 0;
    acc += dt;
    var n = 0;
    while (acc >= DT && n < 20) { step(DT); acc -= DT; Input.endStep(); n++; }
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    var ww = window.innerWidth, wh = window.innerHeight;
    var scale = Math.min(ww / W, wh / H);
    var dpr = window.devicePixelRatio || 1;
    var rs = Math.max(0.5, Math.min(scale * dpr, 2));
    canvas.width = Math.round(W * rs); canvas.height = Math.round(H * rs);
    canvas.style.width = Math.floor(W * scale) + 'px'; canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.style.left = Math.floor((ww - W * scale) / 2) + 'px'; canvas.style.top = Math.floor((wh - H * scale) / 2) + 'px';
    G.rs = rs; artSetScale(rs);
  }

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    document.body.style.margin = '0'; document.body.style.background = '#000'; document.body.style.overflow = 'hidden';
    canvas.style.position = 'absolute';
    resize();
    window.addEventListener('resize', resize);
    parseLevel();
    G.cam.x = 0; G.cam.y = 1250;
    player = createPlayer(LEVEL.playerStart.x, LEVEL.playerStart.y, G.maxHp); G.player = player;
    resetBoss();
    Snd.music('explore');
    requestAnimationFrame(frame);
  }

  // hooks for automated in-page checks (not used by normal play)
  window.GAME = {
    G: G, Input: Input, step: step, render: render, newGame: newGame, respawn: respawn,
    player: function () { return player; }, hurtPlayer: hurtPlayer, debugWarp: debugWarp
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
