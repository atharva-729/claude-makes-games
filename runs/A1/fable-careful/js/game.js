// WICKFALL - input, world, collisions, camera, game states, main loop.
var Input = (function () {
  var MAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyX: 'attack', KeyJ: 'attack', KeyC: 'dash', KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyV: 'bolt', KeyL: 'bolt', KeyF: 'heal', Escape: 'pause', KeyP: 'pause', KeyR: 'restart', Enter: 'enter', NumpadEnter: 'enter',
    KeyM: 'mute', F1: 'f1', F2: 'f2'
  };
  var I = { down: {}, pressed: {}, codes: {} };
  function refresh() {
    var d = {};
    for (var c in I.codes) if (I.codes[c] && MAP[c]) d[MAP[c]] = true;
    I.down = d;
  }
  I.keydown = function (code) {
    var a = MAP[code]; if (!a) return false;
    if (!I.codes[code]) I.pressed[a] = true;
    I.codes[code] = true; refresh(); return true;
  };
  I.keyup = function (code) { if (I.codes[code]) { I.codes[code] = false; refresh(); } };
  I.clearPressed = function () { I.pressed = {}; };
  I.reset = function () { I.codes = {}; I.down = {}; I.pressed = {}; };
  window.addEventListener('keydown', function (e) {
    Sound.init();
    if (I.keydown(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { I.keyup(e.code); });
  window.addEventListener('blur', function () { I.reset(); });
  return I;
})();

var Game = (function () {
  var T = CFG.TILE, W = CFG.W, H = CFG.H, J = CFG.juice, PC = CFG.player;
  var canvas, ctx, renderScale = 1;
  var G = {
    state: 'title', time: 0, playTime: 0, deaths: 0,
    cam: { x: 0, y: 0, look: 0 }, shakeAmt: 0, hitstop: 0, slowmo: 1,
    player: null, enemies: [], projectiles: [], hazards: [], particles: [], ghosts: [],
    props: [], rests: [], arenas: [], hints: [], heart: null, bossGate: null, boss: null,
    flags: {}, god: false, bossActive: false, mood: 0, ambient: CFG.light.ambient,
    vignette: 0, fade: 0, flashWhite: 0, cardT: 99, bossCardT: 99, notice: '', noticeT: 0,
    deathT: 0, endT: -1, victoryT: 0, lightning: 0, lightningCd: 3, checkpoint: null
  };
  var grid = [], rows = LEVEL.map.length, cols = LEVEL.map[0].length;

  // ------------------------------------------------------------------ tiles & collision
  G.tile = function (c, r) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return '#';
    return grid[r][c];
  };
  function solidCh(ch) { return ch === '#' || ch === 'B' || ch === 'G'; }
  G.solidAtPx = function (x, y) { return solidCh(G.tile(Math.floor(x / T), Math.floor(y / T))); };
  G.spikeAtPx = function (x, y) { return G.tile(Math.floor(x / T), Math.floor(y / T)) === '^'; };
  G.overlap = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };

  G.moveBody = function (e, dx, dy) {
    var c, r, r0, r1, c0, c1;
    e.hitL = e.hitR = e.hitCeil = false;
    if (dx !== 0) {
      e.x += dx;
      r0 = Math.floor(e.y / T); r1 = Math.floor((e.y + e.h - 0.01) / T);
      c = dx > 0 ? Math.floor((e.x + e.w - 0.01) / T) : Math.floor(e.x / T);
      for (r = r0; r <= r1; r++) if (solidCh(G.tile(c, r))) {
        if (dx > 0) { e.x = c * T - e.w; e.hitR = true; } else { e.x = (c + 1) * T; e.hitL = true; }
        e.vx = 0; break;
      }
    }
    if (dy !== 0) {
      e.y += dy;
      c0 = Math.floor(e.x / T); c1 = Math.floor((e.x + e.w - 0.01) / T);
      r = dy > 0 ? Math.floor((e.y + e.h - 0.01) / T) : Math.floor(e.y / T);
      for (c = c0; c <= c1; c++) if (solidCh(G.tile(c, r))) {
        if (dy > 0) { e.y = r * T - e.h; } else { e.y = (r + 1) * T; e.hitCeil = true; }
        e.vy = 0; break;
      }
    }
    e.onGround = e.vy >= 0 && (G.solidAtPx(e.x + 0.5, e.y + e.h + 1) || G.solidAtPx(e.x + e.w - 0.5, e.y + e.h + 1));
  };

  G.isSafeGround = function (p) {
    var r = Math.floor((p.y + p.h + 2) / T);
    return G.tile(Math.floor((p.x + 1) / T), r) === '#' && G.tile(Math.floor((p.x + p.w - 1) / T), r) === '#' && p.invuln <= 0;
  };

  function setTiles(list, ch) { // list of [col, row0, row1]
    list.forEach(function (g) { for (var r = g[1]; r <= g[2]; r++) grid[r][g[0]] = ch; });
  }

  // ------------------------------------------------------------------ particles & juice
  G.addParticle = function (o) {
    if (G.particles.length > 700) return;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.max = o.life; o.type = o.type || 'dot'; o.size = o.size || 3; o.g = o.g || 0;
    G.particles.push(o);
  };
  G.burst = function (x, y, n, o) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, sp = (0.3 + Math.random() * 0.7) * (o.speed || 150);
      if (o.up) a = -Math.PI * (0.1 + Math.random() * 0.8);
      if (o.dirX) a = (o.dirX > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.5;
      G.addParticle({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life || 0.5) * (0.5 + Math.random() * 0.5), size: o.size || (o.type === 'spark' ? 2.6 : 3), color: o.color, type: o.type, g: o.g === undefined ? 300 : o.g });
    }
  };
  G.addGhost = function (p) { G.ghosts.push({ x: p.x + p.w / 2, y: p.y + p.h, dir: p.dir, life: 0.24, max: 0.24 }); };
  G.shake = function (n) { G.shakeAmt = Math.max(G.shakeAmt, n); };
  function say(str) { G.notice = str; G.noticeT = 3.4; }

  // ------------------------------------------------------------------ spawning
  G.spawnEnemy = function (type, tx, ty, opts) { var e = Enemies.create(type, tx, ty, opts); G.enemies.push(e); return e; };
  G.spawnProjectile = function (o) { o.tint = G.boss ? G.boss.phase : 0; G.projectiles.push(o); return o; };
  G.minionCount = function () { var n = 0; G.enemies.forEach(function (e) { if (e.minion && !e.dead) n++; }); return n; };

  // full new game
  G.initWorld = function () {
    grid = LEVEL.map.map(function (row) { return row.split(''); });
    G.flags = {}; G.props = []; G.rests = []; G.arenas = []; G.hints = []; G.heart = null;
    G.particles = []; G.ghosts = []; G.deaths = 0; G.playTime = 0; G.endT = -1; G.god = false;
    LEVEL.entities.forEach(function (d) {
      var px = d.x * T, py = d.y * T;
      if (d.type === 'lantern' || d.type === 'crystal' || d.type === 'firefly') G.props.push({ type: d.type, px: px, py: py, color: d.color, hang: d.hang, wall: d.wall, arena: d.arena });
      else if (d.type === 'rest') G.rests.push({ id: d.id, px: px, py: py, lit: false, inside: false, pulse: 0 });
      else if (d.type === 'hint') G.hints.push({ px: px, py: py, text: d.text });
      else if (d.type === 'arena') G.arenas.push({ def: d, active: false, cleared: false, wave: -1, live: [], delay: 0 });
      else if (d.type === 'heart') G.heart = { px: px, py: py, id: d.id };
      else if (d.type === 'bossgate') G.bossGate = d;
    });
    G.checkpoint = { x: LEVEL.playerStart.x * T, y: LEVEL.playerStart.y * T };
    G.player = Player.create(G.checkpoint.x, G.checkpoint.y);
    G.resetWorld();
    snapCamera();
  };

  // enemies, gates and the boss go back to their starting state (after a death)
  G.resetWorld = function () {
    G.enemies = []; G.projectiles = []; G.hazards = [];
    LEVEL.entities.forEach(function (d) {
      if (d.type === 'crawler' || d.type === 'grub' || d.type === 'flyer' || d.type === 'spitter') G.spawnEnemy(d.type, d.x, d.y);
      if (d.type === 'boss') G.boss = G.flags.bossDead ? null : Boss.create(d.x, d.y);
    });
    G.arenas.forEach(function (a) { setTiles(a.def.gates, '.'); a.active = false; a.wave = -1; a.live = []; });
    var bg = G.bossGate;
    setTiles(bg.cols.map(function (c) { return [c, bg.rows[0], bg.rows[1]]; }), '.');
    G.bossActive = false; G.mood = 0; G.slowmo = 1; G.hitstop = 0; G.lightning = 0;
    if (G.state !== 'title') Sound.setMusic('ambient');
  };

  function respawn() {
    var p = G.player, keepMax = p.maxHealth;
    G.player = Player.create(G.checkpoint.x, G.checkpoint.y);
    G.player.maxHealth = keepMax; G.player.health = keepMax;
    G.rests.forEach(function (r) { r.inside = Math.abs(r.px - G.checkpoint.x) < 5; });
    G.resetWorld();
    G.state = 'play'; G.fade = 1; G.vignette = 0;
    snapCamera();
  }

  // ------------------------------------------------------------------ combat
  function hitFx(x, y, col, big) {
    G.burst(x, y, big ? 14 : 9, { color: col || CFG.colors.white, speed: 320, life: 0.35, type: 'spark', g: 0 });
    G.addParticle({ x: x, y: y, life: 0.2, size: 6, grow: 200, color: CFG.colors.white, type: 'ring' });
  }

  G.resolveSlash = function (p, s) {
    var hb = Player.slashBox(p, s), hit = false, pogo = false, i, e, c, r;
    var dx = s.type === 'fwd' ? s.dir : 0, dy = s.type === 'up' ? -1 : (s.type === 'down' ? 1 : 0);
    function mid(o) { return { x: clampN(o.x + o.w / 2, hb.x, hb.x + hb.w), y: clampN(o.y + o.h / 2, hb.y, hb.y + hb.h) }; }
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead || e.spawnT > 0 || s.hit.indexOf(e) >= 0 || !G.overlap(hb, e)) continue;
      s.hit.push(e); hit = true;
      Enemies.hurt(e, PC.slashDamage, dx || (e.x + e.w / 2 > p.x + p.w / 2 ? 0.4 : -0.4), dy * 0.6);
      p.energy = Math.min(PC.maxEnergy, p.energy + PC.energyPerHit);
      var m = mid(e); hitFx(m.x, m.y, CFG.colors.cyan);
    }
    var b = G.boss;
    if (b && s.hit.indexOf(b) < 0 && Boss.hittable(b) && G.overlap(hb, b)) {
      s.hit.push(b);
      if (Boss.hurt(b, PC.slashDamage)) {
        hit = true; p.energy = Math.min(PC.maxEnergy, p.energy + PC.energyPerHit);
        var mb = mid(b); hitFx(mb.x, mb.y, CFG.colors.phase[b.phase], true);
      }
    }
    for (i = G.projectiles.length - 1; i >= 0; i--) {
      var pr = G.projectiles[i];
      if (pr.friendly || !pr.pogo) continue;
      if (G.overlap(hb, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) {
        G.projectiles.splice(i, 1); hit = true;
        hitFx(pr.x, pr.y, pr.kind === 'orb' ? CFG.colors.violet : CFG.colors.green);
        Sound.play('clink');
      }
    }
    // tiles: breakable walls, and spikes for the pogo
    for (r = Math.floor(hb.y / T); r <= Math.floor((hb.y + hb.h) / T); r++) for (c = Math.floor(hb.x / T); c <= Math.floor((hb.x + hb.w) / T); c++) {
      var ch = G.tile(c, r);
      if (ch === 'B' && c >= 0 && c < cols) breakWall(c, r);
      if (ch === '^' && s.type === 'down' && !s.spike && hb.y + hb.h > r * T + 14) {
        s.spike = true; pogo = true;
        G.burst(p.x + p.w / 2, r * T + 18, 10, { color: CFG.colors.white, speed: 260, life: 0.3, type: 'spark', up: true });
        Sound.play('clink'); G.shake(3);
      }
    }
    if (hit) {
      G.hitstop = Math.max(G.hitstop, J.hitstopHit); G.shake(J.shakeHit); Sound.play('hit');
    }
    if ((hit || pogo) && !s.hitAny) {
      s.hitAny = true;
      if (s.type === 'fwd') p.vx = -s.dir * PC.slashRecoil;
      else if (s.type === 'down') { p.vy = -PC.pogoVel; p.airDash = true; p.jumping = false; }
      else if (p.vy < 0) p.vy *= 0.5;
    }
  };
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function breakWall(c, r) {
    // the whole cracked section crumbles at once
    for (var rr = 0; rr < rows; rr++) for (var cc = Math.max(0, c - 1); cc <= Math.min(cols - 1, c + 1); cc++) if (grid[rr][cc] === 'B') {
      grid[rr][cc] = '.';
      G.burst(cc * T + T / 2, rr * T + T / 2, 14, { color: [70, 100, 130], speed: 260, life: 0.8, type: 'shard', g: 900, size: 6 });
      G.burst(cc * T + T / 2, rr * T + T / 2, 8, { color: CFG.colors.cyan, speed: 200, life: 0.5, type: 'spark' });
    }
    Sound.play('breakWall'); G.shake(10); G.hitstop = 0.07;
  }

  G.hurtPlayer = function (dmg, srcX) {
    var p = G.player;
    if (p.invuln > 0 || p.dead || G.god || G.state !== 'play') return false;
    p.health -= dmg; p.invuln = PC.invuln; p.hurtLock = PC.hurtLock;
    p.dashT = 0; p.healing = false; p.healT = 0; p.slash = null; p.jumping = false;
    p.vx = (p.x + p.w / 2 < srcX ? -1 : 1) * PC.knockX; p.vy = -PC.knockY;
    G.hitstop = Math.max(G.hitstop, J.hitstopHurt); G.shake(J.shakeHurt); G.vignette = 1;
    Sound.play('hurt');
    G.burst(p.x + p.w / 2, p.y + p.h / 2, 14, { color: CFG.colors.red, speed: 260, life: 0.5, type: 'spark' });
    if (p.health <= 0) killPlayer();
    return true;
  };

  function killPlayer() {
    var p = G.player;
    p.health = 0; p.dead = true; G.state = 'dying'; G.deathT = 0; G.deaths++;
    G.burst(p.x + p.w / 2, p.y + p.h / 2, 40, { color: CFG.colors.gold, speed: 380, life: 1.1, type: 'spark', g: 200 });
    G.burst(p.x + p.w / 2, p.y + p.h / 2, 16, { color: [42, 86, 110], speed: 240, life: 1.0, type: 'shard', g: 700, size: 6 });
    G.addParticle({ x: p.x + p.w / 2, y: p.y + p.h / 2, life: 0.6, size: 10, grow: 300, color: CFG.colors.gold, type: 'ring' });
    G.hitstop = 0.18; G.shake(16); G.slowmo = 1;
    Sound.play('death'); Sound.setMusic('none');
  }

  function checkSpikes(p) {
    for (var r = Math.floor(p.y / T); r <= Math.floor((p.y + p.h) / T); r++) for (var c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w) / T); c++) {
      if (G.tile(c, r) !== '^') continue;
      if (G.overlap(p, { x: c * T + 7, y: r * T + 20, w: T - 14, h: T - 20 })) {
        if (G.god) { p.vy = -PC.pogoVel; return; }
        if (G.hurtPlayer(1, p.x + p.w / 2) && !p.dead) { // back to the last safe footing
          p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0; p.hurtLock = 0.35; G.fade = 0.85;
        } else if (!p.dead && p.invuln > 0) { p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0; }
        return;
      }
    }
  }

  // ------------------------------------------------------------------ boss callbacks
  G.onBossRoar = function () {
    Sound.play('roar'); G.shake(J.shakeBig); Sound.setMusic('boss'); G.bossCardT = 0;
  };
  G.onBossPhase = function (b) {
    var p = G.player;
    G.projectiles = G.projectiles.filter(function (q) { return q.friendly; }); G.hazards = [];
    G.mood = b.phase; G.shake(J.shakeBig + 6); G.hitstop = 0.14; G.flashWhite = 0.5;
    Sound.play('roar'); if (b.phase === 2) { Sound.setMusic('boss3'); Sound.play('thunder'); G.lightning = 1; }
    say(b.phase === 1 ? 'The lanterns gutter...' : 'The sky breaks open.');
    var dx = (p.x + p.w / 2) - (b.x + b.w / 2);
    if (Math.abs(dx) < 300 && !p.dead) { p.vx = (dx > 0 ? 1 : -1) * 560; p.vy = -260; p.hurtLock = 0.22; p.dashT = 0; }
    G.burst(b.x + b.w / 2, b.y + b.h / 2, 50, { color: CFG.colors.phase[b.phase], speed: 520, life: 0.9, type: 'spark', g: 0 });
  };
  G.onBossDying = function (b) {
    G.slowmo = 0.22; G.hitstop = 0.2; G.shake(16); G.projectiles = []; G.hazards = [];
    G.enemies.forEach(function (e) { if (e.minion && !e.dead) Enemies.kill(e); });
    Sound.setMusic('none'); Sound.play('bossDie');
  };
  G.onBossDead = function (b) {
    var x = b.x + b.w / 2, y = b.y + b.h / 2;
    G.slowmo = 1; G.flags.bossDead = true; G.endT = 0; G.flashWhite = 1; G.shake(30); G.mood = 0;
    Sound.play('burst');
    G.burst(x, y, 130, { color: CFG.colors.phase[2], speed: 700, life: 1.6, type: 'spark', g: 150 });
    G.burst(x, y, 60, { color: CFG.colors.gold, speed: 420, life: 1.8, type: 'dot', g: -60 });
    G.burst(x, y, 30, { color: [35, 26, 69], speed: 420, life: 1.5, type: 'shard', g: 800, size: 9 });
    for (var i = 0; i < 3; i++) G.addParticle({ x: x, y: y, life: 0.7 + i * 0.25, size: 10, grow: 520 - i * 120, color: CFG.colors.white, type: 'ring' });
    var bg = G.bossGate; setTiles(bg.cols.map(function (c) { return [c, bg.rows[0], bg.rows[1]]; }), '.');
    G.player.invuln = 5;
  };

  // ------------------------------------------------------------------ per-step world updates
  function updateEnemies(dt) {
    var p = G.player;
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (e.dead) { G.enemies.splice(i, 1); continue; }
      if (Math.abs(e.x - p.x) > 1100 && !e.minion) continue; // asleep while far away
      Enemies.update(e, dt);
      if (e.type !== 'flyer' && e.spawnT <= 0) { // spikes kill grounded things that get knocked in
        if (G.spikeAtPx(e.x + e.w / 2, e.y + e.h - 4) && e.type !== 'spitter') { Enemies.kill(e); continue; }
      }
      if (!e.harmless && e.spawnT <= 0 && G.overlap(p, e)) G.hurtPlayer(1, e.x + e.w / 2);
    }
  }

  function updateProjectiles(dt) {
    var p = G.player, b = G.boss;
    for (var i = G.projectiles.length - 1; i >= 0; i--) {
      var q = G.projectiles[i], dead = false, j;
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      var box = { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 };
      if (q.life <= 0) dead = true;
      else if (G.solidAtPx(q.x, q.y)) {
        dead = true;
        G.burst(q.x, q.y, 7, { color: q.friendly ? CFG.colors.cyan : (q.kind === 'orb' ? CFG.colors.violet : CFG.colors.green), speed: 180, life: 0.35, type: 'spark' });
      } else if (q.friendly) {
        for (j = 0; j < G.enemies.length && !dead; j++) {
          var e = G.enemies[j];
          if (!e.dead && e.spawnT <= 0 && G.overlap(box, e)) { Enemies.hurt(e, q.damage, q.vx > 0 ? 1 : -1, 0); dead = true; }
        }
        if (!dead && b && Boss.hittable(b) && G.overlap(box, b)) { Boss.hurt(b, q.damage); dead = true; }
        if (dead) { hitFx(q.x, q.y, CFG.colors.cyan, true); G.hitstop = Math.max(G.hitstop, J.hitstopHit); G.shake(J.shakeHit); Sound.play('hit'); }
      } else if (G.overlap(box, p)) {
        if (G.hurtPlayer(q.damage, q.x)) dead = true;
      }
      if (!dead && Math.random() < 0.5) G.addParticle({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.3, size: q.r * 0.5, color: q.friendly ? CFG.colors.cyan : (q.kind === 'orb' ? CFG.colors.phase[Math.max(1, q.tint)] : CFG.colors.green), type: 'dot' });
      if (dead) G.projectiles.splice(i, 1);
    }
  }

  function updateArenas(dt) {
    var p = G.player, px = p.x + p.w / 2;
    G.arenas.forEach(function (a) {
      var d = a.def;
      if (!a.cleared && !a.active && px > (d.x0 + 1.3) * T && px < (d.x1 - 0.3) * T && p.y > d.gates[0][1] * T - 200) {
        a.active = true; a.wave = -1; a.delay = 0.5; a.live = [];
        setTiles(d.gates, 'G'); Sound.play('gate'); G.shake(8); say('The thorns close behind you.');
      }
      if (!a.active) return;
      a.live = a.live.filter(function (e) { return !e.dead; });
      if (a.live.length === 0) {
        a.delay -= dt;
        if (a.delay <= 0) {
          if (a.wave + 1 < d.waves.length) {
            a.wave++; a.delay = 0.9;
            d.waves[a.wave].forEach(function (w) { a.live.push(G.spawnEnemy(w.type, w.x, w.y, { spawn: true })); });
            Sound.play('spawn');
          } else {
            a.active = false; a.cleared = true; setTiles(d.gates, '.'); Sound.play('gate'); G.shake(6); say('The way opens.');
            d.gates.forEach(function (g) { G.burst(g[0] * T + T / 2, (g[1] + 2) * T, 20, { color: CFG.colors.violet, speed: 200, life: 0.7, type: 'spark' }); });
          }
        }
      }
    });
  }

  function updateTriggers(dt) {
    var p = G.player, px = p.x + p.w / 2, feet = p.y + p.h;
    // rest points
    G.rests.forEach(function (r) {
      r.pulse = Math.max(0, r.pulse - dt * 0.8);
      var inside = Math.abs(px - r.px) < 42 && Math.abs(feet - r.py) < 50 && p.onGround;
      if (inside && !r.inside) {
        r.lit = true; r.pulse = 1; p.health = p.maxHealth;
        G.checkpoint = { x: r.px, y: r.py };
        Sound.play('rest'); say('Rested. Your flame is kept here.');
        G.burst(r.px, r.py - 70, 30, { color: CFG.colors.gold, speed: 180, life: 1.2, type: 'dot', g: -80 });
      }
      if (inside || Math.abs(px - r.px) > 90) r.inside = inside;
    });
    // secret upgrade
    var h = G.heart;
    if (h && !G.flags.heart && Math.abs(px - h.px) < 26 && Math.abs(p.y + p.h / 2 - h.py) < 40) {
      G.flags.heart = true; p.maxHealth++; p.health = p.maxHealth;
      Sound.play('pickup'); say('Your flame grows.  +1 health'); G.hitstop = 0.1;
      G.burst(h.px, h.py, 40, { color: CFG.colors.gold, speed: 300, life: 1.0, type: 'spark', g: 0 });
      G.addParticle({ x: h.px, y: h.py, life: 0.6, size: 10, grow: 300, color: CFG.colors.gold, type: 'ring' });
    }
    // boss gate
    var b = G.boss, bg = G.bossGate;
    if (b && b.state === 'dormant' && px > bg.trigger * T && !p.dead) {
      setTiles(bg.cols.map(function (c) { return [c, bg.rows[0], bg.rows[1]]; }), 'G');
      G.bossActive = true; Boss.wake(b); Sound.play('gate'); G.shake(10); Sound.setMusic('none');
    }
    // phase three storm
    if (G.mood >= 2) {
      G.lightningCd -= dt;
      if (G.lightningCd <= 0) { G.lightningCd = 3 + Math.random() * 5; G.lightning = 1; Sound.play('thunder'); }
    }
  }

  function updateParticles(dt) {
    var i, q;
    for (i = G.particles.length - 1; i >= 0; i--) {
      q = G.particles[i]; q.life -= dt;
      if (q.life <= 0) { G.particles.splice(i, 1); continue; }
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.97; if (q.g <= 0) q.vy *= 0.97;
      if (q.grow) q.size += q.grow * dt;
    }
    for (i = G.ghosts.length - 1; i >= 0; i--) { G.ghosts[i].life -= dt; if (G.ghosts[i].life <= 0) G.ghosts.splice(i, 1); }
  }

  // ------------------------------------------------------------------ camera
  function camTarget() {
    var p = G.player, c = G.cam;
    var tx = p.x + p.w / 2 + c.look - W / 2, ty = p.y + p.h / 2 - H * 0.56;
    if (G.bossActive) { var A = Boss.bounds(); tx = (A.x0 + A.x1) / 2 - W / 2; ty = A.floor + 40 - H; }
    return { x: clampN(tx, 0, cols * T - W), y: clampN(ty, 0, rows * T - H) };
  }
  function snapCamera() { G.cam.look = 0; var t = camTarget(); G.cam.x = t.x; G.cam.y = t.y; }
  function updateCamera() {
    var p = G.player, c = G.cam, K = CFG.camera;
    if (!p.dead) c.look += (p.dir * K.lookAhead - c.look) * K.lookLerp;
    var t = camTarget();
    c.x += (t.x - c.x) * K.lerp; c.y += (t.y - c.y) * (K.lerp * 1.2);
  }

  // ------------------------------------------------------------------ states
  function startGame() {
    G.initWorld(); G.state = 'play'; G.fade = 1; G.cardT = 0; G.bossCardT = 99; G.noticeT = 0;
    Sound.setMusic('ambient'); Sound.play('ui');
  }

  function teleportToBoss() {
    var p = G.player, t = LEVEL.bossGateTeleport;
    if (!G.boss || G.bossActive) return;
    p.x = t.x * T - p.w / 2; p.y = t.y * T - p.h; p.vx = p.vy = 0; p.health = p.maxHealth; p.energy = PC.maxEnergy;
    snapCamera();
  }

  G.step = function (dt) {
    var I = Input, p;
    if (I.pressed.mute) Sound.toggleMute();
    if (G.state === 'title') {
      G.time += dt; Sound.setMusic('ambient');
      if (I.pressed.enter) startGame();
      I.clearPressed(); return;
    }
    if (G.state === 'pause') {
      if (I.pressed.pause || I.pressed.enter) { G.state = 'play'; Sound.play('ui'); }
      I.clearPressed(); return;
    }
    G.time += dt;
    G.vignette = Math.max(0, G.vignette - dt * 1.8); G.fade = Math.max(0, G.fade - dt * 1.3);
    G.flashWhite = Math.max(0, G.flashWhite - dt * 1.6); G.lightning = Math.max(0, G.lightning - dt * 2.5);
    G.shakeAmt = G.shakeAmt < 0.3 ? 0 : G.shakeAmt * 0.88;
    G.cardT += dt; G.bossCardT += dt; G.noticeT = Math.max(0, G.noticeT - dt);
    var amb = CFG.light.ambient + (G.mood === 1 ? 0.06 : (G.mood === 2 ? 0.1 : 0));
    G.ambient += (amb - G.ambient) * 0.03;

    if (G.state === 'victory') {
      G.victoryT += dt; updateParticles(dt);
      if (I.pressed.enter && G.victoryT > 1.2) { G.state = 'title'; G.initWorld(); Sound.setMusic('ambient'); }
      I.clearPressed(); return;
    }
    if (G.state === 'play') {
      if (I.pressed.pause) { G.state = 'pause'; Sound.play('ui'); I.clearPressed(); return; }
      if (I.pressed.f1) { G.god = !G.god; I.pressed.f1 = false; }
      if (I.pressed.f2) { teleportToBoss(); I.pressed.f2 = false; }
      if (I.pressed.restart && G.endT < 0) { I.clearPressed(); respawn(); return; }
    }
    if (G.hitstop > 0) { G.hitstop -= dt; return; } // buffered presses survive the freeze

    var wdt = dt * G.slowmo;
    p = G.player;
    if (G.state === 'dying') {
      G.deathT += dt; updateParticles(dt); G.fade = Math.min(1, Math.max(0, (G.deathT - 0.6) / 0.8));
      if (G.deathT > 1.7) respawn();
      I.clearPressed(); return;
    }
    if (G.endT < 0) G.playTime += dt;
    Player.update(p, wdt);
    if (!p.dead) checkSpikes(p);
    updateEnemies(wdt);
    if (G.boss) { Boss.update(G.boss, wdt); Boss.updateHazards(wdt); if (G.boss.dead) { G.boss = null; G.bossActive = false; } }
    updateProjectiles(wdt);
    updateArenas(wdt);
    updateTriggers(wdt);
    updateCamera();
    updateParticles(wdt);
    if (G.endT >= 0) {
      G.endT += dt;
      if (G.endT > 3.4 && G.state === 'play') { G.state = 'victory'; G.victoryT = 0; Sound.play('victory'); }
    }
    I.clearPressed();
  };

  // ------------------------------------------------------------------ render
  function buildLights(t) {
    var L = [], p = G.player, LC = CFG.light, C = CFG.colors, i;
    if (!p.dead) L.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, r: LC.player, color: C.cyan, g: 0.07 });
    G.props.forEach(function (d) {
      if (Math.abs(d.px - G.cam.x - W / 2) > W) return;
      if (d.type === 'lantern') {
        var pw = d.arena ? (G.mood === 0 ? 1 : (G.mood === 1 ? 0.55 : 0.4)) : 1, fl = 1 + Math.sin(t * 9 + d.px) * 0.03;
        L.push({ x: d.px + 18, y: d.py - 74, r: LC.lantern * fl * (0.6 + 0.4 * pw), color: d.arena ? C.phase[G.mood] : C.gold, g: 0.2 * pw, a: 0.5 + 0.5 * pw });
      } else if (d.type === 'crystal') L.push({ x: d.px, y: d.py + (d.hang ? 14 : -14), r: LC.crystal, color: C[d.color] || C.cyan, g: 0.18, a: 0.8 });
      else if (d.type === 'firefly') L.push({ x: d.px + Math.sin(t * 1.3) * 14, y: d.py + Math.sin(t * 2.1) * 9, r: 46, color: C.gold, g: 0.5, a: 0.6 });
    });
    G.rests.forEach(function (r) { L.push({ x: r.px, y: r.py - 60, r: r.lit ? LC.rest + r.pulse * 120 : 110, color: r.lit ? C.gold : C.cyan, g: r.lit ? 0.22 : 0.12, a: r.lit ? 1 : 0.6 }); });
    if (G.heart && !G.flags.heart) L.push({ x: G.heart.px, y: G.heart.py, r: 150, color: C.gold, g: 0.25 });
    G.projectiles.forEach(function (q) { L.push({ x: q.x, y: q.y, r: q.friendly ? 110 : 64, a: 0.8 }); });
    G.enemies.forEach(function (e) { if (Math.abs(e.x - p.x) < W) L.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 62, a: (e.state === 'tell' || e.state === 'lunge' || e.state === 'swoop') ? 0.95 : 0.5 }); });
    var b = G.boss;
    if (b && !b.hidden) {
      var dorm = b.state === 'dormant';
      L.push({ x: b.x + b.w / 2 + b.dir * 30, y: b.y + b.h / 2 - 30, r: dorm ? 120 : 250, color: C.phase[b.phase], g: dorm ? 0.03 : 0.12, a: dorm ? 0.3 : 0.9 });
    }
    G.hazards.forEach(function (h) { if (h.kind === 'wave') L.push({ x: h.x, y: h.y - 14, r: 70, a: 0.8 }); else if (h.falling) L.push({ x: h.x, y: h.y + h.h, r: 60, a: 0.7 }); });
    if (p.slash) L.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, r: 130, a: 0.5 });
    return L;
  }

  G.render = function () {
    var t = G.time, cam = G.cam, p = G.player, A = Assets, i;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    var sx = (Math.random() - 0.5) * 2 * G.shakeAmt, sy = (Math.random() - 0.5) * 2 * G.shakeAmt;
    if (G.state === 'pause') sx = sy = 0;
    var vc = { x: Math.round(cam.x + sx), y: Math.round(cam.y + sy) };
    A.drawBackground(ctx, vc, t, G.mood);
    if (G.lightning > 0.6) A.drawFade(ctx, (G.lightning - 0.6) * 1.2, '200,210,255');

    ctx.save(); ctx.translate(-vc.x, -vc.y);
    // props behind the terrain
    G.props.forEach(function (d) {
      if (d.px < vc.x - 120 || d.px > vc.x + W + 120) return;
      if (d.type === 'lantern') A.drawLantern(ctx, d.px, d.py, t, d.arena ? CFG.colors.phase[G.mood] : CFG.colors.gold, d.arena ? (G.mood === 0 ? 1 : 0.55) : 1);
      else if (d.type === 'crystal') A.drawCrystal(ctx, d, t);
    });
    G.rests.forEach(function (r) { A.drawRest(ctx, r, t); });
    if (G.heart && !G.flags.heart) A.drawHeart(ctx, G.heart.px, G.heart.py, t);
    A.drawTiles(ctx, G.tile, Math.floor(vc.x / T), Math.floor((vc.x + W) / T), Math.floor(vc.y / T), Math.floor((vc.y + H) / T), t);
    if (G.boss) { A.drawDiveMarker(ctx, G.boss, t); A.drawBoss(ctx, G.boss, t); }
    for (i = 0; i < G.enemies.length; i++) if (!G.enemies[i].dead) A.drawEnemy(ctx, G.enemies[i], t);
    for (i = 0; i < G.hazards.length; i++) A.drawHazard(ctx, G.hazards[i], t, G.boss ? G.boss.phase : 0);
    for (i = 0; i < G.ghosts.length; i++) A.drawGhost(ctx, G.ghosts[i]);
    A.drawPlayer(ctx, p, t);
    if (p.slash && !p.dead) A.drawSlash(ctx, p, p.slash);
    for (i = 0; i < G.projectiles.length; i++) A.drawProjectile(ctx, G.projectiles[i], t);
    ctx.restore();

    // darkness with holes punched by every light
    var amb = G.ambient * (1 - G.lightning * 0.6);
    A.drawLighting(ctx, buildLights(t), vc, amb, G.mood >= 2 ? '10,2,12' : (G.mood === 1 ? '6,3,18' : '2,5,14'));

    ctx.save(); ctx.translate(-vc.x, -vc.y);
    A.drawParticles(ctx, G.particles);
    if (G.state !== 'title') G.hints.forEach(function (h) {
      var d = Math.abs(p.x - h.px), a = clampN((G.cardT - 5.5) / 1.5, 0, 1) * clampN(1 - (d - 240) / 200, 0, 1) * clampN(1 - (Math.abs(p.y - h.py) - 200) / 150, 0, 1);
      if (a > 0) A.drawHint(ctx, h.px, h.py, h.text, a * 0.9);
    });
    ctx.restore();

    A.drawAmbient(ctx, vc, t, G.mood);
    A.drawFog(ctx, vc, t);
    if (G.mood >= 2) A.drawRain(ctx, t);
    A.drawVignette(ctx, G.vignette);
    if (G.flashWhite > 0) A.drawFade(ctx, G.flashWhite * 0.8, '255,255,255');

    if (G.state === 'title') { A.drawTitle(ctx, t); return; }
    A.drawHUD(ctx, G, t);
    var b = G.boss;
    if (b && G.bossActive && b.state !== 'intro' || (b && b.state === 'intro' && b.roared)) A.drawBossBar(ctx, b, t, clampN(G.bossCardT / 1.2, 0, 1));
    var ct = G.cardT;
    if (ct < 6.5) A.drawCard(ctx, CFG.AREA_NAME.toUpperCase(), 'where no lamp has burned in an age', clampN((ct - 1) / 1.5, 0, 1) * clampN((6.5 - ct) / 1.5, 0, 1), CFG.colors.cyan);
    ct = G.bossCardT;
    if (ct < 3.6) A.drawCard(ctx, CFG.boss.name, CFG.boss.title, clampN(ct / 0.5, 0, 1) * clampN((3.6 - ct) / 0.8, 0, 1), CFG.colors.violet);
    A.drawNotice(ctx, G.notice, clampN(G.noticeT / 0.6, 0, 1) * clampN((3.4 - G.noticeT) / 0.3, 0, 1));
    A.drawFade(ctx, G.fade);
    if (G.state === 'pause') A.drawPause(ctx, t);
    if (G.state === 'victory') A.drawVictory(ctx, G, t, G.victoryT / 1.5);
  };

  // ------------------------------------------------------------------ boot
  function resize() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(H * s) + 'px';
    var bw = Math.max(W, Math.min(2560, Math.round(W * s * dpr)));
    canvas.width = bw; canvas.height = Math.round(bw * H / W);
    renderScale = bw / W;
  }

  G.boot = function () {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
    Assets.init(); resize(); window.addEventListener('resize', resize);
    G.initWorld();
    var last = performance.now(), acc = 0;
    function frame(now) {
      var dt = Math.min(CFG.MAX_FRAME, Math.max(0, (now - last) / 1000)); last = now; acc += dt;
      while (acc >= CFG.STEP) { G.step(CFG.STEP); acc -= CFG.STEP; }
      Sound.update();
      G.render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  return G;
})();

window.addEventListener('load', function () { Game.boot(); });
