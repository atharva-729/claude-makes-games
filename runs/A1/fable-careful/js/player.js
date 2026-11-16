// WICKFALL - player logic (the Wick).
var Player = (function () {
  var C = CFG.player;

  function create(x, y) {
    return {
      x: x - C.w / 2, y: y - C.h, w: C.w, h: C.h, vx: 0, vy: 0, dir: 1,
      onGround: false, hitL: false, hitR: false, hitCeil: false,
      health: C.maxHealth, maxHealth: C.maxHealth, energy: 0,
      invuln: 0, hurtLock: 0, dead: false,
      coyote: 0, jumpBuf: 0, jumping: false,
      dashT: 0, dashCd: 0, dashDir: 1, airDash: true, ghostT: 0,
      wallDir: 0, wallLock: 0,
      slash: null, slashCd: 0, atkBuf: 0,
      healing: false, healT: 0,
      animT: 0, landT: 0, safeX: x - C.w / 2, safeY: y - C.h, stepT: 0
    };
  }

  function approach(v, target, amount) {
    if (v < target) return Math.min(target, v + amount);
    return Math.max(target, v - amount);
  }

  function touchingWall(p, dir) {
    var px = dir > 0 ? p.x + p.w + 1 : p.x - 1;
    return Game.solidAtPx(px, p.y + p.h * 0.25) && Game.solidAtPx(px, p.y + p.h * 0.75);
  }

  // hit box of the current slash, in world space
  function slashBox(p, s) {
    var cx = p.x + p.w / 2, R = C.slashReach;
    if (s.type === 'up') return { x: cx - 30, y: p.y - R + 6, w: 60, h: R };
    if (s.type === 'down') return { x: cx - 28, y: p.y + p.h - 8, w: 56, h: R };
    if (s.dir > 0) return { x: cx, y: p.y - 10, w: R + 8, h: p.h + 16 };
    return { x: cx - R - 8, y: p.y - 10, w: R + 8, h: p.h + 16 };
  }

  function update(p, dt) {
    var I = Input, G = Game;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtLock = Math.max(0, p.hurtLock - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.slashCd = Math.max(0, p.slashCd - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.atkBuf = Math.max(0, p.atkBuf - dt);
    p.wallLock = Math.max(0, p.wallLock - dt);
    p.landT = Math.max(0, p.landT - dt);
    p.animT += dt;
    if (p.dead) return;

    var free = p.hurtLock <= 0;
    var mx = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
    if (I.pressed.jump) p.jumpBuf = C.jumpBuffer;
    if (I.pressed.attack) p.atkBuf = C.attackBuffer;

    // ---- heal: hold still on the ground, vulnerable throughout
    var wantHeal = I.down.heal && p.onGround && free && p.dashT <= 0 && !p.slash &&
      p.health < p.maxHealth && p.energy >= C.healCost && !I.pressed.jump && !I.pressed.dash && p.atkBuf <= 0;
    if (wantHeal) {
      if (!p.healing) { p.healing = true; p.healT = 0; Sound.play('healCharge'); }
      p.healT += dt; mx = 0;
      if (Math.random() < 0.5) {
        var a = Math.random() * 6.28, r = 34;
        G.addParticle({ x: p.x + p.w / 2 + Math.cos(a) * r, y: p.y + p.h / 2 + Math.sin(a) * r, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, life: 0.45, size: 2.2, color: CFG.colors.gold, type: 'dot' });
      }
      if (p.healT >= C.healTime) {
        p.health = Math.min(p.maxHealth, p.health + 1);
        p.energy -= C.healCost; p.healT = 0; p.healing = false;
        Sound.play('heal');
        G.burst(p.x + p.w / 2, p.y + p.h / 2, 18, { color: CFG.colors.gold, speed: 170, life: 0.6, type: 'dot', g: -200 });
        G.addParticle({ x: p.x + p.w / 2, y: p.y + p.h / 2, life: 0.4, size: 10, grow: 160, color: CFG.colors.gold, type: 'ring' });
      }
    } else { p.healing = false; p.healT = 0; }

    // ---- dash
    if (I.pressed.dash && p.dashCd <= 0 && free && p.dashT <= 0 && (p.onGround || p.airDash)) {
      var dd = mx !== 0 ? mx : p.dir;
      if (p.wallDir !== 0) dd = -p.wallDir;
      p.dashDir = dd; p.dir = dd;
      p.dashT = C.dashTime; p.dashCd = C.dashCooldown + C.dashTime;
      if (!p.onGround) p.airDash = false;
      p.slash = null; p.jumping = false; p.wallLock = 0;
      Sound.play('dash');
      G.burst(p.x + p.w / 2, p.y + p.h / 2, 8, { color: CFG.colors.cyan, speed: 120, life: 0.3, type: 'spark', dirX: -dd });
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * C.dashSpeed; p.vy = 0;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.028; G.addGhost(p); }
      if (p.dashT <= 0) p.vx = p.dashDir * C.runSpeed;
    } else {
      // ---- run
      if (free && p.wallLock <= 0) {
        var target = mx * C.runSpeed;
        var acc = p.onGround ? (mx !== 0 ? C.accel : C.friction) : (mx !== 0 ? C.airAccel : C.airAccel * 0.55);
        p.vx = approach(p.vx, target, acc * dt);
        if (mx !== 0 && !p.slash) p.dir = mx;
      }
      // ---- gravity
      p.vy = Math.min(C.maxFall, p.vy + C.gravity * dt);

      // ---- walls
      var tl = !p.onGround && touchingWall(p, -1), tr = !p.onGround && touchingWall(p, 1);
      var touch = tl ? -1 : (tr ? 1 : 0);
      p.wallDir = 0;
      if (touch !== 0 && mx === touch && p.vy > 0 && free) {
        p.wallDir = touch;
        p.vy = Math.min(p.vy, C.wallSlideSpeed);
        p.airDash = true;
        if (Math.random() < 0.3) G.addParticle({ x: touch > 0 ? p.x + p.w : p.x, y: p.y + p.h - 4, vx: -touch * 20, vy: -20, life: 0.35, size: 2, color: [160, 200, 210], type: 'dot' });
      }

      // ---- jump / wall jump
      if (p.jumpBuf > 0 && free) {
        if (p.onGround || p.coyote > 0) {
          p.vy = -C.jumpVel; p.jumping = true; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
          Sound.play('jump');
          G.burst(p.x + p.w / 2, p.y + p.h, 5, { color: [150, 190, 200], speed: 70, life: 0.3, type: 'dot', up: true });
        } else if (touch !== 0) {
          p.vy = -C.wallJumpY; p.vx = -touch * C.wallJumpX; p.dir = -touch;
          p.wallLock = C.wallJumpLock; p.jumping = false; p.jumpBuf = 0; p.wallDir = 0; // full height, always
          Sound.play('jump');
          G.burst(touch > 0 ? p.x + p.w : p.x, p.y + p.h * 0.6, 6, { color: [150, 190, 200], speed: 90, life: 0.3, type: 'dot' });
        }
      }
      if (p.jumping && p.vy >= 0) p.jumping = false;
      if (p.jumping && !I.down.jump && p.vy < 0) { p.vy *= C.jumpCut; p.jumping = false; }
    }

    // ---- move and collide
    var wasGround = p.onGround, fallV = p.vy;
    G.moveBody(p, p.vx * dt, p.vy * dt);
    if (p.onGround) {
      p.coyote = C.coyote; p.airDash = true; p.wallDir = 0;
      if (!wasGround && fallV > 250) {
        p.landT = 0.12; Sound.play('land');
        G.burst(p.x + p.w / 2, p.y + p.h, 7, { color: [150, 190, 200], speed: 90, life: 0.35, type: 'dot', up: true });
      }
      if (Math.abs(p.vx) > 120) {
        p.stepT -= dt;
        if (p.stepT <= 0) { p.stepT = 0.2; G.addParticle({ x: p.x + p.w / 2, y: p.y + p.h, vx: -p.vx * 0.1, vy: -25, life: 0.3, size: 2, color: [120, 160, 170], type: 'dot' }); }
      }
      // remember the last safe footing for spike respawns
      if (G.isSafeGround(p)) { p.safeX = p.x; p.safeY = p.y; }
    }

    // ---- slash
    if (p.atkBuf > 0 && p.slashCd <= 0 && p.dashT <= 0 && free) {
      var type = I.down.up ? 'up' : ((I.down.down && !p.onGround) ? 'down' : 'fwd');
      var sdir = p.wallDir !== 0 ? -p.wallDir : p.dir;
      p.slash = { type: type, t: 0, dir: sdir, hit: [], hitAny: false, spike: false };
      p.slashCd = C.slashCooldown; p.atkBuf = 0;
      Sound.play('slash');
      var sx = type === 'fwd' ? sdir : 0, sy = type === 'up' ? -1 : (type === 'down' ? 1 : 0);
      for (var si = 0; si < 5; si++) {
        G.addParticle({ x: p.x + p.w / 2 + sx * 34 + (Math.random() - 0.5) * 30, y: p.y + p.h / 2 + sy * 34 + (Math.random() - 0.5) * 30,
          vx: sx * (120 + Math.random() * 160) + (Math.random() - 0.5) * 60, vy: sy * (120 + Math.random() * 160) + (Math.random() - 0.5) * 60,
          life: 0.22, size: 2, color: CFG.colors.cyan, type: 'spark' });
      }
    }
    if (p.slash) {
      if (p.slash.t < C.slashActive) G.resolveSlash(p, p.slash);
      p.slash.t += dt;
      if (p.slash.t >= C.slashShow) p.slash = null;
    }

    // ---- energy bolt
    if (I.pressed.bolt && free && p.dashT <= 0 && p.energy >= C.boltCost) {
      p.energy -= C.boltCost;
      var bd = p.wallDir !== 0 ? -p.wallDir : p.dir;
      G.spawnProjectile({ kind: 'bolt', friendly: true, x: p.x + p.w / 2 + bd * 16, y: p.y + p.h * 0.42, vx: bd * C.boltSpeed, vy: 0, r: 9, g: 0, life: C.boltLife, damage: C.boltDamage });
      p.vx -= bd * 120;
      Sound.play('bolt');
      G.burst(p.x + p.w / 2 + bd * 18, p.y + p.h * 0.42, 10, { color: CFG.colors.cyan, speed: 200, life: 0.3, type: 'spark', dirX: bd });
    }
  }

  return { create: create, update: update, slashBox: slashBox };
})();
