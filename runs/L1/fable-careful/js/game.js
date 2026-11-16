// Input, physics, collisions, camera, game state and HUD.
// Entity drawing is delegated to Assets (assets.js); numbers come from CONFIG.
var Game = (function () {
  'use strict';

  var C = CONFIG, T = C.tile, col = C.colors;
  var STEP = 1 / C.logicHz;
  var EPS = 0.001;
  var VW = C.viewWidth, VH = C.viewHeight;

  // ------------------------------------------------------------------ canvas
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  canvas.width = VW;
  canvas.height = VH;

  (function setupPage() {
    var html = document.documentElement.style, body = document.body.style, cs = canvas.style;
    html.height = '100%';
    body.height = '100%';
    body.margin = '0';
    body.overflow = 'hidden';
    body.background = col.page;
    cs.display = 'block';
    cs.position = 'absolute';
    cs.imageRendering = 'pixelated';
  })();

  function fitCanvas() {
    var ww = window.innerWidth, wh = window.innerHeight;
    var s = Math.min(ww / VW, wh / VH);
    if (!(s > 0)) s = 1;
    var w = Math.floor(VW * s), h = Math.floor(VH * s);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.left = Math.floor((ww - w) / 2) + 'px';
    canvas.style.top = Math.floor((wh - h) / 2) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // ------------------------------------------------------------------- level
  var grid = [];            // grid[ty][tx] is '#', '=', '^' or '.'
  var coins = [];
  var checkpoints = [];
  var startTile = { tx: 1, ty: 1 };
  var flag = null;
  var LH = LEVEL.length, LW = 0;

  (function parseLevel() {
    var ty, tx;
    for (ty = 0; ty < LH; ty++) LW = Math.max(LW, LEVEL[ty].length);
    for (ty = 0; ty < LH; ty++) {
      var row = [];
      for (tx = 0; tx < LW; tx++) {
        var ch = LEVEL[ty].charAt(tx) || '.';
        if (ch === 'o') coins.push({ x: tx * T + T / 2, y: ty * T + T / 2, taken: false });
        else if (ch === 'P') startTile = { tx: tx, ty: ty };
        else if (ch === 'F') flag = { tx: tx, ty: ty, x: tx * T, y: ty * T };
        else if (ch === 'C') checkpoints.push({ tx: tx, ty: ty, x: tx * T, y: ty * T, active: false });
        row.push(ch === '#' || ch === '=' || ch === '^' ? ch : '.');
      }
      grid.push(row);
    }
  })();

  var levelW = LW * T, levelH = LH * T;

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= LW || ty < 0 || ty >= LH) return '.';
    return grid[ty][tx];
  }

  // ------------------------------------------------------------------ player
  function newPlayer(tx, ty) {
    var x = tx * T + (T - C.playerWidth) / 2;
    var y = (ty + 1) * T - C.playerHeight;
    return {
      x: x, y: y, prevX: x, prevY: y,
      w: C.playerWidth, h: C.playerHeight,
      vx: 0, vy: 0, facing: 1,
      onGround: false, onOneWay: false,
      coyote: 0, jumpBuffer: 0, dropTimer: 0, jumping: false,
      justJumped: false, justLanded: false, landSpeed: 0,
      animTime: 0, sx: 1, sy: 1
    };
  }

  function approach(v, target, amount) {
    if (v < target) return Math.min(v + amount, target);
    return Math.max(v - amount, target);
  }

  // One fixed step of player physics. Pure with respect to everything except
  // the player object, so it can be driven by real input or by a test script.
  // inp: { left, right, down, jump (held), jumpPressed (edge this step) }
  function stepPlayer(p, inp, dt) {
    p.justJumped = false;
    p.justLanded = false;

    // --- horizontal: accelerate toward the target speed
    var dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) {
      var turning = p.vx * dir < 0;
      var a = p.onGround ? (turning ? C.groundTurnAccel : C.groundAccel)
                         : (turning ? C.airTurnAccel : C.airAccel);
      p.vx = approach(p.vx, dir * C.runSpeed, a * dt);
      p.facing = dir;
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? C.groundFriction : C.airFriction) * dt);
    }

    // --- timers
    if (p.onGround) p.coyote = C.coyoteTime;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (inp.jumpPressed) p.jumpBuffer = C.jumpBuffer;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.dropTimer = Math.max(0, p.dropTimer - dt);

    // --- jump / drop through
    if (p.jumpBuffer > 0) {
      if (inp.down && p.onGround && p.onOneWay) {
        p.dropTimer = C.dropThroughTime;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
      } else if (p.coyote > 0) {
        p.vy = -C.jumpVelocity;
        p.jumping = true;
        p.justJumped = true;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
      }
    }

    // --- variable jump height
    if (p.jumping) {
      if (p.vy >= 0) p.jumping = false;
      else if (!inp.jump) { p.vy *= C.jumpCutMultiplier; p.jumping = false; }
    }

    // --- gravity with terminal velocity
    var g = C.gravity * (p.vy > 0 ? C.fallGravityMultiplier : 1);
    p.vy = Math.min(p.vy + g * dt, C.maxFallSpeed);

    moveX(p, p.vx * dt);
    moveY(p, p.vy * dt);
  }

  function moveX(p, dx) {
    p.x += dx;
    var ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + p.h - EPS) / T), ty, tx;
    if (dx > 0) {
      tx = Math.floor((p.x + p.w - EPS) / T);
      for (ty = ty0; ty <= ty1; ty++) {
        if (tileAt(tx, ty) === '#') { p.x = tx * T - p.w; p.vx = 0; break; }
      }
    } else if (dx < 0) {
      tx = Math.floor(p.x / T);
      for (ty = ty0; ty <= ty1; ty++) {
        if (tileAt(tx, ty) === '#') { p.x = (tx + 1) * T; p.vx = 0; break; }
      }
    }
    if (p.x < 0) { p.x = 0; if (p.vx < 0) p.vx = 0; }
    if (p.x > levelW - p.w) { p.x = levelW - p.w; if (p.vx > 0) p.vx = 0; }
  }

  function moveY(p, dy) {
    var prevBottom = p.y + p.h;
    var wasOnGround = p.onGround;
    var fallSpeed = p.vy;
    p.y += dy;
    p.onGround = false;
    p.onOneWay = false;
    var tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - EPS) / T), tx, ty, t;
    if (dy >= 0) {
      ty = Math.floor((p.y + p.h - EPS) / T);
      var hitSolid = false, hitOneWay = false;
      for (tx = tx0; tx <= tx1; tx++) {
        t = tileAt(tx, ty);
        if (t === '#') hitSolid = true;
        else if (t === '=' && p.dropTimer <= 0 && prevBottom <= ty * T + EPS) hitOneWay = true;
      }
      if (hitSolid || hitOneWay) {
        p.y = ty * T - p.h;
        p.vy = 0;
        p.onGround = true;
        p.onOneWay = !hitSolid;
        p.jumping = false;
        if (!wasOnGround) { p.justLanded = true; p.landSpeed = fallSpeed; }
      }
    } else {
      ty = Math.floor(p.y / T);
      for (tx = tx0; tx <= tx1; tx++) {
        if (tileAt(tx, ty) === '#') {
          p.y = (ty + 1) * T;
          p.vy = 0;
          p.jumping = false;
          break;
        }
      }
    }
  }

  function overlaps(p, x, y, w, h) {
    return p.x < x + w && p.x + p.w > x && p.y < y + h && p.y + p.h > y;
  }

  function touchesSpike(p) {
    var tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - EPS) / T);
    var ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + p.h - EPS) / T);
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (tileAt(tx, ty) === '^' &&
            overlaps(p, tx * T + C.spikeInset, (ty + 1) * T - C.spikeHeight,
                     T - 2 * C.spikeInset, C.spikeHeight)) return true;
      }
    }
    return false;
  }

  function fellOut(p) { return p.y > levelH + C.fallDeathMargin; }

  function atGoal(p) {
    return !!flag && overlaps(p, flag.x + 6, flag.y - T, T - 12, T * 2);
  }

  // ------------------------------------------------------------------- input
  var keys = {};
  var jumpPressed = false;
  var inputOverride = null; // used by automated tests only

  var JUMP_KEYS = { Space: 1, ArrowUp: 1, KeyW: 1 };
  var PREVENT = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };

  function readInput() {
    if (inputOverride) return inputOverride;
    return {
      left: !!(keys.ArrowLeft || keys.KeyA),
      right: !!(keys.ArrowRight || keys.KeyD),
      down: !!(keys.ArrowDown || keys.KeyS),
      jump: !!(keys.Space || keys.ArrowUp || keys.KeyW),
      jumpPressed: jumpPressed
    };
  }

  window.addEventListener('keydown', function (e) {
    var c = e.code;
    if (PREVENT[c]) e.preventDefault();
    if (e.repeat) return;
    initAudio();
    keys[c] = true;
    if (state === 'title') {
      if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') startGame();
      return;
    }
    if (c === 'KeyR') { startGame(); return; }
    if (c === 'KeyP' || c === 'Escape') {
      if (state === 'playing') state = 'paused';
      else if (state === 'paused') state = 'playing';
      return;
    }
    if (state === 'playing' && JUMP_KEYS[c]) jumpPressed = true;
  });

  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  function loseFocus() {
    keys = {};
    jumpPressed = false;
    if (state === 'playing') state = 'paused';
  }
  window.addEventListener('blur', loseFocus);
  document.addEventListener('visibilitychange', function () { if (document.hidden) loseFocus(); });

  // ------------------------------------------------------------------- sound
  var audio = null;

  function initAudio() {
    if (audio || !C.soundEnabled) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audio = new AC();
    } catch (err) { audio = null; }
  }

  function beep(freq, freqEnd, dur, type, delay) {
    if (!audio || inputOverride) return;
    try {
      var t0 = audio.currentTime + (delay || 0);
      var osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      gain.gain.setValueAtTime(C.soundVolume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) { /* sound is optional */ }
  }

  // -------------------------------------------------------------- game state
  var state = 'title';   // 'title' | 'playing' | 'paused' | 'complete'
  var player = newPlayer(startTile.tx, startTile.ty);
  var spawn = startTile;
  var cam = { x: 0, y: 0, prevX: 0, prevY: 0, look: 0 };
  var particles = [];
  var elapsed = 0, deaths = 0, coinCount = 0;
  var dead = false, deathTimer = 0;
  var hintTimer = 0;
  var uiTime = 0;

  function resetLevel() {
    var i;
    for (i = 0; i < coins.length; i++) coins[i].taken = false;
    for (i = 0; i < checkpoints.length; i++) checkpoints[i].active = false;
    spawn = startTile;
    elapsed = 0; deaths = 0; coinCount = 0;
    particles = [];
    respawn();
  }

  function respawn() {
    player = newPlayer(spawn.tx, spawn.ty);
    dead = false;
    cam.look = 0;
    snapCamera();
  }

  function startGame() {
    resetLevel();
    state = 'playing';
    jumpPressed = false;
    hintTimer = C.hintDuration;
  }

  function die() {
    dead = true;
    deathTimer = C.deathTime;
    deaths++;
    burst(player.x + player.w / 2, player.y + player.h / 2, 18, col.deathParticle, 260, 0.6, 5);
    beep(300, 60, 0.35, 'sawtooth');
  }

  // ---------------------------------------------------------------- particles
  function burst(x, y, n, color, speed, life, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3,
        life: life * (0.6 + Math.random() * 0.4), maxLife: life, size: size, color: color, g: 900
      });
    }
  }

  function dust(x, y, n, spread) {
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 14, y: y - 2,
        vx: (Math.random() - 0.5) * spread, vy: -20 - Math.random() * 50,
        life: 0.25 + Math.random() * 0.15, maxLife: 0.4, size: 4, color: col.dust, g: 150
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var pt = particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { particles.splice(i, 1); continue; }
      pt.vy += pt.g * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  // ------------------------------------------------------------------- camera
  function clampCamera() {
    cam.x = Math.max(0, Math.min(cam.x, Math.max(0, levelW - VW)));
    cam.y = Math.max(0, Math.min(cam.y, Math.max(0, levelH - VH)));
  }

  function snapCamera() {
    cam.x = player.x + player.w / 2 + cam.look - VW / 2;
    cam.y = player.y + player.h / 2 - VH / 2;
    clampCamera();
    cam.prevX = cam.x;
    cam.prevY = cam.y;
  }

  function updateCamera(dt) {
    var lookTarget = cam.look;
    if (player.vx > C.lookAheadMinSpeed) lookTarget = C.lookAhead;
    else if (player.vx < -C.lookAheadMinSpeed) lookTarget = -C.lookAhead;
    cam.look += (lookTarget - cam.look) * (1 - Math.exp(-C.lookAheadLerp * dt));
    var k = 1 - Math.exp(-C.cameraLerp * dt);
    cam.x += (player.x + player.w / 2 + cam.look - VW / 2 - cam.x) * k;
    cam.y += (player.y + player.h / 2 - VH / 2 - cam.y) * k;
    clampCamera();
  }

  // ------------------------------------------------------------------- update
  function update(dt) {
    uiTime += dt;
    if (state === 'playing') tickPlaying(dt);
    else if (state === 'complete') updateParticles(dt);
    jumpPressed = false;
  }

  function tickPlaying(dt) {
    cam.prevX = cam.x; cam.prevY = cam.y;
    player.prevX = player.x; player.prevY = player.y;
    elapsed += dt;
    hintTimer = Math.max(0, hintTimer - dt);

    if (dead) {
      deathTimer -= dt;
      updateParticles(dt);
      if (deathTimer <= 0) respawn();
      return;
    }

    var p = player, i;
    stepPlayer(p, readInput(), dt);

    // animation / juice
    p.animTime += dt;
    var rec = Math.min(1, C.squashRecover * dt);
    p.sx += (1 - p.sx) * rec;
    p.sy += (1 - p.sy) * rec;
    if (p.justJumped) {
      p.sx = 1 - C.jumpStretch; p.sy = 1 + C.jumpStretch;
      dust(p.x + p.w / 2, p.y + p.h, 4, 120);
      beep(380, 620, 0.12, 'square');
    }
    if (p.justLanded && p.landSpeed > 250) {
      var amt = Math.min(1, p.landSpeed / C.maxFallSpeed + 0.3);
      p.sx = 1 + C.landSquash * amt; p.sy = 1 - C.landSquash * amt;
      dust(p.x + p.w / 2, p.y + p.h, 5, 200);
    }

    // coins
    var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (!c.taken && Math.abs(c.x - pcx) < p.w / 2 + C.coinRadius &&
          Math.abs(c.y - pcy) < p.h / 2 + C.coinRadius) {
        c.taken = true;
        coinCount++;
        burst(c.x, c.y, 6, col.coin, 120, 0.35, 3);
        beep(880, 1320, 0.09, 'square');
        beep(1320, 1760, 0.12, 'square', 0.07);
      }
    }

    // checkpoints
    for (i = 0; i < checkpoints.length; i++) {
      var cp = checkpoints[i];
      if (!cp.active && overlaps(p, cp.x, cp.y - T, T, T * 2)) {
        cp.active = true;
        spawn = cp;
        burst(cp.x + T / 2, cp.y, 8, col.checkpointOn, 140, 0.4, 3);
        beep(520, 1040, 0.18, 'triangle');
      }
    }

    if (touchesSpike(p) || fellOut(p)) { die(); return; }

    if (atGoal(p)) {
      state = 'complete';
      burst(flag.x + T / 2, flag.y - T / 2, 40, col.accent, 320, 1.2, 4);
      burst(flag.x + T / 2, flag.y - T / 2, 25, col.flag, 260, 1.0, 4);
      beep(523, 523, 0.12, 'square');
      beep(659, 659, 0.12, 'square', 0.12);
      beep(784, 784, 0.12, 'square', 0.24);
      beep(1047, 1047, 0.3, 'square', 0.36);
    }

    updateCamera(dt);
    updateParticles(dt);
  }

  // ------------------------------------------------------------------- render
  function text(str, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col.hudShadow;
    ctx.fillText(str, x + 2, y + 2);
    ctx.fillStyle = color || col.hudText;
    ctx.fillText(str, x, y);
  }

  function formatTime(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  var renderPlayer = {};

  function render(alpha) {
    var camX = Math.round(cam.prevX + (cam.x - cam.prevX) * alpha);
    var camY = Math.round(cam.prevY + (cam.y - cam.prevY) * alpha);
    var i;

    Assets.drawBackground(ctx, camX, camY, VW, VH, uiTime);

    ctx.save();
    ctx.translate(-camX, -camY);

    var tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(LW - 1, Math.floor((camX + VW) / T));
    var ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(LH - 1, Math.floor((camY + VH) / T));
    var info = { tx: 0, ty: 0, above: '.' };
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var t = grid[ty][tx];
        if (t === '.') continue;
        info.tx = tx; info.ty = ty; info.above = tileAt(tx, ty - 1);
        Assets.drawTile(ctx, t, tx * T, ty * T, info);
      }
    }

    for (i = 0; i < checkpoints.length; i++) Assets.drawCheckpoint(ctx, checkpoints[i], uiTime);
    if (flag) Assets.drawFlag(ctx, flag, uiTime);
    for (i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (!c.taken && c.x > camX - T && c.x < camX + VW + T) Assets.drawCoin(ctx, c, uiTime);
    }

    if (!dead) {
      for (var k in player) renderPlayer[k] = player[k];
      renderPlayer.x = player.prevX + (player.x - player.prevX) * alpha;
      renderPlayer.y = player.prevY + (player.y - player.prevY) * alpha;
      Assets.drawPlayer(ctx, renderPlayer);
    }
    for (i = 0; i < particles.length; i++) Assets.drawParticle(ctx, particles[i]);
    ctx.restore();

    // death flash
    if (dead) {
      var f = 1 - (C.deathTime - deathTimer) / C.deathFlashTime;
      if (f > 0) {
        ctx.globalAlpha = Math.min(1, f) * 0.7;
        ctx.fillStyle = col.flash;
        ctx.fillRect(0, 0, VW, VH);
        ctx.globalAlpha = 1;
      }
    }

    if (state !== 'title') drawHud();
    if (state === 'title') drawTitle();
    else if (state === 'paused') drawPaused();
    else if (state === 'complete') drawComplete();
  }

  function drawHud() {
    ctx.fillStyle = col.hudPanel;
    ctx.fillRect(10, 10, 476, 34);
    Assets.drawCoin(ctx, { x: 30, y: 27 }, 0);
    text(coinCount + '/' + coins.length, 46, 28, 20);
    text('Deaths ' + deaths, 150, 28, 20);
    text('Time ' + formatTime(elapsed), 300, 28, 20);

    if (state === 'playing' && hintTimer > 0) {
      ctx.globalAlpha = Math.min(1, hintTimer / C.hintFade);
      ctx.fillStyle = col.hudPanel;
      ctx.fillRect(VW / 2 - 330, VH - 92, 660, 56);
      text('Move: Arrows or A/D     Jump: Space / Up / W (hold = higher)', VW / 2, VH - 76, 16, col.hudText, 'center');
      text('Drop through platform: Down + Jump     Pause: P / Esc     Restart: R', VW / 2, VH - 52, 16, col.hudText, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlay() {
    ctx.fillStyle = col.overlay;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawTitle() {
    drawOverlay();
    text('SKY HOP', VW / 2, 150, 84, col.accent, 'center');
    text('a tiny platformer', VW / 2, 215, 22, col.hudText, 'center');
    if (Math.floor(uiTime * 2) % 2 === 0) {
      text('Press Enter or Space to start', VW / 2, 300, 28, col.hudText, 'center');
    }
    text('Move: Arrows or A/D    Jump: Space / Up / W', VW / 2, 390, 18, col.hudText, 'center');
    text('Drop through platform: Down + Jump', VW / 2, 418, 18, col.hudText, 'center');
    text('Pause: P / Esc    Restart: R', VW / 2, 446, 18, col.hudText, 'center');
  }

  function drawPaused() {
    drawOverlay();
    text('PAUSED', VW / 2, 230, 64, col.accent, 'center');
    text('Press P or Esc to resume', VW / 2, 300, 24, col.hudText, 'center');
    text('Press R to restart', VW / 2, 336, 20, col.hudText, 'center');
  }

  function drawComplete() {
    drawOverlay();
    text('Level complete!', VW / 2, 150, 60, col.accent, 'center');
    text('Time    ' + formatTime(elapsed), VW / 2, 240, 28, col.hudText, 'center');
    text('Coins   ' + coinCount + ' / ' + coins.length, VW / 2, 280, 28, col.hudText, 'center');
    text('Deaths  ' + deaths, VW / 2, 320, 28, col.hudText, 'center');
    if (coinCount === coins.length && deaths === 0) {
      text('Perfect run!', VW / 2, 365, 22, col.accent, 'center');
    }
    text('Press R to play again', VW / 2, 420, 26, col.hudText, 'center');
  }

  // ---------------------------------------------------------------- main loop
  var lastTime = -1, accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (lastTime < 0) lastTime = now;
    var delta = (now - lastTime) / 1000;
    lastTime = now;
    if (delta < 0) delta = 0;
    if (delta > C.maxFrameTime) delta = C.maxFrameTime; // no spiral of death, no tunnelling
    accumulator += delta;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }
    render(state === 'playing' ? accumulator / STEP : 1);
  }

  snapCamera();
  requestAnimationFrame(frame);

  // Small surface for automated testing; the game itself does not use it.
  return {
    STEP: STEP,
    stepPlayer: stepPlayer,
    touchesSpike: touchesSpike,
    fellOut: fellOut,
    atGoal: atGoal,
    start: startGame,
    tick: function (inp) { inputOverride = inp || null; update(STEP); inputOverride = null; },
    info: function () {
      return { state: state, player: player, dead: dead, deaths: deaths, coins: coinCount,
               totalCoins: coins.length, elapsed: elapsed, levelW: levelW, levelH: levelH };
    }
  };
})();
