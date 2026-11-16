// Input, physics, collisions, camera, game state and HUD.
(function () {
  'use strict';

  var C = window.CONFIG;
  var A = window.Assets;
  var COL = C.colors;
  var T = C.tileSize;
  var VW = C.view.width;
  var VH = C.view.height;
  var STEP = 1 / C.physicsHz;
  var EPS = 1e-4;

  // ------------------------------------------------------------------ helpers
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function approach(v, target, delta) { return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target); }
  // Frame-rate independent exponential lerp factor.
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function formatTime(t) {
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    var cs = Math.floor((t * 100) % 100);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  }

  // -------------------------------------------------------------------- level
  function parseLevel(rows, signs) {
    var h = rows.length, w = 0, tx, ty;
    for (ty = 0; ty < h; ty++) w = Math.max(w, rows[ty].length);
    var lv = { w: w, h: h, tiles: [], coins: [], checkpoints: [], signs: [], start: null, flag: null };
    for (ty = 0; ty < h; ty++) {
      var row = [];
      for (tx = 0; tx < w; tx++) {
        var ch = rows[ty].charAt(tx) || '.';
        var tile = '.';
        if (ch === '#' || ch === '=' || ch === '^') tile = ch;
        else if (ch === 'o') lv.coins.push({ x: tx * T + T / 2, y: ty * T + T / 2, phase: tx * 0.7, taken: false });
        else if (ch === 'P') lv.start = { x: tx * T + (T - C.player.width) / 2, y: (ty + 1) * T - C.player.height };
        else if (ch === 'F') lv.flag = { tx: tx, ty: ty, x: tx * T, y: ty * T };
        else if (ch === 'C') lv.checkpoints.push({ tx: tx, ty: ty, x: tx * T, y: ty * T, active: false });
        row.push(tile);
      }
      lv.tiles.push(row);
    }
    if (!lv.start) lv.start = { x: T, y: 0 };
    (signs || []).forEach(function (s) { lv.signs.push({ x: s.col * T, y: s.row * T, text: s.text }); });
    lv.pixelW = w * T;
    lv.pixelH = h * T;
    return lv;
  }

  // Outside the map: solid walls left/right, open sky above, open pit below.
  function tileAt(lv, tx, ty) {
    if (tx < 0 || tx >= lv.w) return '#';
    if (ty < 0 || ty >= lv.h) return '.';
    return lv.tiles[ty][tx];
  }

  function isSolid(lv, tx, ty) { return tileAt(lv, tx, ty) === '#'; }

  function rectHitsSolid(lv, x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - EPS) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - EPS) / T);
    for (var ty = y0; ty <= y1; ty++)
      for (var tx = x0; tx <= x1; tx++)
        if (isSolid(lv, tx, ty)) return true;
    return false;
  }

  // ------------------------------------------------------------------- player
  function createPlayer(spawn) {
    return {
      x: spawn.x, y: spawn.y, px: spawn.x, py: spawn.y,
      w: C.player.width, h: C.player.height,
      vx: 0, vy: 0,
      onGround: false, groundOneWay: false,
      coyote: 0, jumpBuffer: 0, dropTimer: 0, jumping: false,
      facing: 1, scaleX: 1, scaleY: 1, animTime: 0
    };
  }

  // Horizontal move + resolve. Per-step movement is always < one tile, so only
  // the column the leading edge moved into needs checking. The vertical tile
  // range uses (bottom - EPS), so the floor we stand on is never tested here:
  // that is what prevents snagging on tile seams.
  function moveX(lv, p, dx) {
    if (dx === 0) return;
    p.x += dx;
    var y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - EPS) / T), ty, tx;
    if (dx > 0) {
      tx = Math.floor((p.x + p.w - EPS) / T);
      for (ty = y0; ty <= y1; ty++) {
        if (isSolid(lv, tx, ty)) { p.x = tx * T - p.w; p.vx = 0; return; }
      }
    } else {
      tx = Math.floor(p.x / T);
      for (ty = y0; ty <= y1; ty++) {
        if (isSolid(lv, tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; return; }
      }
    }
  }

  function rowHitsSolid(lv, x, w, ty) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - EPS) / T);
    for (var tx = x0; tx <= x1; tx++) if (isSolid(lv, tx, ty)) return true;
    return false;
  }

  // Vertical move + resolve (solid tiles, and one-way tiles from above only).
  function moveY(lv, p, dy) {
    var prevBottom = p.y + p.h;
    p.y += dy;
    p.onGround = false;
    var x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - EPS) / T), tx, ty;
    if (dy > 0) {
      ty = Math.floor((p.y + p.h - EPS) / T);
      var top = ty * T;
      var landed = false, oneWayOnly = true;
      for (tx = x0; tx <= x1; tx++) {
        var t = tileAt(lv, tx, ty);
        if (t === '#') { landed = true; oneWayOnly = false; }
        else if (t === '=' && p.dropTimer <= 0 && prevBottom <= top + EPS) landed = true;
      }
      if (landed) {
        p.y = top - p.h;
        p.vy = 0;
        p.onGround = true;
        p.groundOneWay = oneWayOnly;
      }
    } else if (dy < 0) {
      ty = Math.floor(p.y / T);
      if (rowHitsSolid(lv, p.x, p.w, ty)) {
        // Corner correction: barely clipping a ceiling edge nudges us around it.
        for (var s = 1; s <= C.cornerCorrection; s++) {
          for (var dir = -1; dir <= 1; dir += 2) {
            var nx = p.x + s * dir;
            if (!rowHitsSolid(lv, nx, p.w, ty) && !rectHitsSolid(lv, nx, p.y, p.w, p.h)) { p.x = nx; return; }
          }
        }
        p.y = (ty + 1) * T;
        p.vy = 0;
        p.jumping = false;
      }
    }
  }

  function touchesSpikes(lv, p) {
    var x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - EPS) / T);
    var y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - EPS) / T);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (tileAt(lv, tx, ty) !== '^') continue;
        var sx0 = tx * T + C.spikeInsetX, sx1 = (tx + 1) * T - C.spikeInsetX;
        var sy0 = ty * T + C.spikeInsetTop, sy1 = (ty + 1) * T;
        if (p.x < sx1 && p.x + p.w > sx0 && p.y < sy1 && p.y + p.h > sy0) return true;
      }
    }
    return false;
  }

  function overlaps(p, x0, y0, x1, y1) {
    return p.x < x1 && p.x + p.w > x0 && p.y < y1 && p.y + p.h > y0;
  }

  // -------------------------------------------------------------------- world
  function createWorld() {
    var lv = parseLevel(window.LEVEL, window.LEVEL_SIGNS);
    var w = {
      level: lv,
      player: createPlayer(lv.start),
      respawn: { x: lv.start.x, y: lv.start.y },
      coinsTotal: lv.coins.length,
      coinsTaken: 0,
      deaths: 0,
      time: 0,
      clock: 0, // animation clock, always runs
      dying: false,
      deathTimer: 0,
      flash: 0,
      completed: false,
      particles: [],
      camera: { x: 0, y: 0, px: 0, py: 0, look: 0 }
    };
    snapCamera(w);
    return w;
  }

  function spawnParticles(w, x, y, n, color, speed, up, life, size, gravity) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = speed * (0.4 + Math.random() * 0.6);
      var ml = life * (0.6 + Math.random() * 0.4);
      w.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * (up ? 0.5 : 1) - (up ? speed * 0.5 : 0),
        life: ml, maxLife: ml, color: color, size: size, gravity: gravity
      });
    }
  }

  function updateParticles(w, dt) {
    var list = w.particles;
    for (var i = list.length - 1; i >= 0; i--) {
      var q = list[i];
      q.life -= dt;
      if (q.life <= 0) { list.splice(i, 1); continue; }
      q.vy += q.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }

  function kill(w) {
    var p = w.player;
    w.dying = true;
    w.deathTimer = C.deathDuration;
    w.flash = 1;
    w.deaths++;
    var cx = p.x + p.w / 2, cy = Math.min(p.y + p.h / 2, w.level.pixelH);
    spawnParticles(w, cx, cy, 26, COL.player, 320, true, 0.7, 5, 900);
    spawnParticles(w, cx, cy, 10, COL.playerLight, 220, true, 0.6, 4, 900);
  }

  function respawn(w) {
    var p = createPlayer(w.respawn);
    p.facing = 1;
    w.player = p;
    w.dying = false;
    snapCamera(w);
  }

  function cameraTarget(w) {
    var p = w.player, cam = w.camera, lv = w.level, cc = C.camera;
    var tx = p.x + p.w / 2 - VW / 2 + cam.look;
    var ty = p.y + p.h / 2 - VH * cc.verticalAnchor;
    return {
      x: clamp(tx, 0, Math.max(0, lv.pixelW - VW)),
      y: clamp(ty, 0, Math.max(0, lv.pixelH - VH))
    };
  }

  function snapCamera(w) {
    w.camera.look = 0;
    var t = cameraTarget(w);
    w.camera.x = w.camera.px = t.x;
    w.camera.y = w.camera.py = t.y;
  }

  function updateCamera(w, dt) {
    var cam = w.camera, p = w.player, cc = C.camera;
    cam.px = cam.x;
    cam.py = cam.y;
    // Look-ahead follows the direction of movement (scaled by speed).
    var lookTarget = clamp(p.vx / C.runSpeed, -1, 1) * cc.lookAhead;
    cam.look = lerp(cam.look, lookTarget, damp(cc.lookAheadRate, dt));
    var t = cameraTarget(w);
    cam.x = lerp(cam.x, t.x, damp(cc.followRate, dt));
    cam.y = lerp(cam.y, t.y, damp(cc.verticalRate, dt));
  }

  // One fixed simulation step. input = { left, right, down, jumpHeld, jumpPressed }.
  function stepWorld(w, input, dt) {
    w.clock += dt;
    w.flash = Math.max(0, w.flash - dt / C.deathFlashTime);
    updateParticles(w, dt);

    if (w.completed) return;

    if (w.dying) {
      w.deathTimer -= dt;
      if (w.deathTimer <= 0) respawn(w);
      w.player.px = w.player.x;
      w.player.py = w.player.y;
      w.camera.px = w.camera.x;
      w.camera.py = w.camera.y;
      return;
    }

    var lv = w.level, p = w.player;
    p.px = p.x;
    p.py = p.y;

    // --- timers
    p.jumpBuffer = input.jumpPressed ? C.jumpBufferTime : Math.max(0, p.jumpBuffer - dt);
    p.dropTimer = Math.max(0, p.dropTimer - dt);
    p.coyote = p.onGround ? C.coyoteTime : Math.max(0, p.coyote - dt);

    // --- horizontal: accelerate toward target speed, less grip in the air
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var accel, decel, turn;
    if (p.onGround) { accel = C.groundAccel; decel = C.groundDecel; turn = C.groundTurnAccel; }
    else { accel = C.airAccel; decel = C.airDecel; turn = C.airTurnAccel; }
    if (dir !== 0) {
      var rate = (p.vx * dir < 0) ? turn : accel;
      p.vx = approach(p.vx, dir * C.runSpeed, rate * dt);
      p.facing = dir;
    } else {
      p.vx = approach(p.vx, 0, decel * dt);
    }

    // --- jump / drop-through
    if (p.jumpBuffer > 0) {
      if (input.down && p.onGround && p.groundOneWay) {
        p.dropTimer = C.dropThroughTime;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.y += 1;
      } else if (p.coyote > 0) {
        p.vy = -C.jumpVelocity;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.jumping = true;
        p.scaleX = 0.78;
        p.scaleY = 1.22;
        spawnParticles(w, p.x + p.w / 2, p.y + p.h, 5, COL.dust, 80, true, 0.3, 4, 200);
      }
    }

    // --- variable jump height: releasing early cuts the rise
    if (p.jumping) {
      if (p.vy >= 0) p.jumping = false;
      else if (!input.jumpHeld) { p.vy *= C.jumpCutMultiplier; p.jumping = false; }
    }

    // --- gravity with terminal velocity
    var g = C.gravity * (p.vy > 0 ? C.fallGravityMultiplier : 1);
    p.vy = Math.min(p.vy + g * dt, C.maxFallSpeed);

    // --- move: X then Y
    var wasOnGround = p.onGround;
    var impact = p.vy;
    moveX(lv, p, p.vx * dt);
    moveY(lv, p, p.vy * dt);

    if (p.onGround && !wasOnGround) {
      var k = clamp(impact / C.maxFallSpeed, 0, 1);
      p.scaleX = 1 + 0.3 * k;
      p.scaleY = 1 - 0.3 * k;
      if (impact > C.landDustSpeed) spawnParticles(w, p.x + p.w / 2, p.y + p.h, 6, COL.dust, 90, true, 0.3, 4, 300);
    }
    var sr = damp(C.squashRecoverRate, dt);
    p.scaleX = lerp(p.scaleX, 1, sr);
    p.scaleY = lerp(p.scaleY, 1, sr);
    p.animTime = (p.onGround && Math.abs(p.vx) > 20) ? p.animTime + dt : 0;

    // --- coins
    var r = C.coinRadius;
    for (var i = 0; i < lv.coins.length; i++) {
      var c = lv.coins[i];
      if (!c.taken && overlaps(p, c.x - r, c.y - r, c.x + r, c.y + r)) {
        c.taken = true;
        w.coinsTaken++;
        spawnParticles(w, c.x, c.y, 8, COL.coinShine, 120, false, 0.35, 3, 0);
      }
    }

    // --- checkpoints
    for (i = 0; i < lv.checkpoints.length; i++) {
      var cp = lv.checkpoints[i];
      if (!cp.active && overlaps(p, cp.x, cp.y - T, cp.x + T, cp.y + T)) {
        cp.active = true;
        w.respawn = { x: cp.x + (T - p.w) / 2, y: cp.y + T - p.h };
        spawnParticles(w, cp.x + T / 2, cp.y, 12, COL.checkpointOn, 150, true, 0.5, 4, 300);
      }
    }

    // --- goal
    var f = lv.flag;
    if (f && overlaps(p, f.x + 6, f.y - 2 * T, f.x + T - 6, f.y + T)) {
      w.completed = true;
      p.vx = 0;
      for (i = 0; i < 4; i++) {
        spawnParticles(w, f.x + T / 2, f.y - 2 * T, 14, [COL.coin, COL.player, COL.checkpointOn, '#6fb7ff'][i], 360, true, 1.4, 5, 500);
      }
    }

    // --- hazards
    if (!w.completed && (touchesSpikes(lv, p) || p.y > lv.pixelH + C.fallDeathMargin)) kill(w);

    updateCamera(w, dt);
  }

  // Expose the simulation for automated tests.
  window.Game = {
    createWorld: createWorld,
    stepWorld: stepWorld,
    STEP: STEP,
    formatTime: formatTime
  };

  if (window.__NO_AUTOSTART) return;

  // ==================================================================== app
  var canvas, ctx;
  var app = { state: 'title', world: null, best: null, hintTime: 0, menuClock: 0 };
  window.Game.app = app; // debug handle (inspect state from the console)

  // ---------------------------------------------------------------- input
  var keys = {};
  var pressed = { jump: false, start: false, pause: false, restart: false };
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump'
  };
  var BLOCK_DEFAULT = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1 };

  function onKeyDown(e) {
    var code = e.code;
    if (BLOCK_DEFAULT[code]) e.preventDefault();
    var action = KEYMAP[code];
    if (!e.repeat) {
      if (action === 'jump') pressed.jump = true;
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') pressed.start = true;
      if (code === 'KeyP' || code === 'Escape') pressed.pause = true;
      if (code === 'KeyR') pressed.restart = true;
    }
    if (action) keys[action] = true;
  }

  function onKeyUp(e) {
    var action = KEYMAP[e.code];
    if (BLOCK_DEFAULT[e.code]) e.preventDefault();
    if (action) {
      // Two keys can map to one action: only release when none is held.
      keys[action] = false;
      for (var code in heldCodes) if (heldCodes[code] && KEYMAP[code] === action && code !== e.code) keys[action] = true;
    }
  }

  // Track physical keys so releasing A doesn't cancel a still-held ArrowLeft.
  var heldCodes = {};
  window.addEventListener('keydown', function (e) { heldCodes[e.code] = true; onKeyDown(e); });
  window.addEventListener('keyup', function (e) { heldCodes[e.code] = false; onKeyUp(e); });
  window.addEventListener('blur', function () {
    keys = {};
    heldCodes = {};
    if (app.state === 'playing') app.state = 'paused';
  });

  function readInput() {
    return {
      left: !!keys.left, right: !!keys.right, down: !!keys.down,
      jumpHeld: !!keys.jump, jumpPressed: pressed.jump
    };
  }

  function clearPressed() {
    pressed.jump = pressed.start = pressed.pause = pressed.restart = false;
  }

  // ---------------------------------------------------------------- state
  function startGame() {
    app.world = createWorld();
    app.state = 'playing';
    app.hintTime = 0;
  }

  function loadBest() {
    try { var v = parseFloat(window.localStorage.getItem('platformer-best-time')); return isFinite(v) ? v : null; }
    catch (e) { return null; }
  }

  function saveBest(t) {
    try { window.localStorage.setItem('platformer-best-time', String(t)); } catch (e) { /* storage unavailable */ }
  }

  var IDLE_INPUT = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false };

  function update(dt) {
    var w = app.world;
    app.menuClock += dt;
    switch (app.state) {
      case 'title':
        w.clock += dt;
        if (pressed.start) startGame();
        break;
      case 'playing':
        if (pressed.restart) { startGame(); break; }
        if (pressed.pause) { app.state = 'paused'; break; }
        w.time += dt;
        app.hintTime += dt;
        stepWorld(w, readInput(), dt);
        if (w.completed) {
          app.state = 'complete';
          app.newBest = app.best === null || w.time < app.best;
          if (app.newBest) { app.best = w.time; saveBest(w.time); }
        }
        break;
      case 'paused':
        if (pressed.restart) { startGame(); break; }
        if (pressed.pause) app.state = 'playing';
        break;
      case 'complete':
        stepWorld(w, IDLE_INPUT, dt); // keeps particles/animation going
        if (pressed.restart) startGame();
        break;
    }
    clearPressed();
  }

  // --------------------------------------------------------------- render
  function text(str, x, y, size, color, align, baseline) {
    ctx.font = 'bold ' + size + 'px monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'top';
    var o = Math.max(2, Math.round(size / 10));
    ctx.fillStyle = COL.hudShadow;
    ctx.fillText(str, x + o, y + o);
    ctx.fillStyle = color || COL.hudText;
    ctx.fillText(str, x, y);
  }

  function drawWorld(w, alpha) {
    var lv = w.level, cam = w.camera, p = w.player;
    var camX = Math.round(lerp(cam.px, cam.x, alpha));
    var camY = Math.round(lerp(cam.py, cam.y, alpha));

    A.drawBackground(ctx, camX, camY, VW, VH, w.clock);

    ctx.save();
    ctx.translate(-camX, -camY);

    var tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(lv.w - 1, Math.floor((camX + VW) / T));
    var ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(lv.h - 1, Math.floor((camY + VH) / T));
    var i;

    for (i = 0; i < lv.signs.length; i++) {
      var s = lv.signs[i];
      if (s.x > camX - 200 && s.x < camX + VW + 200) A.drawSign(ctx, s);
    }

    var info = { tx: 0, ty: 0, top: false, left: false, right: false };
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var t = lv.tiles[ty][tx];
        if (t === '.') continue;
        info.tx = tx; info.ty = ty;
        info.top = !isSolid(lv, tx, ty - 1) && ty > 0;
        info.left = !isSolid(lv, tx - 1, ty);
        info.right = !isSolid(lv, tx + 1, ty);
        A.drawTile(ctx, t, tx * T, ty * T, info);
      }
    }

    for (i = 0; i < lv.checkpoints.length; i++) A.drawCheckpoint(ctx, lv.checkpoints[i], w.clock);
    if (lv.flag) A.drawFlag(ctx, lv.flag, w.clock, w.completed);

    for (i = 0; i < lv.coins.length; i++) {
      var c = lv.coins[i];
      if (!c.taken && c.x > camX - T && c.x < camX + VW + T) A.drawCoin(ctx, c, w.clock);
    }

    if (!w.dying) {
      A.drawPlayer(ctx, p, Math.round(lerp(p.px, p.x, alpha)), Math.round(lerp(p.py, p.y, alpha)));
    }

    for (i = 0; i < w.particles.length; i++) A.drawParticle(ctx, w.particles[i]);

    ctx.restore();

    if (w.flash > 0) {
      ctx.globalAlpha = Math.min(1, w.flash * 0.85);
      ctx.fillStyle = COL.deathFlash;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  function drawHUD(w) {
    ctx.fillStyle = COL.hudPanel;
    ctx.fillRect(10, 10, 270, 38);
    ctx.fillRect(VW - 170, 10, 160, 38);
    A.drawCoinIcon(ctx, 30, 29);
    text(w.coinsTaken + '/' + w.coinsTotal, 46, 19, 20, COL.accent);
    text('Deaths ' + w.deaths, 140, 19, 20, COL.hudText);
    text(formatTime(w.time), VW - 22, 19, 20, COL.hudText, 'right');
  }

  function drawHint() {
    var t = app.hintTime;
    var dur = C.hintDuration;
    if (t > dur) return;
    var a = t > dur - C.hintFade ? (dur - t) / C.hintFade : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = COL.hudPanel;
    ctx.fillRect(VW / 2 - 330, 60, 660, 56);
    text('Move: ← → / A D     Jump: Space / ↑ / W', VW / 2, 68, 16, COL.hudText, 'center');
    text('Drop through: ↓ + Jump     Pause: P / Esc     Restart: R', VW / 2, 92, 16, COL.hudText, 'center');
    ctx.globalAlpha = 1;
  }

  function overlay() {
    ctx.fillStyle = COL.overlay;
    ctx.fillRect(0, 0, VW, VH);
  }

  function blink() { return Math.floor(app.menuClock * 2.2) % 2 === 0; }

  function render(alpha) {
    var w = app.world;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawWorld(w, app.state === 'playing' ? alpha : 1);

    if (app.state === 'title') {
      overlay();
      text('PIP\'S DASH', VW / 2, 140, 64, COL.accent, 'center');
      text('A tiny platformer', VW / 2, 222, 20, COL.hudText, 'center');
      if (blink()) text('Press Enter or Space to start', VW / 2, 300, 24, COL.hudText, 'center');
      text('← → / A D  move     Space / ↑ / W  jump     ↓ + Jump  drop', VW / 2, 400, 16, COL.hudText, 'center');
      text('P / Esc  pause     R  restart', VW / 2, 426, 16, COL.hudText, 'center');
      if (app.best !== null) text('Best time ' + formatTime(app.best), VW / 2, 470, 16, COL.accent, 'center');
      return;
    }

    drawHUD(w);

    if (app.state === 'playing') {
      drawHint();
    } else if (app.state === 'paused') {
      overlay();
      text('Paused', VW / 2, 200, 48, COL.accent, 'center');
      text('Press P or Esc to resume', VW / 2, 280, 22, COL.hudText, 'center');
      text('Press R to restart', VW / 2, 316, 18, COL.hudText, 'center');
    } else if (app.state === 'complete') {
      overlay();
      text('Level complete!', VW / 2, 120, 52, COL.accent, 'center');
      text('Time    ' + formatTime(w.time), VW / 2, 215, 24, COL.hudText, 'center');
      text('Coins   ' + w.coinsTaken + ' / ' + w.coinsTotal, VW / 2, 252, 24, COL.hudText, 'center');
      text('Deaths  ' + w.deaths, VW / 2, 289, 24, COL.hudText, 'center');
      if (app.newBest) text('New best time!', VW / 2, 334, 20, COL.checkpointOn, 'center');
      else if (app.best !== null) text('Best ' + formatTime(app.best), VW / 2, 334, 20, COL.hudText, 'center');
      if (blink()) text('Press R to play again', VW / 2, 400, 26, COL.hudText, 'center');
    }
  }

  // ----------------------------------------------------------- boot + loop
  function resize() {
    var s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
  }

  function boot() {
    canvas = document.getElementById('game');
    canvas.width = VW;
    canvas.height = VH;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    var bs = document.body.style;
    bs.margin = '0';
    bs.height = '100vh';
    bs.overflow = 'hidden';
    bs.background = COL.background;
    bs.display = 'flex';
    bs.alignItems = 'center';
    bs.justifyContent = 'center';
    document.documentElement.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.imageRendering = 'pixelated';
    canvas.tabIndex = 0;
    canvas.focus();

    window.addEventListener('resize', resize);
    resize();

    A.init();
    app.best = loadBest();
    app.world = createWorld();

    var acc = 0;
    var last = performance.now();
    document.addEventListener('visibilitychange', function () { last = performance.now(); });

    function frame(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > C.maxFrameTime) dt = C.maxFrameTime; // clamp hitches: no spiral of death, no tunneling
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
      render(acc / STEP);
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
