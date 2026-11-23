// GLOAMREACH - the boss: OSSIVETH, The Lantern-Glutton.
// A gaunt antlered beast whose ribcage glows with the lanterns it has swallowed.
// Attacks (every one has a wind-up pose + sound of 0.45-0.65 s):
//  1 charge   - head lowered, scrapes the ground, then gallops wall to wall (jump it)
//  2 leap     - deep crouch, leaps at you, slam sends shockwaves both ways (jump them / pogo)
//  3 volley   - rears up, ribcage blazes, spits arcing lantern-embers with gaps between
//  4 dive     - (phase 2+) crouch + glow, vaults out of sight, a marker hunts you, locks, slams (2 dmg in phase 3)
//  5 summon   - (phase 2+) howls, releases two lantern-wisps
//  6 hazard   - (phase 3) stalactites fall at marked spots
// Phase 2 at 66%: lights dim, rain. Phase 3 at 33%: spikes rise at the walls, harder music, falling stalactites.

function createBoss(def) {
  var T = CFG.TILE, B = CFG.boss;
  return {
    x0: def.x0 * T, x1: (def.x1 + 1) * T, top: def.y0 * T, floorY: (def.y + 1) * T,
    w: B.w, h: B.h,
    x: def.x * T + T / 2 - B.w / 2, y: (def.y + 1) * T - B.h,
    vx: 0, vy: 0, facing: -1,
    hp: B.hp, maxHp: B.hp, hpShown: B.hp, phase: 1, pendingPhase: 0,
    state: 'dormant', t: 0, flash: 0, hits: 0, pendingStagger: false,
    last: '', last2: '', walkPhase: 0, markerX: 0, leapCount: 0, volleyLeft: 0, volleyT: 0,
    hazardT: 2.0, warnings: [], gone: false, dyingT: 0, burstT: 0
  };
}

function bossGrounded(b) { return b.y + b.h >= b.floorY - 1; }

function bossBox(b) {
  var cx = b.x + b.w / 2, f = b.facing;
  var s = b.state;
  if (s === 'charge' || s === 'chargeWind') return { x: f > 0 ? cx - 52 : cx - 72, y: b.y + 42, w: 124, h: b.h - 42 };
  if (s === 'stagger' || s === 'dying') return { x: cx - 64, y: b.y + 64, w: 128, h: b.h - 64 };
  if (s === 'leap' || s === 'diveUp' || s === 'diveFall') return { x: cx - 46, y: b.y + 22, w: 92, h: b.h - 34 };
  return { x: f > 0 ? cx - 50 : cx - 70, y: b.y + 18, w: 120, h: b.h - 18 };
}
function bossCanHurtPlayer(b) {
  var s = b.state;
  return !(s === 'dormant' || s === 'intro' || s === 'stagger' || s === 'roar' || s === 'dying' || s === 'diveTrack' || s === 'diveLock' || b.gone);
}
function bossVulnerable(b) {
  var s = b.state;
  return !(s === 'dormant' || s === 'intro' || s === 'roar' || s === 'dying' || s === 'diveTrack' || s === 'diveLock' || b.gone);
}
function bossContactDamage(b) {
  if (b.state === 'diveFall' && b.phase >= 3) return CFG.boss.bigDamage;
  return CFG.boss.contactDamage;
}

function bossFacePlayer(b, p) { b.facing = (p.x + p.w / 2) >= (b.x + b.w / 2) ? 1 : -1; }
function bossClamp(b) {
  if (b.x < b.x0) { b.x = b.x0; return -1; }
  if (b.x + b.w > b.x1) { b.x = b.x1 - b.w; return 1; }
  return 0;
}
function phaseIdx(b) { return b.phase - 1; }

