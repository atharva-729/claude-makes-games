// GLOAMREACH - regular enemies and their projectiles.
//  crawler  (shell-mite): patrols, turns at edges and walls, contact damage
//  grub     : harmless tutorial crawler
//  flyer    (gloom-moth): hovers, flares its eye + spreads wings (tell), then swoops
//  wisp     : smaller flyer summoned by the boss
//  spitter  (bulb-maw): rooted, swells and glows (tell), lobs slow arcing seeds

function createEnemy(def) {
  var T = CFG.TILE;
  var type = def.type;
  var c = CFG.enemies[type === 'grub' ? 'crawler' : type];
  var e = {
    type: type, w: c.w, h: c.h, hp: c.hp, maxHp: c.hp,
    vx: 0, vy: 0, dir: def.dir || -1, face: -1,
    state: 'idle', t: 0, cd: 0.5 + Math.random() * 1.2,
    flash: 0, kbT: 0, kbVx: 0, kbVy: 0, recoil: 0,
    walk: Math.random() * 6, bob: Math.random() * 6,
    dead: false, dying: 0, harmless: type === 'grub', arena: !!def.arena
  };
  e.x = (def.px !== undefined ? def.px : def.x * T + T / 2) - e.w / 2;
  if (type === 'flyer' || type === 'wisp') e.y = (def.py !== undefined ? def.py : def.y * T + T / 2) - e.h / 2;
  else e.y = (def.y + 1) * T - e.h;
  if (type === 'grub') { e.hp = e.maxHp = 2; }
  e.homeX = e.x; e.homeY = e.y; e.originX = e.x;
  return e;
}

