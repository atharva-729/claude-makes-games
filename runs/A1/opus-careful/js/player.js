// GLOAMREACH - the player ("the Wick"): movement, slashing, dash, healing, bolts.
function createPlayer(tx, ty, maxHp) {
  var P = CFG.player, T = CFG.TILE;
  return {
    x: tx * T + (T - P.w) / 2, y: (ty + 1) * T - P.h, w: P.w, h: P.h,
    vx: 0, vy: 0, facing: 1, onGround: true, coyote: 0, jumpBuf: 0, jumping: false,
    dashT: 0, dashCd: 0, dashDir: 1, airDash: true, afterT: 0,
    wallDir: 0, wallLock: 0, wallSliding: false,
    atkCd: 0, slashT: 0, slashAnim: 0, slashDir: 'fwd', slashId: 0, slashHits: [], pogoDone: false,
    boltCd: 0,
    hp: maxHp, maxHp: maxHp, energy: 0,
    invuln: 0, hurtT: 0, healT: 0, healing: false,
    recoilT: 0, recoilVx: 0, dropT: 0,
    runPhase: 0, sq: 1, afterimages: [], dead: false,
    safeX: tx * T + (T - P.w) / 2, safeY: (ty + 1) * T - P.h, stepDust: 0
  };
}

function approach(v, target, amt) {
  if (v < target) return Math.min(v + amt, target);
  if (v > target) return Math.max(v - amt, target);
  return v;
}

function playerStandingOnOneWayOnly(p) {
  var T = CFG.TILE, fy = Math.floor((p.y + p.h + 1) / T);
  if (Math.abs((p.y + p.h) - fy * T) > 1) return false;
  var x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T), any = false;
  for (var tx = x0; tx <= x1; tx++) {
    if (World.solidAt(tx, fy)) return false;
    if (World.oneWayAt(tx, fy)) any = true;
  }
  return any;
}