function bossChooseAttack(b, p) {
  var B = CFG.boss, i = phaseIdx(b);
  var dist = Math.abs((p.x + p.w / 2) - (b.x + b.w / 2));
  var pool = [];
  function add(name, w) { if (name === b.last) w *= 0.15; if (name === b.last2) w *= 0.6; pool.push([name, w]); }
  add('charge', dist > 260 ? 3 : 1.5);
  add('leap', dist < 300 ? 3 : 2);
  add('volley', dist > 200 ? 2.5 : 1.2);
  if (b.phase >= 2) {
    add('dive', 2.4);
    if (Game.countWisps() < 2) add('summon', b.last === 'summon' || b.last2 === 'summon' ? 0.3 : 1.4);
  }
  var tot = 0, k;
  for (k = 0; k < pool.length; k++) tot += pool[k][1];
  var r = Math.random() * tot, pick = pool[0][0];
  for (k = 0; k < pool.length; k++) { r -= pool[k][1]; if (r <= 0) { pick = pool[k][0]; break; } }
  b.last2 = b.last; b.last = pick;
  bossFacePlayer(b, p);
  if (pick === 'charge') { b.state = 'chargeWind'; b.t = B.windCharge[i]; Snd.play('windCharge'); }
  else if (pick === 'leap') { b.state = 'leapWind'; b.t = B.windLeap[i]; b.leapCount = 0; Snd.play('windLeap'); }
  else if (pick === 'volley') { b.state = 'volleyWind'; b.t = B.windVolley[i]; Snd.play('windVolley'); }
  else if (pick === 'dive') { b.state = 'diveWind'; b.t = B.windDive[i]; Snd.play('windDive'); }
  else if (pick === 'summon') { b.state = 'summonWind'; b.t = B.windSummon[i]; Snd.play('windSummon'); }
}

function bossToIdle(b, gapMul) {
  b.state = 'idle'; b.t = CFG.boss.idleGap[phaseIdx(b)] * (gapMul || 1) * (0.8 + Math.random() * 0.4);
  b.vx = 0;
}

function bossStartLeap(b, p) {
  var B = CFG.boss, i = phaseIdx(b);
  var tx = Math.max(b.x0 + 10, Math.min(b.x1 - b.w - 10, p.x + p.w / 2 - b.w / 2));
  var T = B.leapTime[i], g = 2600;
  b.vx = (tx - b.x) / T; b.vy = -0.5 * g * T; b.g = g;
  b.state = 'leap';
  Snd.play('jump');
  FX.dust(b.x + b.w / 2, b.floorY, 14);
}

function bossLand(b) {
  b.y = b.floorY - b.h; b.vy = 0; b.vx = 0;
}

