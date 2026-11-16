// WICKFALL - boss logic: Vesperhorn, Warden of the Unlit Hour.
var Boss = (function () {
  var B = CFG.boss, T = CFG.TILE;
  var arena = null;

  function bounds() {
    if (!arena) {
      var a = LEVEL.bossArena;
      arena = { x0: a.c0 * T, x1: (a.c1 + 1) * T, top: a.r0 * T, floor: (a.r1 + 1) * T };
    }
    return arena;
  }

  function create(tx, ty) {
    return {
      x: tx * T - B.w / 2, y: ty * T - B.h, w: B.w, h: B.h, vx: 0, vy: 0, dir: -1,
      hp: B.hp, maxHp: B.hp, phase: 0, state: 'dormant', attack: null, sub: '', t: 0, tellDur: 1,
      flash: 0, hits: 0, lastAttack: null, sinceSummon: 9, force: [],
      pendingPhase: false, pendingStagger: false, onGround: true, animT: 0,
      dead: false, hidden: false, free: false, markerX: 0, dmg: 1, shots: 0, shotT: 0, count: 0, roared: false
    };
  }

  function cx(o) { return o.x + o.w / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function setHeight(b, h) { b.y += b.h - h; b.h = h; }

  function wake(b) { b.state = 'intro'; b.t = B.introTime; b.roared = false; }

  function enterIdle(b) {
    setHeight(b, B.h); b.dmg = 1; b.vx = 0; b.attack = null; b.sub = '';
    if (b.pendingPhase) { startRoar(b); return; }
    if (b.pendingStagger) { startStagger(b); return; }
    b.state = 'idle'; b.t = B.idle[b.phase];
  }

  function startStagger(b) {
    setHeight(b, B.h);
    b.pendingStagger = false; b.hits = 0; b.state = 'stagger'; b.t = B.staggerTime; b.vx = 0; b.attack = null;
    Sound.play('stagger');
    Game.shake(8);
    Game.burst(cx(b), b.y + 20, 24, { color: CFG.colors.white, speed: 300, life: 0.6, type: 'spark' });
  }

  function startRoar(b) {
    setHeight(b, B.h);
    b.pendingPhase = false; b.pendingStagger = false; b.hits = 0;
    b.phase = Math.min(2, b.phase + 1);
    b.state = 'roar'; b.t = B.roarTime; b.vx = 0; b.attack = null;
    b.force = b.phase === 1 ? ['dive', 'summon'] : ['shards', 'dive'];
    Game.onBossPhase(b);
  }

  function setRecover(b, time) { b.state = 'recover'; b.t = time; b.vx = 0; }

  function choose(b) {
    var p = Game.player, ph = b.phase, a;
    var pool = ['charge', 'leap', 'volley'];
    if (ph >= 1) pool.push('dive');
    if (ph >= 1 && b.sinceSummon >= 4 && Game.minionCount() === 0) pool.push('summon');
    if (ph >= 2) { pool.push('shards'); pool.push('dive'); }
    if (b.force.length) a = b.force.shift();
    else {
      pool = pool.filter(function (n) { return n !== b.lastAttack; });
      a = pool[Math.floor(Math.random() * pool.length)];
    }
    b.attack = a; b.lastAttack = a; b.sinceSummon = a === 'summon' ? 0 : b.sinceSummon + 1;
    b.dir = cx(p) > cx(b) ? 1 : -1;
    b.state = 'tell'; b.sub = '';
    b.tellDur = Math.max(0.4, B[a].tell * B.tellMul[ph]); b.t = b.tellDur;
    Sound.play({ charge: 'tellCharge', leap: 'tellLeap', volley: 'tellVolley', dive: 'tellDive', summon: 'tellSummon', shards: 'tellShards' }[a]);
  }

  function spawnWaves(b, speedMul) {
    var L = B.leap, A = bounds();
    [-1, 1].forEach(function (d) {
      Game.hazards.push({ kind: 'wave', x: cx(b) + d * 40, y: A.floor, dir: d, speed: L.waveSpeed * speedMul, life: L.waveLife, max: L.waveLife, w: L.waveW, h: L.waveH, damage: 1 });
    });
  }

  function landFx(b, big) {
    Sound.play('slam'); Game.shake(big ? CFG.juice.shakeBig : 12);
    Game.burst(cx(b), b.y + b.h, big ? 30 : 18, { color: [150, 170, 200], speed: 320, life: 0.6, type: 'dot', up: true });
    Game.burst(cx(b), b.y + b.h, 12, { color: CFG.colors.phase[b.phase], speed: 380, life: 0.5, type: 'spark', up: true });
  }

  function leapAt(b) {
    var p = Game.player, A = bounds(), L = B.leap;
    var F = L.flight / B.speedMul[b.phase];
    var tx = clamp(cx(p), A.x0 + 75, A.x1 - 75);
    b.dir = tx > cx(b) ? 1 : -1;
    b.vx = (tx - cx(b)) / F; b.vy = -L.gravity * F / 2; b.sub = 'air'; b.t = 0; b.onGround = false;
  }

  function startAttack(b) {
    var p = Game.player, ph = b.phase, mul = B.speedMul[ph], A = bounds();
    b.state = 'attack';
    switch (b.attack) {
      case 'charge':
        setHeight(b, B.chargeH); b.vx = b.dir * B.charge.speed * mul; b.count = ph >= 2 ? 2 : 1; b.sub = 'run';
        break;
      case 'leap':
        b.count = ph >= 2 ? 2 : 1; leapAt(b);
        break;
      case 'volley':
        b.shots = B.volley.count[ph]; b.count = b.shots; b.shotT = 0;
        break;
      case 'dive':
        b.sub = 'rise'; b.free = true; b.vy = -B.dive.riseSpeed; b.vx = 0;
        Game.burst(cx(b), b.y + b.h, 16, { color: [150, 170, 200], speed: 260, life: 0.5, type: 'dot', up: true });
        break;
      case 'summon':
        for (var i = 0; i < B.summon.count; i++) {
          var sx = i === 0 ? A.x0 + 130 : A.x1 - 130;
          Game.spawnEnemy('flyer', sx / T, (A.top + 150) / T, { spawn: true, minion: true });
        }
        Sound.play('spawn');
        setRecover(b, B.summon.recover);
        break;
      case 'shards':
        b.count = B.shards.salvos; b.t = 0; b.sub = 'rain';
        break;
    }
  }

  function shardSalvo(b) {
    var S = B.shards, A = bounds(), p = Game.player;
    var cw = (A.x1 - A.x0) / S.cols, pc = Math.floor((cx(p) - A.x0) / cw);
    // two safe windows of three columns: one a short run from the player, one elsewhere
    var side = Math.random() < 0.5 ? -1 : 1;
    var w1 = pc + side * (2 + Math.floor(Math.random() * 3));
    if (w1 < 1 || w1 > S.cols - 2) w1 = pc - side * (2 + Math.floor(Math.random() * 3));
    w1 = clamp(w1, 1, S.cols - 2);
    var w2 = (w1 + 7 + Math.floor(Math.random() * 6)) % S.cols; w2 = clamp(w2, 1, S.cols - 2);
    for (var c = 0; c < S.cols; c++) {
      if (Math.abs(c - w1) <= 1 || Math.abs(c - w2) <= 1) continue;
      Game.hazards.push({ kind: 'shard', x: A.x0 + (c + 0.5) * cw, y: A.top - S.h, t: S.tell + Math.abs(c - pc) * 0.012, w: S.w, h: S.h, floor: A.floor, speed: S.speed, damage: 1, falling: false });
    }
    Sound.play('tellShards');
  }

  function updateAttack(b, dt) {
    var p = Game.player, ph = b.phase, mul = B.speedMul[ph], A = bounds();
    switch (b.attack) {
      case 'charge':
        if (b.sub === 'run') {
          b.vx = b.dir * B.charge.speed * mul;
          if (Math.random() < 0.6) Game.addParticle({ x: cx(b) - b.dir * 50, y: b.y + b.h, vx: -b.dir * 80, vy: -60 - Math.random() * 60, life: 0.4, size: 4, color: [130, 150, 190], type: 'dot' });
          if (b.hitL || b.hitR) {
            b.vx = 0; landFx(b, false); b.count--;
            if (b.count > 0) { b.sub = 'turn'; b.t = B.charge.retell; b.dir = -b.dir; Sound.play('tellCharge'); }
            else { setHeight(b, B.h); setRecover(b, B.charge.recover); }
          }
        } else {
          b.vx = 0; b.t -= dt;
          if (b.t <= 0) b.sub = 'run';
        }
        break;
      case 'leap':
        if (b.sub === 'air') {
          b.t += dt;
          if (b.onGround && b.t > 0.1) {
            b.vx = 0; landFx(b, true); spawnWaves(b, mul); b.count--;
            if (b.count > 0) { b.sub = 'crouch'; b.t = 0.42; Sound.play('tellLeap'); }
            else setRecover(b, B.leap.recover);
          }
        } else {
          b.t -= dt; b.dir = cx(p) > cx(b) ? 1 : -1;
          if (b.t <= 0) leapAt(b);
        }
        break;
      case 'volley':
        b.shotT -= dt;
        if (b.shotT <= 0 && b.shots > 0) {
          var V = B.volley, i = b.count - b.shots, n = b.count;
          var sx = cx(b) + b.dir * 30, sy = b.y - 34;
          var tx = clamp(cx(p) + (i - (n - 1) / 2) * 78, A.x0 + 20, A.x1 - 20);
          var F = 1.0 + 0.07 * i;
          Game.spawnProjectile({ kind: 'orb', friendly: false, x: sx, y: sy, r: V.radius, g: V.gravity, life: 4, damage: 1, pogo: true,
            vx: (tx - sx) / F, vy: (A.floor - 16 - sy) / F - 0.5 * V.gravity * F });
          Sound.play('spit');
          b.shots--; b.shotT = V.gap;
          if (b.shots === 0) setRecover(b, V.recover);
        }
        break;
      case 'dive':
        var D = B.dive;
        if (b.sub === 'rise') {
          b.y += b.vy * dt;
          if (b.y + b.h < A.top - 30) { b.sub = 'track'; b.hidden = true; b.t = D.track / mul; b.markerX = cx(b); }
        } else if (b.sub === 'track') {
          b.t -= dt;
          var want = clamp(cx(p), A.x0 + 62, A.x1 - 62);
          b.markerX += clamp(want - b.markerX, -560 * dt, 560 * dt);
          if (b.t <= 0) { b.sub = 'lock'; b.t = Math.max(0.4, D.lock * B.tellMul[ph]); Sound.play('diveLock'); }
        } else if (b.sub === 'lock') {
          b.t -= dt;
          if (b.t <= 0) {
            b.sub = 'fall'; b.hidden = false; b.x = b.markerX - b.w / 2; b.y = A.top - b.h - 40; b.vy = D.speed;
            b.dmg = ph >= 2 ? 2 : 1; Sound.play('swoop');
          }
        } else if (b.sub === 'fall') {
          b.y += b.vy * dt;
          if (b.y + b.h >= A.floor) {
            b.y = A.floor - b.h; b.vy = 0; b.free = false; b.onGround = true;
            landFx(b, true);
            if (ph >= 2) spawnWaves(b, mul);
            b.sub = 'impact'; b.t = 0.12;
          }
        } else {
          b.t -= dt;
          if (b.t <= 0) { b.dmg = 1; setRecover(b, D.recover); }
        }
        break;
      case 'shards':
        b.t -= dt;
        if (b.t <= 0) {
          if (b.count > 0) { shardSalvo(b); b.count--; b.t = B.shards.salvoGap; }
          else setRecover(b, B.shards.recover);
        }
        break;
    }
  }

  function update(b, dt) {
    b.animT += dt;
    b.flash = Math.max(0, b.flash - dt);
    var p = Game.player, mul = B.speedMul[b.phase];
    switch (b.state) {
      case 'dormant': case 'dead': return;
      case 'intro':
        b.t -= dt;
        if (!b.roared && b.t <= 1.5) { b.roared = true; Game.onBossRoar(b); }
        if (b.t <= 0) enterIdle(b);
        break;
      case 'idle':
        var dx = cx(p) - cx(b);
        b.dir = dx > 0 ? 1 : -1;
        b.vx = Math.abs(dx) > 230 ? b.dir * B.walkSpeed * mul : 0;
        b.t -= dt;
        if (b.t <= 0 && !p.dead) choose(b);
        break;
      case 'tell':
        b.vx = 0; b.t -= dt;
        if (b.t <= 0) startAttack(b);
        break;
      case 'attack': updateAttack(b, dt); break;
      case 'recover': case 'stagger': case 'roar':
        b.vx = 0; b.t -= dt;
        if (b.t <= 0) enterIdle(b);
        break;
      case 'dying':
        b.vx = 0; b.t -= dt / Math.max(0.05, Game.slowmo);
        if (Math.random() < 0.7) Game.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, 2, { color: CFG.colors.phase[2], speed: 200, life: 0.7, type: 'spark' });
        if (b.t <= 0) { b.state = 'dead'; b.dead = true; Game.onBossDead(b); return; }
        break;
    }
    if (!b.free) {
      var g = (b.state === 'attack' && b.attack === 'leap') ? B.leap.gravity : B.gravity;
      b.vy = Math.min(1400, b.vy + g * dt);
      Game.moveBody(b, b.vx * dt, b.vy * dt);
    }
    // contact damage
    if (!b.hidden && b.state !== 'stagger' && b.state !== 'roar' && b.state !== 'dying' && b.state !== 'intro' && Game.overlap(p, b)) {
      Game.hurtPlayer(b.dmg, cx(b));
    }
  }

  function hittable(b) {
    return !b.hidden && !b.dead && b.state !== 'dormant' && b.state !== 'intro' && b.state !== 'roar' && b.state !== 'dying';
  }

  function hurt(b, dmg) {
    if (!hittable(b)) return false;
    b.hp -= dmg; b.flash = 0.1;
    if (b.state !== 'stagger') b.hits++;
    if (b.hp <= 0) {
      b.hp = 0; setHeight(b, B.h); b.free = false; b.hidden = false;
      b.state = 'dying'; b.t = B.deathTime; b.vx = 0; b.attack = null;
      Game.onBossDying(b);
      return true;
    }
    var np = b.hp <= b.maxHp * B.phase3 ? 2 : (b.hp <= b.maxHp * B.phase2 ? 1 : 0);
    if (np > b.phase) b.pendingPhase = true;
    if (b.hits >= B.staggerHits) b.pendingStagger = true;
    if ((b.pendingPhase || b.pendingStagger) && (b.state === 'idle' || b.state === 'tell' || b.state === 'recover' || b.state === 'stagger')) {
      if (b.pendingPhase) startRoar(b); else if (b.state !== 'stagger') startStagger(b);
    }
    return true;
  }

  function updateHazards(dt) {
    var hz = Game.hazards, p = Game.player;
    for (var i = hz.length - 1; i >= 0; i--) {
      var h = hz[i], box = null;
      if (h.kind === 'wave') {
        h.x += h.dir * h.speed * dt; h.life -= dt;
        if (h.life <= 0 || Game.solidAtPx(h.x, h.y - 10)) { hz.splice(i, 1); continue; }
        if (Math.random() < 0.5) Game.addParticle({ x: h.x, y: h.y - Math.random() * h.h, vx: -h.dir * 60, vy: -40, life: 0.3, size: 3, color: CFG.colors.phase[Game.boss ? Game.boss.phase : 0], type: 'dot' });
        box = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
      } else if (h.kind === 'shard') {
        if (!h.falling) { h.t -= dt; if (h.t <= 0) h.falling = true; }
        else {
          h.y += h.speed * dt;
          if (h.y + h.h >= h.floor) {
            Game.burst(h.x, h.floor, 6, { color: CFG.colors.violet, speed: 200, life: 0.4, type: 'spark', up: true });
            hz.splice(i, 1); continue;
          }
          box = { x: h.x - h.w / 2, y: h.y, w: h.w, h: h.h };
        }
      }
      if (box && Game.overlap(p, box)) Game.hurtPlayer(h.damage, box.x + box.w / 2);
    }
  }

  return { create: create, update: update, hurt: hurt, wake: wake, hittable: hittable, updateHazards: updateHazards, bounds: bounds };
})();