function updatePlayer(p, inp, dt) {
  var P = CFG.player;
  if (p.dead) return;
  // timers
  p.coyote -= dt; p.jumpBuf -= dt; p.dashCd -= dt; p.atkCd -= dt; p.boltCd -= dt;
  p.invuln -= dt; p.hurtT -= dt; p.wallLock -= dt; p.recoilT -= dt; p.slashT -= dt; p.slashAnim -= dt; p.dropT -= dt;
  p.sq += (1 - p.sq) * Math.min(1, dt * 14);
  for (var i = p.afterimages.length - 1; i >= 0; i--) { p.afterimages[i].life -= dt; if (p.afterimages[i].life <= 0) p.afterimages.splice(i, 1); }

  var dir = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
  if (inp.pressed('jump')) p.jumpBuf = P.jumpBuffer;
  var stunned = p.hurtT > 0;

  // ---- healing (hold F, standing still, costs energy)
  var canHeal = inp.down('heal') && p.onGround && dir === 0 && !stunned && p.dashT <= 0 &&
    p.energy >= P.healCost && p.hp < p.maxHp && p.slashAnim <= 0;
  if (canHeal) {
    if (!p.healing) { p.healing = true; p.healT = 0; Snd.play('healCharge'); }
    p.healT += dt;
    if (Math.random() < 0.5) FX.healMote(p);
    if (p.healT >= P.healTime) {
      p.hp++; p.energy -= P.healCost; p.healT = 0; p.healing = false;
      Snd.play('heal'); FX.healBurst(p); Game.hudGain();
    }
  } else { p.healing = false; p.healT = 0; }

  // ---- dash
  if (inp.pressed('dash') && p.dashCd <= 0 && !stunned && !p.healing && (p.onGround || p.airDash)) {
    p.dashT = P.dashTime; p.dashCd = P.dashCooldown + P.dashTime;
    p.dashDir = dir || p.facing;
    if (p.wallSliding) p.dashDir = -p.wallDir;
    p.facing = p.dashDir;
    if (!p.onGround) p.airDash = false;
    p.vy = 0; p.jumping = false;
    Snd.play('dash'); FX.dashBurst(p);
  }

  // ---- horizontal movement
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * P.dashSpeed; p.vy = 0;
    p.afterT -= dt;
    if (p.afterT <= 0) { p.afterT = 0.025; p.afterimages.push({ x: p.x + p.w / 2, y: p.y + p.h, f: p.facing, life: 0.25 }); }
    if (p.dashT <= 0) p.vx = p.dashDir * P.runSpeed;
  } else if (stunned) {
    p.vx = approach(p.vx, 0, 600 * dt);
  } else if (p.healing) {
    p.vx = approach(p.vx, 0, P.decelGround * dt);
  } else {
    var accel = p.onGround ? (dir ? P.accelGround : P.decelGround) : (dir ? P.accelAir : P.decelAir);
    if (p.wallLock > 0) accel *= 0.2;
    // turning around on ground is snappy
    if (dir && p.onGround && Math.sign(p.vx) === -dir) accel *= 1.6;
    p.vx = approach(p.vx, dir * P.runSpeed, accel * dt);
    if (dir && p.slashAnim <= 0 && p.wallLock <= 0) p.facing = dir;
  }

  // ---- jumping
  if (p.jumpBuf > 0 && !stunned && !p.healing) {
    if (p.onGround && inp.down('down') && playerStandingOnOneWayOnly(p)) {
      p.dropT = 0.22; p.jumpBuf = 0; p.onGround = false; p.y += 2;
    } else if (p.onGround || p.coyote > 0) {
      p.vy = -P.jumpVel; p.jumping = true; p.onGround = false; p.coyote = 0; p.jumpBuf = 0;
      if (p.dashT > 0) { p.dashT = 0; p.vx = p.dashDir * P.runSpeed * 1.15; }
      p.sq = 1.25;
      Snd.play('jump'); FX.dust(p.x + p.w / 2, p.y + p.h, 6);
    } else if (p.wallDir !== 0) {
      p.vx = -p.wallDir * P.wallJumpVx; p.vy = -P.wallJumpVy; p.jumping = true;
      p.facing = -p.wallDir; p.wallLock = P.wallJumpLock; p.jumpBuf = 0; p.dashT = 0; p.airDash = true;
      p.sq = 1.2;
      Snd.play('wallJump'); FX.dust(p.wallDir > 0 ? p.x + p.w : p.x, p.y + p.h * 0.7, 6);
    }
  }
  if (p.jumping && !inp.down('jump') && p.vy < 0) { p.vy *= P.jumpCut; p.jumping = false; }
  if (p.vy >= 0) p.jumping = false;

  // ---- gravity + wall slide
  if (p.dashT <= 0) {
    p.vy += P.gravity * (p.vy > 0 ? P.fallMult : 1) * dt;
    if (p.vy > P.maxFall) p.vy = P.maxFall;
  }
  p.wallSliding = false;
  if (!p.onGround && p.wallDir !== 0 && dir === p.wallDir && p.vy > 0 && p.dashT <= 0 && !stunned) {
    if (p.vy > P.wallSlideSpeed) p.vy = P.wallSlideSpeed;
    p.wallSliding = true; p.facing = -p.wallDir; p.airDash = true;
    if (Math.random() < 0.25) FX.wallDust(p);
  }

  // ---- slash
  if (inp.pressed('attack') && p.atkCd <= 0 && !stunned && !p.healing && p.dashT <= 0) {
    var sd = 'fwd';
    if (inp.down('up')) sd = 'up';
    else if (inp.down('down') && !p.onGround) sd = 'down';
    p.slashDir = sd; p.slashT = P.slashActive; p.slashAnim = 0.2; p.atkCd = P.slashCooldown;
    p.slashId++; p.slashHits = []; p.pogoDone = false;
    Snd.play('slash');
  }
  // ---- light bolt
  if (inp.pressed('bolt') && p.boltCd <= 0 && !stunned && !p.healing) {
    if (p.energy >= P.boltCost) {
      p.energy -= P.boltCost; p.boltCd = P.boltCooldown;
      Game.spawnBolt(p);
      p.recoilT = 0.1; p.recoilVx = -p.facing * 160;
    }
  }

  // ---- move + collide
  var wasGround = p.onGround;
  var fallSpeed = p.vy;
  var mvx = p.vx + (p.recoilT > 0 ? p.recoilVx : 0);
  var r = World.moveBody(p, mvx * dt, p.vy * dt, true, p.dropT > 0);
  if (r.hitX) { if (p.dashT <= 0) p.vx = 0; }
  if (r.hitY < 0) { p.vy = 0; p.jumping = false; }
  p.onGround = World.onGround(p, p.dropT > 0);
  if (p.onGround) {
    if (p.vy > 0) p.vy = 0;
    p.airDash = true;
    if (!wasGround) {
      if (fallSpeed > 380) { p.sq = 0.78; Snd.play('land'); FX.dust(p.x + p.w / 2, p.y + p.h, fallSpeed > 700 ? 10 : 5); }
    }
  } else if (wasGround && !p.jumping && p.vy >= 0) {
    p.coyote = P.coyote;
  }
  // run animation + footstep dust
  if (p.onGround && Math.abs(p.vx) > 30) {
    p.runPhase += Math.abs(p.vx) * dt * 0.045;
    p.stepDust -= dt;
    if (p.stepDust <= 0 && Math.abs(p.vx) > 200) { p.stepDust = 0.18; FX.dust(p.x + p.w / 2 - p.facing * 6, p.y + p.h, 1); }
  }

  // wall contact
  p.wallDir = 0;
  if (!p.onGround) {
    if (World.rectSolid(p.x - 2, p.y + 6, 2, p.h - 14)) p.wallDir = -1;
    else if (World.rectSolid(p.x + p.w, p.y + 6, 2, p.h - 14)) p.wallDir = 1;
  }

  // safe ground for spike resets
  if (p.onGround && !playerStandingOnOneWayOnly(p) && !World.spikesNear(p)) { p.safeX = p.x; p.safeY = p.y; }
}

// hitbox of the current slash (world coords), or null
function playerSlashBox(p) {
  if (p.slashT <= 0 || p.dead) return null;
  var P = CFG.player;
  if (p.slashDir === 'up') return { x: p.x - 20, y: p.y - P.slashReachUp + 8, w: p.w + 40, h: P.slashReachUp };
  if (p.slashDir === 'down') return { x: p.x - 18, y: p.y + p.h - 12, w: p.w + 36, h: P.slashReachDown };
  if (p.facing > 0) return { x: p.x + p.w - 6, y: p.y - 8, w: P.slashReachFwd, h: p.h + 14 };
  return { x: p.x - P.slashReachFwd + 6, y: p.y - 8, w: P.slashReachFwd, h: p.h + 14 };
}

// called when a slash connects; kind: 'enemy' | 'pogo' (spikes/projectiles)
function playerSlashRecoil(p, canPogo) {
  var P = CFG.player;
  if (p.slashDir === 'down') {
    if (!p.pogoDone && canPogo) {
      p.pogoDone = true;
      p.vy = -P.pogoVel; p.jumping = false; p.airDash = true; p.dashCd = Math.min(p.dashCd, 0.05);
      p.sq = 1.2;
    }
  } else if (p.slashDir === 'fwd') {
    p.recoilT = 0.09; p.recoilVx = -p.facing * P.hitRecoil;
  } else if (p.slashDir === 'up') {
    if (p.vy < 0) p.vy *= 0.6;
  }
}