function updateBoss(b, dt, p) {
  var B = CFG.boss, i = phaseIdx(b);
  b.flash -= dt;
  b.hpShown += (b.hp - b.hpShown) * Math.min(1, dt * 3);
  if (b.hpShown < b.hp) b.hpShown = b.hp;
  b.t -= dt;
  var s = b.state;

  // pending phase change / stagger when back on the ground
  if (b.pendingPhase && bossGrounded(b) && s !== 'leap' && s.indexOf('dive') !== 0) { bossBeginRoar(b, b.pendingPhase); return; }
  if (b.pendingStagger && bossGrounded(b) && (s === 'idle' || s.indexOf('Recover') > 0 || s.indexOf('Wind') > 0)) {
    b.pendingStagger = false; b.state = 'stagger'; b.t = B.staggerTime; b.vx = 0; Snd.play('thud'); Game.shake(6); FX.dust(b.x + b.w / 2, b.floorY, 12);
    return;
  }

  // phase 3 falling stalactites
  if (b.phase >= 3 && s !== 'dying' && s !== 'roar' && !p.dead) {
    b.hazardT -= dt;
    if (b.hazardT <= 0) {
      b.hazardT = B.hazardEvery * (0.85 + Math.random() * 0.3);
      var px = p.x + p.w / 2 + (Math.random() - 0.5) * 60;
      var x2 = b.x0 + 60 + Math.random() * (b.x1 - b.x0 - 120);
      if (Math.abs(x2 - px) < 150) x2 = px + (px < (b.x0 + b.x1) / 2 ? 220 : -220);
      [px, x2].forEach(function (x) {
        x = Math.max(b.x0 + 80, Math.min(b.x1 - 80, x));
        b.warnings.push({ x: x, t: B.hazardWarn, top: b.top });
      });
      Snd.play('debrisWarn');
    }
  }
  for (var w = b.warnings.length - 1; w >= 0; w--) {
    var wr = b.warnings[w]; wr.t -= dt;
    if (wr.t <= 0) {
      Game.spawnProjectile({ kind: 'debris', x: wr.x, y: b.top + 30, vx: 0, vy: 250, floorY: b.floorY, life: 3, big: false });
      b.warnings.splice(w, 1);
    }
  }

  switch (s) {
    case 'dormant': break;
    case 'intro':
      b.t += dt * 2; // b.t counts up in intro
      if (b.t > 1.3 && !b.roared) { b.roared = true; Snd.play('roar'); Game.shake(14); FX.roarRing(b.x + b.w / 2, b.y + 30); Game.bossTitle(); }
      if (b.t > 3.6) { bossToIdle(b, 0.6); Game.bossFightStart(); }
      break;
    case 'idle':
      bossFacePlayer(b, p);
      var dx = (p.x + p.w / 2) - (b.x + b.w / 2), ad = Math.abs(dx);
      var ws = B.walkSpeed[i];
      if (ad > 230) b.vx = Math.sign(dx) * ws;
      else if (ad < 100) b.vx = -Math.sign(dx) * ws * 0.7;
      else b.vx *= 0.9;
      b.x += b.vx * dt; bossClamp(b);
      b.walkPhase += Math.abs(b.vx) * dt * 0.06;
      if (b.t <= 0 && !p.dead) bossChooseAttack(b, p);
      break;

    case 'chargeWind':
      if (Math.random() < 0.4) FX.dust(b.x + b.w / 2 - b.facing * 30, b.floorY, 1);
      if (b.t <= 0) { b.state = 'charge'; b.vx = b.facing * B.chargeSpeed[i]; Snd.play('swoop'); Snd.play('thud'); }
      break;
    case 'charge':
      b.x += b.vx * dt;
      b.walkPhase += dt * 16;
      if (Math.random() < 0.6) FX.dust(b.x + b.w / 2 - b.facing * 40, b.floorY, 1);
      if (bossClamp(b) !== 0) {
        Game.shake(10); Snd.play('thud'); Snd.play('slam');
        FX.dust(b.facing > 0 ? b.x1 : b.x0, b.floorY - 40, 16);
        b.state = 'chargeRecover'; b.t = b.phase >= 3 ? 0.45 : 0.65; b.vx = -b.facing * 140;
      }
      break;
    case 'chargeRecover':
      b.x += b.vx * dt; b.vx *= 0.9; bossClamp(b);
      if (b.t <= 0) {
        if (b.phase >= 3 && Math.random() < 0.5 && !p.dead) { bossFacePlayer(b, p); b.state = 'leapWind'; b.t = B.windLeap[i]; b.leapCount = 1; Snd.play('windLeap'); }
        else bossToIdle(b);
      }
      break;

    case 'leapWind':
      if (b.t <= 0) bossStartLeap(b, p);
      break;
    case 'leap':
      b.vy += b.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      bossClamp(b);
      if (b.vy > 0 && b.y + b.h >= b.floorY) {
        bossLand(b);
        Game.shake(12); Snd.play('slam');
        FX.dust(b.x + b.w / 2, b.floorY, 20);
        var spd = B.waveSpeed[i];
        Game.spawnProjectile({ kind: 'wave', x: b.x + 8, y: b.floorY, dir: -1, speed: spd, h: 30, life: 4, minX: b.x0, maxX: b.x1 });
        Game.spawnProjectile({ kind: 'wave', x: b.x + b.w - 8, y: b.floorY, dir: 1, speed: spd, h: 30, life: 4, minX: b.x0, maxX: b.x1 });
        b.leapCount++;
        if (b.phase >= 3 && b.leapCount < 2) { b.state = 'leapRecover'; b.t = 0.35; b.chain = true; }
        else { b.state = 'leapRecover'; b.t = 0.6; b.chain = false; }
      }
      break;
    case 'leapRecover':
      if (b.t <= 0) {
        if (b.chain && !p.dead) { bossFacePlayer(b, p); b.state = 'leapWind'; b.t = B.windLeap[i]; Snd.play('windLeap'); }
        else bossToIdle(b);
      }
      break;

    case 'volleyWind':
      bossFacePlayer(b, p);
      if (b.t <= 0) { b.state = 'volley'; b.volleyLeft = B.volleyCount[i]; b.volleyT = 0; b.volleyBase = p.x + p.w / 2; }
      break;
    case 'volley':
      b.volleyT -= dt;
      if (b.volleyT <= 0 && b.volleyLeft > 0) {
        var n = B.volleyCount[i], k = n - b.volleyLeft;
        var spacing = 118;
        var tx = b.volleyBase + (k - (n - 1) / 2) * spacing + (Math.random() - 0.5) * 16;
        tx = Math.max(b.x0 + 20, Math.min(b.x1 - 20, tx));
        var sx = b.x + b.w / 2 + b.facing * 60, sy = b.y + 20;
        var T = 1.05, g = 700;
        Game.spawnProjectile({ kind: 'orb', x: sx, y: sy, vx: (tx - sx) / T, vy: (b.floorY - 8 - sy - 0.5 * g * T * T) / T, r: 11, g: g, life: 4 });
        Snd.play('spit');
        b.volleyLeft--; b.volleyT = 0.09;
      }
      if (b.volleyLeft <= 0) { b.state = 'volleyRecover'; b.t = 0.65; }
      break;
    case 'volleyRecover':
      if (b.t <= 0) bossToIdle(b);
      break;

    case 'diveWind':
      if (b.t <= 0) { b.state = 'diveUp'; b.vy = -1500; FX.dust(b.x + b.w / 2, b.floorY, 18); Snd.play('dash'); }
      break;
    case 'diveUp':
      b.y += b.vy * dt;
      if (b.y + b.h < b.top - 30) { b.state = 'diveTrack'; b.t = B.diveTrack[i]; b.markerX = b.x + b.w / 2; }
      break;
    case 'diveTrack':
      var target = Math.max(b.x0 + b.w / 2, Math.min(b.x1 - b.w / 2, p.x + p.w / 2));
      var mv = 520 * dt;
      b.markerX += Math.max(-mv, Math.min(mv, target - b.markerX));
      if (b.t <= 0) { b.state = 'diveLock'; b.t = B.diveLock; Snd.play('diveLock'); }
      break;
    case 'diveLock':
      if (b.t <= 0) { b.state = 'diveFall'; b.x = b.markerX - b.w / 2; b.y = b.top - b.h; b.vy = B.diveFallSpeed; }
      break;
    case 'diveFall':
      b.y += b.vy * dt;
      if (b.y + b.h >= b.floorY) {
        bossLand(b);
        Game.shake(b.phase >= 3 ? 18 : 13); Snd.play('slam');
        FX.dust(b.x + b.w / 2, b.floorY, 26); FX.roarRing(b.x + b.w / 2, b.floorY - 10);
        if (b.phase >= 3) {
          Game.spawnProjectile({ kind: 'wave', x: b.x + 8, y: b.floorY, dir: -1, speed: B.waveSpeed[i] * 0.9, h: 26, life: 4, minX: b.x0, maxX: b.x1 });
          Game.spawnProjectile({ kind: 'wave', x: b.x + b.w - 8, y: b.floorY, dir: 1, speed: B.waveSpeed[i] * 0.9, h: 26, life: 4, minX: b.x0, maxX: b.x1 });
        }
        b.state = 'diveRecover'; b.t = 0.85;
      }
      break;
    case 'diveRecover':
      if (b.t <= 0) bossToIdle(b);
      break;

    case 'summonWind':
      if (b.t <= 0) {
        for (var q = -1; q <= 1; q += 2) Game.spawnWisp(b.x + b.w / 2 + q * 50, b.y + 10);
        Snd.play('roar');
        b.state = 'summonRecover'; b.t = 0.5;
      }
      break;
    case 'summonRecover':
      if (b.t <= 0) bossToIdle(b);
      break;

    case 'stagger':
      if (Math.random() < 0.2) FX.ember(b.x + b.w / 2 + (Math.random() - 0.5) * 60, b.y + 60);
      if (b.t <= 0) { bossToIdle(b, 0.4); }
      break;

    case 'roar':
      if (b.t <= B.roarTime - 0.35 && !b.roarFx) {
        b.roarFx = true;
        Snd.play('roar'); Game.shake(20); FX.roarRing(b.x + b.w / 2, b.y + 30);
        Game.bossRoarPush(b); Game.bossPhaseChange(b.phase);
      }
      if (Math.random() < 0.5) FX.ember(b.x + b.w / 2 + (Math.random() - 0.5) * 80, b.y + 40);
      if (b.t <= 0) { b.roarFx = false; bossToIdle(b, 0.5); }
      break;

    case 'dying':
      b.dyingT += dt;
      b.burstT -= dt;
      if (b.burstT <= 0) { b.burstT = 0.12; FX.bossBurst(b.x + Math.random() * b.w, b.y + Math.random() * b.h); Game.shake(6); Snd.play('hit'); }
      if (b.dyingT > 0.9 && !b.gone) { b.gone = true; Game.bossExplode(b); }
      break;
  }
  // keep inside the floor
  if (b.state !== 'leap' && b.state.indexOf('dive') !== 0 && b.y + b.h > b.floorY) b.y = b.floorY - b.h;
}