function enemyCenter(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

function updateEnemy(e, dt, p) {
  e.flash -= dt; e.recoil -= dt; e.walk += dt * 6; e.bob += dt;
  if (e.dying > 0) { e.dying -= dt; if (e.dying <= 0) e.dead = true; return; }
  if (e.type === 'crawler' || e.type === 'grub') updateCrawler(e, dt);
  else if (e.type === 'flyer' || e.type === 'wisp') updateFlyer(e, dt, p);
  else if (e.type === 'spitter') updateSpitter(e, dt, p);
}

function updateCrawler(e, dt) {
  var C = CFG.enemies.crawler;
  var speed = e.type === 'grub' ? 28 : C.speed;
  e.vy += 1800 * dt; if (e.vy > 800) e.vy = 800;
  var vx;
  if (e.kbT > 0) { e.kbT -= dt; vx = e.kbVx; e.kbVx *= 0.85; }
  else {
    vx = e.dir * speed;
    var aheadX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
    var footY = e.y + e.h + 4;
    if (World.onGround(e, false)) {
      if (!World.solidOrLedgeAtPx(aheadX, footY) || World.solidAtPx(aheadX, e.y + e.h * 0.5) || World.spikeAtPx(aheadX, e.y + e.h - 4)) {
        e.dir *= -1; vx = 0;
      }
    }
  }
  var r = World.moveBody(e, vx * dt, e.vy * dt, true, false);
  if (r.hitY) e.vy = 0;
  if (r.hitX && e.kbT <= 0) e.dir *= -1;
}

function updateFlyer(e, dt, p) {
  var C = CFG.enemies[e.type];
  var c = enemyCenter(e);
  var pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  var dx = pc.x - c.x, dy = pc.y - c.y, dist = Math.sqrt(dx * dx + dy * dy);
  var alive = !p.dead;
  e.cd -= dt; e.t -= dt;
  if (e.kbT > 0) {
    e.kbT -= dt;
    World.moveBody(e, e.kbVx * dt, e.kbVy * dt, false, false);
    e.kbVx *= 0.88; e.kbVy *= 0.88;
    return;
  }
  var vx = 0, vy = 0;
  if (e.state === 'idle' || e.state === 'hover') {
    e.state = 'hover';
    var aggro = alive && dist < C.aggro;
    if (e.type === 'wisp' && alive) { e.homeX = pc.x - e.w / 2 + Math.sin(e.bob * 0.7) * 120; e.homeY = pc.y - 150; }
    else if (aggro) {
      // drift toward a perch above-ish the player, but stay leashed to origin
      var tx = Math.max(e.originX - 220, Math.min(e.originX + 220, pc.x - e.w / 2));
      e.homeX += (tx - e.homeX) * Math.min(1, dt * 0.8);
    }
    var hx = e.homeX + Math.sin(e.bob * 1.3) * 18, hy = e.homeY + Math.sin(e.bob * 2.1) * 10;
    vx = (hx - e.x) * 2.2; vy = (hy - e.y) * 2.2;
    e.face = dx >= 0 ? 1 : -1;
    if (aggro && e.cd <= 0 && dist > 40) {
      e.state = 'wind'; e.t = C.windup;
      if (Game.onScreen(c.x, c.y)) Snd.play('flyWind');
    }
  } else if (e.state === 'wind') {
    var len = Math.max(1, dist);
    vx = -dx / len * 50; vy = -dy / len * 50;
    e.face = dx >= 0 ? 1 : -1;
    if (e.t <= 0) {
      e.state = 'swoop'; e.t = C.swoopTime;
      e.vx = dx / len * C.swoopSpeed; e.vy = dy / len * C.swoopSpeed;
      Snd.play('swoop');
    }
  } else if (e.state === 'swoop') {
    vx = e.vx; vy = e.vy;
    if (Math.random() < 0.6) FX.trail(c.x, c.y, e.type === 'wisp' ? '#c9a8ff' : '#9a7bff');
    if (e.t <= 0) { e.state = 'recover'; e.t = C.recover; }
  } else if (e.state === 'recover') {
    vx = (e.homeX - e.x) * 1.4; vy = (e.homeY - e.y) * 1.4;
    if (e.t <= 0) { e.state = 'hover'; e.cd = C.cooldown * (0.8 + Math.random() * 0.5); }
  }
  var r = World.moveBody(e, vx * dt, vy * dt, false, false);
  if (e.state === 'swoop' && (r.hitX || r.hitY)) { e.state = 'recover'; e.t = C.recover; }
}

function updateSpitter(e, dt, p) {
  var C = CFG.enemies.spitter;
  if (e.kbT > 0) e.kbT -= dt;
  var c = enemyCenter(e);
  var pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  var dx = pc.x - c.x, dy = pc.y - c.y;
  e.face = dx >= 0 ? 1 : -1;
  if (e.state === 'idle') {
    e.cd -= dt;
    if (!p.dead && Math.abs(dx) < C.range && Math.abs(dy) < 320 && e.cd <= 0) {
      e.state = 'wind'; e.t = C.windup;
      if (Game.onScreen(c.x, c.y)) Snd.play('spitWind');
    }
  } else if (e.state === 'wind') {
    e.t -= dt;
    if (e.t <= 0) {
      var S = CFG.enemies.spit;
      var sx = c.x + e.face * 2, sy = e.y - 6;
      var tx = pc.x + (Math.random() - 0.5) * 30, ty = p.y + p.h - 10;
      var T = Math.max(S.speedMin, Math.min(S.speedMax, Math.abs(tx - sx) / 260 + 0.55));
      var vx = (tx - sx) / T;
      var vy = (ty - sy - 0.5 * S.gravity * T * T) / T;
      Game.spawnProjectile({ kind: 'spit', x: sx, y: sy, vx: vx, vy: vy, r: S.r, g: S.gravity, life: 5 });
      if (Game.onScreen(c.x, c.y)) Snd.play('spit');
      e.recoil = 0.3; e.state = 'idle'; e.cd = C.cooldown * (0.85 + Math.random() * 0.3);
    }
  }
}

function enemyBox(e) { return { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 2 }; }

// returns true if the enemy died
function hurtEnemy(e, dmg, dirX, dirY) {
  if (e.dying > 0 || e.dead) return false;
  var K = CFG.enemies.knockback;
  e.hp -= dmg; e.flash = CFG.enemies.flash;
  if (e.type !== 'spitter') {
    e.kbT = 0.16; e.kbVx = dirX * K; e.kbVy = dirY * K * 0.8;
    if (e.type === 'crawler' || e.type === 'grub') { e.kbVy = 0; if (dirY < 0) e.vy = -250; }
  } else { e.kbT = 0.12; e.kbVx = dirX * K; }
  if ((e.type === 'flyer' || e.type === 'wisp') && e.state === 'wind') { e.state = 'recover'; e.t = 0.6; }
  if (e.type === 'spitter' && e.state === 'wind') { e.t = Math.max(e.t, 0.25); }
  var c = enemyCenter(e);
  if (e.hp <= 0) {
    e.dying = 0.4;
    FX.enemyDeath(c.x, c.y, e.type);
    Snd.play('kill');
    return true;
  }
  FX.hit(c.x, c.y, dirX, '#e8fbff');
  return false;
}

// ---------- projectiles (enemy + boss) ----------
function updateProjectile(pr, dt) {
  pr.life -= dt;
  if (pr.life <= 0) { pr.dead = true; return; }
  if (pr.kind === 'spit' || pr.kind === 'orb') {
    pr.vy += pr.g * dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (Math.random() < 0.5) FX.trail(pr.x, pr.y, pr.kind === 'orb' ? '#ffcf8a' : '#c8ff8a');
    if (World.solidAtPx(pr.x, pr.y + pr.r * 0.5) || World.oneWayHitPx(pr.x, pr.y + pr.r, pr.vy)) {
      pr.dead = true; FX.pop(pr.x, pr.y, pr.kind === 'orb' ? '#ffcf8a' : '#c8ff8a');
      if (Game.onScreen(pr.x, pr.y)) Snd.play('pop');
    }
  } else if (pr.kind === 'wave') {
    pr.x += pr.dir * pr.speed * dt;
    if (Math.random() < 0.7) FX.ember(pr.x, pr.y - 6);
    if (World.solidAtPx(pr.x + pr.dir * 10, pr.y - 10) || pr.x < pr.minX || pr.x > pr.maxX) { pr.dead = true; FX.pop(pr.x, pr.y - 10, '#b48cff'); }
  } else if (pr.kind === 'debris') {
    pr.vy = Math.min(pr.vy + 2400 * dt, 1100);
    pr.y += pr.vy * dt;
    if (pr.y >= pr.floorY - 4) { pr.dead = true; FX.shatter(pr.x, pr.floorY - 4); Snd.play('crumble'); Game.shake(3); }
  }
}
function projectileBox(pr) {
  if (pr.kind === 'wave') return { x: pr.x - 11, y: pr.y - pr.h, w: 22, h: pr.h };
  if (pr.kind === 'debris') return { x: pr.x - 8, y: pr.y - 26, w: 16, h: 30 };
  return { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
}