function bossBeginRoar(b, phase) {
  b.pendingPhase = 0;
  b.phase = phase;
  b.state = 'roar'; b.t = CFG.boss.roarTime; b.vx = 0; b.roarFx = false;
  b.hits = 0; b.pendingStagger = false;
  Snd.play('windSummon');
}

// returns true when the hit landed
function hurtBoss(b, dmg, dirX) {
  if (!bossVulnerable(b)) return false;
  var B = CFG.boss;
  b.hp -= dmg; b.flash = 0.09;
  Snd.play('bossHurt');
  if (b.hp <= 0) {
    b.hp = 0; b.state = 'dying'; b.dyingT = 0; b.burstT = 0; b.warnings = [];
    Game.bossDying(b);
    return true;
  }
  if (b.phase === 1 && b.hp <= b.maxHp * B.phase2At) {
    if (bossGrounded(b)) bossBeginRoar(b, 2); else b.pendingPhase = 2;
    return true;
  }
  if (b.phase === 2 && b.hp <= b.maxHp * B.phase3At) {
    if (bossGrounded(b)) bossBeginRoar(b, 3); else b.pendingPhase = 3;
    return true;
  }
  if (b.state !== 'stagger') {
    b.hits++;
    if (b.hits >= B.staggerHits[phaseIdx(b)]) {
      b.hits = 0;
      var s = b.state;
      if (bossGrounded(b) && s !== 'charge' && s.indexOf('dive') !== 0 && s !== 'leap' && s !== 'volley') {
        b.state = 'stagger'; b.t = B.staggerTime; b.vx = 0; Snd.play('thud'); Game.shake(6); FX.dust(b.x + b.w / 2, b.floorY, 12);
      } else b.pendingStagger = true;
    }
  }
  return true;
}
