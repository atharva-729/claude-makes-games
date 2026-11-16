// WICKFALL - ALL drawing lives here. Swap this file to replace the art.
var Assets = (function () {
  var C = CFG.colors, T = CFG.TILE, W = CFG.W, H = CFG.H;
  var FONT = 'Georgia, "Times New Roman", serif';
  var TAU = Math.PI * 2;
  var A = {};
  var sky, layers = [], fogSprite, holeSprite, lightCanvas, lctx, glowCache = {};

  // ---------------------------------------------------------------- helpers
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rng(seed) { var s = seed; return function () { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 0x10000; }; }

  function glowSprite(col) {
    var key = col.join(',');
    if (glowCache[key]) return glowCache[key];
    var c = mk(128, 128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.25, rgba(col, 0.5)); gr.addColorStop(0.6, rgba(col, 0.12)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowCache[key] = c; return c;
  }

  function glow(ctx, x, y, r, col, alpha) {
    if (alpha <= 0 || r <= 0) return;
    var oa = ctx.globalAlpha, oc = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = oa * Math.min(1, alpha);
    ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = oa; ctx.globalCompositeOperation = oc;
  }
  A.glow = glow;

  function text(ctx, str, x, y, size, color, align, style, spacing) {
    ctx.font = (style || '') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (spacing || 0) + 'px';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // ---------------------------------------------------------------- init: pre-rendered backdrops
  A.init = function () {
    var g, i, x, r;
    // sky with moon and stars
    sky = mk(W, H); g = sky.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, C.skyTop); gr.addColorStop(0.55, C.skyMid); gr.addColorStop(1, C.skyLow);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    r = rng(11);
    for (i = 0; i < 170; i++) {
      var sx = r() * W, sy = r() * H * 0.75, ss = r();
      g.fillStyle = 'rgba(200,230,255,' + (0.15 + ss * 0.6) + ')';
      g.beginPath(); g.arc(sx, sy, 0.5 + ss * 1.1, 0, TAU); g.fill();
    }
    var mx = 690, my = 130;
    gr = g.createRadialGradient(mx, my, 20, mx, my, 330);
    gr.addColorStop(0, 'rgba(150,220,235,0.34)'); gr.addColorStop(0.3, 'rgba(90,170,200,0.12)'); gr.addColorStop(1, 'rgba(60,120,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(mx - 14, my - 14, 4, mx, my, 62);
    gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.7, '#c4e6ee'); gr.addColorStop(1, '#8fc3d2');
    g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 60, 0, TAU); g.fill();
    g.fillStyle = 'rgba(110,160,180,0.3)';
    [[-20, -12, 13], [16, 18, 9], [22, -24, 6], [-8, 26, 7]].forEach(function (m) { g.beginPath(); g.arc(mx + m[0], my + m[1], m[2], 0, TAU); g.fill(); });
    // a thin veil of cloud across the moon
    g.fillStyle = 'rgba(8,20,40,0.5)';
    g.beginPath(); g.ellipse(mx - 30, my + 24, 150, 9, -0.05, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(mx + 60, my - 8, 110, 6, 0.04, 0, TAU); g.fill();

    // layer 1: distant ridges
    layers.push(makeLayer(0.07, function (g, h) {
      var gr = g.createLinearGradient(0, 240, 0, 520); gr.addColorStop(0, '#11304f'); gr.addColorStop(1, '#0a1b33');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
      for (var x = 0; x <= 1920; x += 8) {
        var k = x / 1920 * TAU;
        g.lineTo(x, 310 + 60 * Math.sin(k * 3 + 1) + 34 * Math.sin(k * 7 + 2) + 16 * Math.abs(Math.sin(k * 19)) - 22 * Math.abs(Math.sin(k * 11 + 0.5)));
      }
      g.lineTo(1920, h); g.fill();
    }));
    // layer 2: ruined spires and arches
    layers.push(makeLayer(0.2, function (g, h) {
      var r = rng(5), base = 470;
      g.fillStyle = '#0b2038';
      g.fillRect(0, base, 1920, h - base);
      for (var i = 0; i < 15; i++) {
        var x = i * 128 + r() * 50, w = 26 + r() * 46, th = 110 + r() * 190, broken = r() < 0.4;
        g.beginPath(); g.moveTo(x - w * 0.65, base); g.lineTo(x - w * 0.42, base - th);
        if (broken) { g.lineTo(x - w * 0.2, base - th - 16); g.lineTo(x, base - th + 8); g.lineTo(x + w * 0.25, base - th - 26); }
        else { g.lineTo(x, base - th - w * 1.5); }
        g.lineTo(x + w * 0.42, base - th); g.lineTo(x + w * 0.65, base); g.fill();
        if (r() < 0.5 && i < 14) { // arch to the next spire
          g.lineWidth = 7; g.strokeStyle = '#0b2038'; g.beginPath();
          g.moveTo(x + w * 0.3, base - th * 0.45); g.quadraticCurveTo(x + 70, base - th * 0.45 - 46, x + 128, base - th * 0.3); g.stroke();
        }
        if (r() < 0.55) {
          var wy = base - th * (0.45 + r() * 0.4);
          g.fillStyle = 'rgba(255,214,130,0.75)'; g.fillRect(x - 2, wy, 4, 7);
          var gg = g.createRadialGradient(x, wy + 3, 0, x, wy + 3, 22); gg.addColorStop(0, 'rgba(255,214,130,0.3)'); gg.addColorStop(1, 'rgba(255,214,130,0)');
          g.fillStyle = gg; g.fillRect(x - 22, wy - 19, 44, 44);
          g.fillStyle = '#0b2038';
        }
      }
    }));
    // layer 3: near twisted trees
    layers.push(makeLayer(0.42, function (g, h) {
      var r = rng(23), base = 500;
      g.fillStyle = '#07121f'; g.strokeStyle = '#07121f'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, h);
      for (var x = 0; x <= 1920; x += 16) g.lineTo(x, base + 14 * Math.sin(x / 1920 * TAU * 5));
      g.lineTo(1920, h); g.fill();
      for (var i = 0; i < 7; i++) {
        var tx = 120 + i * 270 + r() * 90, th = 250 + r() * 170, lean = (r() - 0.5) * 90;
        g.beginPath(); g.moveTo(tx - 24, base + 12); g.quadraticCurveTo(tx - 6 + lean * 0.2, base - th * 0.5, tx + lean - 5, base - th);
        g.lineTo(tx + lean + 5, base - th); g.quadraticCurveTo(tx + 12 + lean * 0.2, base - th * 0.5, tx + 26, base + 12); g.fill();
        for (var b = 0; b < 6; b++) {
          var k = 0.4 + r() * 0.55, bx = tx + lean * k * k, by = base - th * k, dir = b % 2 ? 1 : -1, bl = 50 + r() * 90;
          g.lineWidth = 3 + (1 - k) * 8; g.beginPath(); g.moveTo(bx, by);
          var ex = bx + dir * bl, ey = by - 24 - r() * 60;
          g.quadraticCurveTo(bx + dir * bl * 0.5, by + 6, ex, ey); g.stroke();
          g.lineWidth = 2; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + dir * 22, ey - 30 * r()); g.moveTo(ex - dir * 12, ey + 6); g.lineTo(ex - dir * 4, ey - 34); g.stroke();
          if (r() < 0.5) { // hanging moss
            g.lineWidth = 1.5; g.beginPath(); g.moveTo(ex - dir * 20, ey + 8); g.lineTo(ex - dir * 20, ey + 30 + r() * 50); g.stroke();
          }
        }
      }
    }));

    fogSprite = mk(256, 128); g = fogSprite.getContext('2d');
    for (i = 0; i < 6; i++) {
      var fx = 50 + i * 30, fy = 64 + (i % 2 ? 10 : -8), fr = 48 + (i % 3) * 8;
      gr = g.createRadialGradient(fx, fy, 0, fx, fy, fr); gr.addColorStop(0, 'rgba(120,190,200,0.5)'); gr.addColorStop(1, 'rgba(120,190,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    }
    holeSprite = mk(128, 128); g = holeSprite.getContext('2d');
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    lightCanvas = mk(W, H); lctx = lightCanvas.getContext('2d');
  };

  function makeLayer(f, paint) {
    var fy = f * 0.5, h = H + Math.ceil(900 * fy) + 12;
    var c = mk(1920, h); paint(c.getContext('2d'), h);
    return { c: c, f: f, fy: fy };
  }

  // ---------------------------------------------------------------- background / atmosphere
  A.drawBackground = function (ctx, cam, t, mood) {
    ctx.drawImage(sky, 0, 0);
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i], ox = -((cam.x * L.f) % 1920), oy = -cam.y * L.fy;
      ctx.drawImage(L.c, ox, oy); ctx.drawImage(L.c, ox + 1920, oy);
      if (i === 1) { // mist between the layers
        var gr = ctx.createLinearGradient(0, H * 0.45, 0, H);
        gr.addColorStop(0, 'rgba(40,110,130,0)'); gr.addColorStop(1, 'rgba(40,110,130,0.22)');
        ctx.fillStyle = gr; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      }
    }
    if (mood >= 1) { ctx.fillStyle = mood >= 2 ? 'rgba(70,10,50,0.34)' : 'rgba(50,20,100,0.26)'; ctx.fillRect(0, 0, W, H); }
  };

  A.drawFog = function (ctx, cam, t) {
    ctx.save(); ctx.globalAlpha = 0.2;
    for (var i = 0; i < 7; i++) {
      var span = W + 700;
      var x = (((i * 290 - cam.x * 1.25 + t * (9 + (i % 3) * 5)) % span) + span) % span - 400;
      var y = H - 130 + Math.sin(t * 0.3 + i * 1.7) * 14 + (i % 2) * 36 - clamp((cam.y - 800) * 0.2, -60, 20);
      ctx.drawImage(fogSprite, x, y, 620, 230);
    }
    ctx.restore();
  };

  // drifting spores / fireflies, wrapped around the camera
  A.drawAmbient = function (ctx, cam, t, mood) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 46; i++) {
      var depth = 0.6 + hash(i, 3) * 0.7, fire = i % 5 === 0;
      var wx = hash(i, 1) * 1400 + Math.sin(t * 0.4 + i) * 30 + t * (fire ? 0 : 7), wy = hash(i, 2) * 800 - t * (fire ? 0 : 5 + hash(i, 4) * 8) + Math.sin(t * 0.7 + i * 2) * (fire ? 26 : 8);
      var x = (((wx - cam.x * depth) % (W + 40)) + W + 40) % (W + 40) - 20, y = (((wy - cam.y * depth) % (H + 40)) + H + 40) % (H + 40) - 20;
      var tw = 0.5 + 0.5 * Math.sin(t * (fire ? 2.2 : 1.1) + i * 3.3);
      var col = fire ? (mood >= 2 ? C.red : C.gold) : (mood >= 1 ? C.violet : C.cyan);
      ctx.globalAlpha = (fire ? 0.25 + 0.75 * tw : 0.18 + 0.2 * tw);
      var r = fire ? 9 : 4 * depth;
      ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  };

  A.drawRain = function (ctx, t) {
    ctx.save(); ctx.strokeStyle = 'rgba(170,200,255,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (var i = 0; i < 110; i++) {
      var sp = 900 + hash(i, 7) * 500;
      var y = (hash(i, 9) * H + t * sp) % (H + 40) - 20, x = (((hash(i, 5) * (W + 200) - t * sp * 0.22) % (W + 200)) + W + 200) % (W + 200) - 100;
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 22);
    }
    ctx.stroke(); ctx.restore();
  };

  // ---------------------------------------------------------------- tiles
  A.drawTiles = function (ctx, tileAt, c0, c1, r0, r1, t) {
    var c, r, ch, x, y, i;
    for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
      ch = tileAt(c, r); if (ch === '.') continue;
      x = c * T; y = r * T;
      if (ch === '^') { drawSpikes(ctx, x, y, c); continue; }
      if (ch === 'G') { drawGate(ctx, x, y, t, tileAt(c, r - 1) !== 'G'); continue; }
      var up = tileAt(c, r - 1), dn = tileAt(c, r + 1), lf = tileAt(c - 1, r), rt = tileAt(c + 1, r);
      var open = function (k) { return k === '.' || k === '^' || k === 'G'; };
      var inner = !open(up) && !open(dn) && !open(lf) && !open(rt);
      var hv = hash(c, r);
      ctx.fillStyle = inner ? C.rockDeep : C.rock;
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      if (!inner || hv > 0.6) { // soft facets
        ctx.fillStyle = 'rgba(40,80,110,' + (0.05 + hv * 0.07) + ')';
        ctx.beginPath(); ctx.moveTo(x + hv * 20, y + 8); ctx.lineTo(x + 26 + hv * 16, y + 4 + hv * 10); ctx.lineTo(x + 34, y + 30 + hv * 10); ctx.lineTo(x + 8, y + 36); ctx.fill();
      }
      if (ch === 'B') { // hairline cracks hint at a breakable wall
        ctx.strokeStyle = 'rgba(150,210,225,0.26)'; ctx.lineWidth = 1.3; ctx.beginPath();
        ctx.moveTo(x + 30, y + 2); ctx.lineTo(x + 20, y + 16); ctx.lineTo(x + 28, y + 27); ctx.lineTo(x + 16, y + 46);
        ctx.moveTo(x + 20, y + 16); ctx.lineTo(x + 6, y + 22); ctx.moveTo(x + 28, y + 27); ctx.lineTo(x + 42, y + 33); ctx.stroke();
      }
      if (open(lf)) { ctx.fillStyle = 'rgba(70,130,160,0.2)'; ctx.fillRect(x, y, 3, T); }
      if (open(rt)) { ctx.fillStyle = 'rgba(70,130,160,0.2)'; ctx.fillRect(x + T - 3, y, 3, T); }
      if (open(dn)) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y + T - 6, T, 6);
        if (hv > 0.55) { // dangling roots
          ctx.strokeStyle = '#0d2a33'; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(x + 10 + hv * 20, y + T); ctx.quadraticCurveTo(x + 14 + hv * 20 + Math.sin(t + c) * 2, y + T + 12, x + 10 + hv * 22 + Math.sin(t * 1.2 + c) * 3, y + T + 14 + hv * 22); ctx.stroke();
        }
      }
      if (open(up)) { // mossy cap
        ctx.fillStyle = C.moss; ctx.beginPath();
        ctx.moveTo(x, y + 9); ctx.lineTo(x, y); ctx.lineTo(x + T, y); ctx.lineTo(x + T, y + 9);
        ctx.quadraticCurveTo(x + 38, y + 5 + hv * 6, x + 30, y + 10); ctx.quadraticCurveTo(x + 22, y + 6 + hv * 8, x + 14, y + 9); ctx.quadraticCurveTo(x + 6, y + 13, x, y + 9); ctx.fill();
        ctx.fillStyle = C.mossLight; ctx.globalAlpha = 0.75; ctx.fillRect(x, y, T + 0.5, 2.2); ctx.globalAlpha = 1;
        if (up === '.') {
          ctx.strokeStyle = C.mossLight; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7; ctx.beginPath();
          for (i = 0; i < 3; i++) {
            var gx = x + 6 + hash(c * 3 + i, r) * 36, gh = 5 + hash(c, r * 3 + i) * 8, sw = Math.sin(t * 1.5 + c + i) * 2;
            ctx.moveTo(gx, y); ctx.quadraticCurveTo(gx + sw * 0.5, y - gh * 0.6, gx + sw, y - gh);
          }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    }
  };

  function drawSpikes(ctx, x, y, c) {
    for (var i = 0; i < 3; i++) {
      var sx = x + i * 16, hh = 26 + hash(c, i) * 8;
      var gr = ctx.createLinearGradient(0, y + T - hh, 0, y + T);
      gr.addColorStop(0, '#cfeaf5'); gr.addColorStop(0.45, '#4d7d94'); gr.addColorStop(1, '#0d1c2a');
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.moveTo(sx + 1, y + T); ctx.lineTo(sx + 8, y + T - hh); ctx.lineTo(sx + 15, y + T); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath();
      ctx.moveTo(sx + 8, y + T - hh); ctx.lineTo(sx + 6, y + T - hh * 0.4); ctx.lineTo(sx + 8.5, y + T - hh * 0.4); ctx.fill();
    }
  }

  function drawGate(ctx, x, y, t, top) {
    ctx.fillStyle = 'rgba(40,16,70,0.55)'; ctx.fillRect(x, y, T, T);
    for (var i = 0; i < 3; i++) {
      var bx = x + 5 + i * 15;
      ctx.fillStyle = '#0c0a1c'; ctx.fillRect(bx, y, 8, T);
      ctx.fillStyle = rgba(C.violet, 0.45 + 0.25 * Math.sin(t * 4 + i + y * 0.05)); ctx.fillRect(bx + 3, y, 2, T);
    }
    glow(ctx, x + T / 2, y + T / 2, 44, C.violet, 0.22);
  }

  // ---------------------------------------------------------------- props
  A.drawLantern = function (ctx, x, y, t, tint, power) {
    var sway = Math.sin(t * 1.3 + x * 0.01) * 0.08;
    ctx.lineCap = 'round';
    for (var ps = 0; ps < 2; ps++) {
      ctx.strokeStyle = ps ? 'rgba(90,140,165,0.55)' : '#132436'; ctx.lineWidth = ps ? 1.2 : 5;
      ctx.beginPath(); ctx.moveTo(x + ps * 1.5, y); ctx.lineTo(x + ps * 1.5, y - 78); ctx.quadraticCurveTo(x + ps * 1.5, y - 96, x + 18, y - 94 - ps * 1.5); ctx.stroke();
    }
    ctx.save(); ctx.translate(x + 18, y - 94); ctx.rotate(sway);
    ctx.strokeStyle = '#0a1420'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke();
    ctx.fillStyle = '#1b3044'; ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(0, 7); ctx.lineTo(8, 12); ctx.fill(); ctx.fillRect(-7, 28, 14, 3);
    ctx.fillStyle = rgba(tint, 0.25 + 0.6 * power); ctx.beginPath(); ctx.ellipse(0, 20, 6, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * power) + ')'; ctx.beginPath(); ctx.ellipse(0, 21, 2.4, 4, 0, 0, TAU); ctx.fill();
    glow(ctx, 0, 20, 36, tint, 0.6 * power);
    ctx.restore();
  };

  A.drawCrystal = function (ctx, d, t) {
    var col = C[d.color] || C.cyan, x = d.px, y = d.py;
    ctx.save(); ctx.translate(x, y);
    if (d.hang) ctx.scale(1, -1);
    if (d.wall) ctx.rotate(d.wall * Math.PI / 2);
    var pulse = 0.7 + 0.3 * Math.sin(t * 1.7 + x * 0.05);
    [[-9, 16, -0.35], [0, 28, 0.05], [9, 18, 0.4]].forEach(function (s) {
      ctx.save(); ctx.translate(s[0], 0); ctx.rotate(s[2]);
      var gr = ctx.createLinearGradient(0, 0, 0, -s[1]); gr.addColorStop(0, rgba(col, 0.25)); gr.addColorStop(1, rgba(col, 0.95 * pulse));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-4, -s[1] * 0.7); ctx.lineTo(0, -s[1]); ctx.lineTo(4, -s[1] * 0.7); ctx.lineTo(5, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-4, -s[1] * 0.7); ctx.lineTo(0, -s[1]); ctx.lineTo(-1, 0); ctx.lineTo(-5, 0); ctx.fill();
      ctx.restore();
    });
    glow(ctx, 0, -12, 34, col, 0.45 * pulse);
    ctx.restore();
  };

  // the rest point: a wickstone with a floating flame
  A.drawRest = function (ctx, r, t) {
    var x = r.px, y = r.py, lit = r.lit, k = r.pulse || 0;
    ctx.fillStyle = '#0d1b2b'; ctx.beginPath();
    ctx.moveTo(x - 26, y); ctx.lineTo(x - 20, y - 12); ctx.lineTo(x - 9, y - 16); ctx.lineTo(x - 12, y - 44); ctx.quadraticCurveTo(x, y - 54, x + 12, y - 44); ctx.lineTo(x + 9, y - 16); ctx.lineTo(x + 20, y - 12); ctx.lineTo(x + 26, y); ctx.fill();
    ctx.strokeStyle = rgba(lit ? C.gold : C.cyan, 0.5); ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(x, y - 30, 5, 0, TAU); ctx.moveTo(x, y - 25); ctx.lineTo(x, y - 14); ctx.stroke();
    var col = lit ? C.gold : C.cyan, fy = y - 70 + Math.sin(t * 2) * 4, s = lit ? 1 : 0.55;
    ctx.save(); ctx.translate(x, fy); ctx.scale(s, s);
    ctx.fillStyle = rgba(col, 0.9); ctx.beginPath();
    ctx.moveTo(0, -18 - Math.sin(t * 9) * 3); ctx.quadraticCurveTo(10, -4, 8, 5); ctx.quadraticCurveTo(0, 16, -8, 5); ctx.quadraticCurveTo(-10, -4, 0, -18 - Math.sin(t * 9) * 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, 3, 3.5, 6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    glow(ctx, x, fy, lit ? 70 + k * 80 : 30, col, lit ? 0.6 + k * 0.4 : 0.35);
    if (lit) for (var i = 0; i < 3; i++) {
      var ph = (t * 0.5 + i / 3) % 1;
      ctx.strokeStyle = rgba(C.gold, 0.25 * (1 - ph)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, fy, 14 + ph * 44, 0, TAU); ctx.stroke();
    }
  };

  function dropPath(ctx, s) {
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.8, s * 0.8, 0, s * 0.8); ctx.bezierCurveTo(-s * 0.8, s * 0.8, -s * 0.9, -s * 0.2, 0, -s);
  }

  A.drawHeart = function (ctx, x, y, t) {
    y += Math.sin(t * 2) * 5;
    glow(ctx, x, y, 60, C.gold, 0.7);
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = rgba(C.cyan, 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 2, 20, 7, t, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 7, -t * 0.7 + 1, 0, TAU); ctx.stroke();
    dropPath(ctx, 13); ctx.fillStyle = rgba(C.gold, 1); ctx.fill();
    dropPath(ctx, 6); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  };

  A.drawHint = function (ctx, x, y, str, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    text(ctx, str, x, y, 15, 'rgba(190,232,240,0.9)', 'center', 'italic', 0.5);
    ctx.fillStyle = 'rgba(190,232,240,0.35)'; ctx.fillRect(x - 30, y + 14, 60, 1);
    ctx.restore();
  };

  // ---------------------------------------------------------------- player
  A.drawPlayer = function (ctx, p, t) {
    if (p.dead) return;
    var flash = p.hurtLock > 0;
    if (p.invuln > 0 && !flash && Math.floor(t * 28) % 2 === 0) return;
    var cx = p.x + p.w / 2, fy = p.y + p.h;
    var d = p.wallDir ? -p.wallDir : p.dir;
    var run = p.onGround && Math.abs(p.vx) > 40, dash = p.dashT > 0;
    var spd = clamp(p.vx * d / CFG.player.runSpeed, -1.5, 2.2);
    var bob = run ? Math.abs(Math.sin(p.animT * 15)) * 2.5 : (p.onGround ? Math.sin(t * 2.4) : 0);
    var sy = 1, sx = 1;
    if (!p.onGround && !dash) { sy = 1 + clamp(Math.abs(p.vy) / 2600, 0, 0.16); sx = 1 / sy; }
    if (p.landT > 0) { sy = 1 - 0.22 * p.landT / 0.12; sx = 1 + 0.2 * p.landT / 0.12; }
    if (dash) { sx = 1.35; sy = 0.78; }
    if (p.healing) { sy = 0.86; }
    ctx.save(); ctx.translate(cx, fy); ctx.scale(d, 1);
    ctx.rotate(dash ? 0.35 : (p.wallDir ? -0.12 : spd * 0.1));
    ctx.scale(sx, sy); ctx.translate(0, -bob);
    var cloak, dark = flash ? '#fff' : '#050a12';
    if (flash) cloak = '#fff'; else { cloak = ctx.createLinearGradient(0, -40, 0, 0); cloak.addColorStop(0, C.cloak); cloak.addColorStop(1, C.cloakDark); }

    // scarf
    var air = clamp(p.vy / 260, -4, 5);
    ctx.strokeStyle = flash ? '#fff' : C.scarf; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass ? 2 : 4.5; ctx.beginPath(); ctx.moveTo(-3, -27 + pass * 2);
      for (var i = 1; i <= (pass ? 4 : 5); i++) {
        ctx.lineTo(-3 - i * (5 + Math.max(0, spd) * 3.4) , -27 + pass * 3 + Math.sin(t * 7 + i * 0.9 + pass) * (1 + i * 0.9) - air * i * 0.9 + i * (1.8 - Math.max(0, spd) * 1.5));
      }
      ctx.stroke();
    }
    // legs
    ctx.strokeStyle = flash ? '#fff' : '#0a1826'; ctx.lineWidth = 4;
    var l1 = run ? Math.sin(p.animT * 15) * 7 : 0, l2 = -l1;
    if (!p.onGround) { l1 = -4; l2 = 5; }
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(-4 + l1, 0); ctx.moveTo(3, -10); ctx.lineTo(4 + l2, 0); ctx.stroke();
    // cloak
    var fl = p.onGround ? 0 : clamp(-p.vy / 200, -3, 4);
    ctx.fillStyle = cloak; ctx.beginPath();
    ctx.moveTo(-6, -31); ctx.quadraticCurveTo(-14, -18, -12 - Math.max(0, spd) * 3, -5 - fl);
    ctx.lineTo(-7, -8); ctx.lineTo(-4, -3 - fl * 0.5); ctx.lineTo(0, -8); ctx.lineTo(4, -3 - fl * 0.5); ctx.lineTo(7, -8); ctx.lineTo(10, -5 - fl);
    ctx.quadraticCurveTo(12, -18, 6, -31); ctx.fill();
    ctx.strokeStyle = rgba(C.cyan, 0.45); ctx.lineWidth = 1.2; ctx.stroke();
    // hood with a long trailing tip
    var flut = Math.sin(t * 6) * 2 - air;
    ctx.fillStyle = cloak; ctx.beginPath();
    ctx.moveTo(8, -30); ctx.quadraticCurveTo(11, -43, 0, -44); ctx.quadraticCurveTo(-12, -46, -22 - Math.max(0, spd) * 4, -40 + flut);
    ctx.quadraticCurveTo(-13, -37, -9, -28); ctx.quadraticCurveTo(0, -24, 8, -30); ctx.fill();
    ctx.stroke();
    // the face: a dark hollow with two ember eyes
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(3, -34, 5.6, 6.2, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : rgba(C.gold, 1);
    ctx.beginPath(); ctx.arc(3, -34.5, 1.5, 0, TAU); ctx.arc(6.6, -34.5, 1.5, 0, TAU); ctx.fill();
    glow(ctx, 5, -34, 9, C.gold, 0.8);
    // wick-lantern at the hip
    ctx.fillStyle = rgba(C.gold, 1); ctx.beginPath(); ctx.arc(7, -15 + Math.sin(t * 5) * 1, 2.6, 0, TAU); ctx.fill();
    glow(ctx, 7, -15, 13, C.gold, 0.7);
    ctx.restore();

    if (p.healing) {
      var k = p.healT / CFG.player.healTime;
      ctx.strokeStyle = rgba(C.gold, 0.8); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, p.y + p.h / 2, 30 - k * 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      glow(ctx, cx, p.y + p.h / 2, 40 + k * 30, C.gold, 0.3 + k * 0.5);
    }
  };

  A.drawGhost = function (ctx, g) {
    var a = g.life / g.max;
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.dir * 1.3, 0.8); ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = rgba(C.cyan, 1); ctx.beginPath();
    ctx.moveTo(8, -30); ctx.quadraticCurveTo(11, -43, 0, -44); ctx.quadraticCurveTo(-12, -46, -24, -40); ctx.quadraticCurveTo(-13, -30, -12, -5);
    ctx.lineTo(10, -5); ctx.quadraticCurveTo(12, -18, 8, -30); ctx.fill();
    ctx.restore();
  };

  A.drawSlash = function (ctx, p, s) {
    var k = clamp(s.t / CFG.player.slashShow, 0, 1), R = CFG.player.slashReach;
    var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    ctx.save(); ctx.translate(cx, cy);
    if (s.type === 'up') ctx.rotate(-Math.PI / 2); else if (s.type === 'down') ctx.rotate(Math.PI / 2); else ctx.scale(s.dir, 1);
    ctx.rotate((k - 0.4) * 0.7);
    var a = 1.15, r = R - 4 + k * 8, al = 1 - k * k;
    ctx.globalCompositeOperation = 'lighter';
    var gr = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
    gr.addColorStop(0, rgba(C.cyan, 0)); gr.addColorStop(0.75, rgba(C.cyan, 0.75 * al)); gr.addColorStop(1, 'rgba(255,255,255,' + al + ')');
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.arc(0, 0, r, -a, a); ctx.quadraticCurveTo(r * (0.5 + k * 0.35), 0, r * Math.cos(a), -r * Math.sin(a)); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + al * 0.9 + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, -a * 0.9, a * 0.9); ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------------- enemies
  A.drawEnemy = function (ctx, e, t) {
    if (e.spawnT > 0) { // coalescing from mist
      var k = 1 - e.spawnT / CFG.enemy.spawnTime, mx = e.x + e.w / 2, my = e.y + e.h / 2;
      glow(ctx, mx, my, 20 + 50 * (1 - k), C.violet, 0.3 + 0.6 * k);
      ctx.strokeStyle = rgba(C.violet, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 44 * (1 - k) + 6, t * 5, t * 5 + 4.5); ctx.stroke();
      return;
    }
    if (e.type === 'crawler') drawCrawler(ctx, e, t);
    else if (e.type === 'grub') drawGrub(ctx, e, t);
    else if (e.type === 'flyer') drawFlyer(ctx, e, t);
    else drawSpitter(ctx, e, t);
  };

  // Brambleback: a low thorn-shelled dome
  function drawCrawler(ctx, e, t) {
    var fl = e.flash > 0, tell = e.state === 'tell', lunge = e.state === 'lunge';
    var x = e.x + e.w / 2, y = e.y + e.h, k = tell ? 1 - e.t / CFG.crawler.lungeTell : 0;
    ctx.save(); ctx.translate(x + (tell ? Math.sin(t * 60) * 1.5 : 0), y); ctx.scale(e.dir, 1);
    if (tell) ctx.rotate(-0.22 * k);
    if (lunge) ctx.scale(1.2, 0.85);
    ctx.strokeStyle = fl ? '#fff' : '#0b0818'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    for (var i = 0; i < 4; i++) { var lx = -14 + i * 9, sw = Math.sin(e.animT * (lunge ? 40 : 12) + i * 1.6) * 3; ctx.moveTo(lx, -6); ctx.lineTo(lx + sw, 0); }
    ctx.stroke();
    // thorns
    ctx.fillStyle = fl ? '#fff' : (tell || lunge ? rgba(C.red, 1) : '#8d7fc4');
    for (i = 0; i < 5; i++) {
      var a = Math.PI * (0.16 + i * 0.17), bx = -Math.cos(a) * 19, by = -4 - Math.sin(a) * 19, len = 9 + (i % 2) * 4 + k * 5;
      ctx.beginPath(); ctx.moveTo(bx - 4, by + 2); ctx.lineTo(bx - Math.cos(a) * len, by - Math.sin(a) * len); ctx.lineTo(bx + 4, by + 2); ctx.fill();
    }
    var gr = ctx.createLinearGradient(0, -26, 0, 0); gr.addColorStop(0, '#3a2c6e'); gr.addColorStop(1, '#120c26');
    ctx.fillStyle = fl ? '#fff' : gr; ctx.beginPath(); ctx.moveTo(-21, -3); ctx.quadraticCurveTo(-20, -26, 0, -25); ctx.quadraticCurveTo(22, -24, 22, -3); ctx.lineTo(16, -1); ctx.lineTo(-18, -1); ctx.fill();
    ctx.strokeStyle = rgba(tell ? C.red : C.violet, 0.7); ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = fl ? '#fff' : rgba(C.red, 1); ctx.beginPath(); ctx.arc(14, -9, 2.4 + k * 1.5, 0, TAU); ctx.arc(19, -7, 1.7 + k, 0, TAU); ctx.fill();
    glow(ctx, 16, -8, 12 + k * 22, C.red, 0.6 + k * 0.4);
    ctx.restore();
  }

  // the harmless one: a sleepy glowgrub
  function drawGrub(ctx, e, t) {
    var fl = e.flash > 0, x = e.x + e.w / 2, y = e.y + e.h, br = Math.sin(e.animT * 5) * 1.2;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    for (var i = 2; i >= 0; i--) {
      ctx.fillStyle = fl ? '#fff' : (i === 0 ? '#3a8088' : '#2a626c');
      ctx.beginPath(); ctx.ellipse(-10 + i * 0 + (2 - i) * -0 + (i === 0 ? 8 : (i === 1 ? -1 : -10)), -10 - (i === 0 ? 1 : 0) + (i % 2 ? br : -br) * 0.5, 9 - i, 10 - i * 1.3, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgba(C.gold, 0.95);
    ctx.beginPath(); ctx.arc(-9, -13, 2, 0, TAU); ctx.arc(-1, -15, 2.2, 0, TAU); ctx.fill();
    glow(ctx, -5, -14, 16, C.gold, 0.6);
    ctx.fillStyle = fl ? '#fff' : '#06141a'; ctx.beginPath(); ctx.arc(11, -11, 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a626c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(11, -19); ctx.quadraticCurveTo(15, -27, 19, -25 + br); ctx.stroke();
    ctx.restore();
  }

  // Gloamwing: a one-eyed moth-bat
  function drawFlyer(ctx, e, t) {
    var fl = e.flash > 0, tell = e.state === 'tell', swoop = e.state === 'swoop';
    var x = e.x + e.w / 2, y = e.y + e.h / 2, k = tell ? 1 - e.t / CFG.flyer.tell : 0;
    ctx.save(); ctx.translate(x + (tell ? Math.sin(t * 70) * 2 * k : 0), y);
    if (swoop) ctx.rotate(Math.atan2(e.sy, e.sx) + (e.sx < 0 ? Math.PI : 0)) , ctx.scale(e.sx < 0 ? -1 : 1, 1); else ctx.scale(e.dir, 1);
    var flap = swoop ? -0.9 : (tell ? -1.1 + Math.sin(t * 50) * 0.1 : Math.sin(e.animT * 16) * 0.75);
    ctx.fillStyle = fl ? '#fff' : '#1c1442';
    for (var s = -1; s <= 1; s += 2) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(flap * 0.6);
      ctx.beginPath(); ctx.moveTo(3, -3); ctx.quadraticCurveTo(18, -24, 34, -12); ctx.lineTo(27, -4); ctx.lineTo(31, 5); ctx.lineTo(21, 3); ctx.lineTo(18, 11); ctx.quadraticCurveTo(9, 6, 3, 5); ctx.fill();
      ctx.strokeStyle = rgba(C.violet, 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = fl ? '#fff' : '#0e0a24'; ctx.beginPath(); ctx.ellipse(0, 1, 9, 12, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-8, -19); ctx.lineTo(-1, -10); ctx.moveTo(6, -8); ctx.lineTo(8, -19); ctx.lineTo(1, -10); ctx.fill();
    var ec = (tell || swoop) ? C.red : C.violet;
    ctx.fillStyle = fl ? '#fff' : rgba(ec, 1); ctx.beginPath(); ctx.ellipse(2, -1, 4.5 + k * 2, 5 + k * 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0618'; ctx.beginPath(); ctx.ellipse(3.5, -1, 1.4, 3.4, 0, 0, TAU); ctx.fill();
    glow(ctx, 2, -1, 14 + k * 26, ec, 0.6 + k * 0.4);
    ctx.restore();
  }

  // Mirepod: a rooted spore-sac
  function drawSpitter(ctx, e, t) {
    var fl = e.flash > 0, tell = e.state === 'tell', spit = e.state === 'spit';
    var x = e.x + e.w / 2, y = e.y + e.h, k = tell ? 1 - e.t / CFG.spitter.tell : 0;
    var sw = 1 + k * 0.28 - (spit ? 0.15 : 0), sh = 1 + k * 0.12 + (spit ? 0.2 : 0) + Math.sin(e.animT * 2.5) * 0.03;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = fl ? '#fff' : '#0e2a26';
    for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.moveTo(s * 4, 0); ctx.quadraticCurveTo(s * 20, -16, s * 30, -4 + Math.sin(t * 2 + s) * 2); ctx.quadraticCurveTo(s * 18, -2, s * 4, 0); ctx.fill(); }
    ctx.scale(sw, sh);
    var gr = ctx.createRadialGradient(-4, -22, 2, 0, -18, 24); gr.addColorStop(0, tell ? '#5f8f4a' : '#27584a'); gr.addColorStop(1, '#0b2420');
    ctx.fillStyle = fl ? '#fff' : gr; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-26, -8, -20, -34, -8, -36); ctx.lineTo(8, -36); ctx.bezierCurveTo(20, -34, 26, -8, 9, 0); ctx.fill();
    ctx.strokeStyle = rgba(C.green, 0.55); ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = rgba(C.green, 0.25 + k * 0.6);
    [[-10, -14, 3], [9, -18, 2.4], [-3, -24, 2], [3, -9, 2.6]].forEach(function (d) { ctx.beginPath(); ctx.arc(d[0], d[1], d[2] * (1 + k * 0.5), 0, TAU); ctx.fill(); });
    ctx.fillStyle = fl ? '#fff' : '#04100e'; ctx.beginPath(); ctx.ellipse(0, -36, 9, 4 + k * 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(C.green, 0.3 + k * 0.7); ctx.beginPath(); ctx.ellipse(0, -36, 5 + k * 2, 2 + k * 3, 0, 0, TAU); ctx.fill();
    glow(ctx, 0, -34, 14 + k * 34, C.green, 0.4 + k * 0.6);
    ctx.restore();
  }

  A.drawProjectile = function (ctx, pr, t) {
    if (pr.kind === 'bolt') {
      var d = pr.vx > 0 ? 1 : -1;
      glow(ctx, pr.x, pr.y, 34, C.cyan, 0.9);
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(d, 1); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createLinearGradient(-60, 0, 14, 0); gr.addColorStop(0, rgba(C.cyan, 0)); gr.addColorStop(1, '#fff');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.quadraticCurveTo(0, -9, 16, 0); ctx.quadraticCurveTo(0, 9, -60, 0); ctx.fill();
      ctx.restore();
      return;
    }
    var col = pr.kind === 'orb' ? C.phase[Math.max(1, pr.tint || 1)] : C.green;
    glow(ctx, pr.x, pr.y, pr.r * 3.2, col, 0.8);
    ctx.fillStyle = rgba(col, 0.95); ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * (0.9 + 0.1 * Math.sin(t * 20)), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(pr.x - 2, pr.y - 2, pr.r * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.4); ctx.lineWidth = pr.r; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.04, pr.y - pr.vy * 0.04); ctx.stroke();
  };

  // ---------------------------------------------------------------- boss: Vesperhorn
  A.drawBoss = function (ctx, b, t) {
    if (b.hidden || b.state === 'dead') return;
    var B = CFG.boss, col = C.phase[b.phase], fl = b.flash > 0;
    var body = 0, head = 0, sq = 1, glowK = 0.7, eye = 1, mouth = 0, jit = 0, legSpd = 0, back = 0, k;
    var walking = Math.abs(b.vx) > 10 && b.onGround;
    switch (b.state) {
      case 'dormant': sq = 0.78; head = 0.75; glowK = 0.06; eye = 0; break;
      case 'intro':
        k = 1 - b.t / B.introTime;
        if (!b.roared) { var u = clamp(k / 0.4, 0, 1); sq = 0.78 + 0.22 * u; head = 0.75 * (1 - u); glowK = u * 0.7; eye = u; }
        else { head = -0.7; mouth = 1; glowK = 1.6; jit = 2; }
        break;
      case 'idle': sq = 1 + Math.sin(t * 2.2) * 0.015; break;
      case 'tell':
        k = 1 - b.t / b.tellDur;
        if (b.attack === 'charge') { head = 0.6 * k; back = 16 * k; legSpd = 26; glowK = 1 + k; }
        else if (b.attack === 'leap') { sq = 1 - 0.27 * k; head = 0.3 * k; glowK = 1 + k; }
        else if (b.attack === 'volley') { body = -0.26 * k; head = -0.3 * k; glowK = 1 + 1.6 * k; }
        else if (b.attack === 'dive') { sq = 1 - 0.3 * k; head = -0.55 * k; glowK = 1.6; jit = 1.5; }
        else { head = -0.7 * k; mouth = k; glowK = 1.5; jit = 1.5 * k; }
        break;
      case 'attack':
        if (b.attack === 'charge') { head = b.sub === 'run' ? 0.65 : 0.4; legSpd = b.sub === 'run' ? 34 : 26; back = b.sub === 'run' ? -8 : 12; glowK = 1.4; }
        else if (b.attack === 'leap') { if (b.sub === 'air') { sq = 1.08; body = b.vy < 0 ? -0.22 : 0.16; } else sq = 0.75; }
        else if (b.attack === 'volley') { body = -0.26; head = -0.3; glowK = 2.4; }
        else if (b.attack === 'dive') { sq = b.sub === 'impact' ? 0.72 : 1.18; head = b.sub === 'fall' ? 0.5 : -0.4; glowK = 2; }
        else { head = -0.7; mouth = 1; glowK = 1.8; jit = 1; }
        break;
      case 'recover': sq = 0.95 + Math.sin(t * 9) * 0.02; head = 0.3; glowK = 0.5; break;
      case 'stagger': sq = 0.84; head = 0.85; eye = 0.15; glowK = 0.15; break;
      case 'roar': head = -0.75; mouth = 1; glowK = 2.2; jit = 3; break;
      case 'dying': head = -0.5 + Math.sin(t * 30) * 0.2; mouth = 1; glowK = 2.5; jit = 4; break;
    }
    var x = b.x + b.w / 2 + (jit ? (hash(Math.floor(t * 60), 1) - 0.5) * jit * 2 : 0), y = b.y + b.h;
    var c = function (v) { return fl ? '#fff' : v; };
    var fur = '#1c1536', fur2 = '#32265e';
    ctx.save(); ctx.translate(x, y); ctx.scale(b.dir, 1); ctx.scale(1 + (1 - sq) * 0.45, sq);
    ctx.translate(-back, 0);
    ctx.translate(-48, 0); ctx.rotate(body); ctx.translate(48, 0);

    // back legs + cloth tail
    var lp = walking ? b.animT * 7 : (legSpd ? t * legSpd : 0);
    var tuck = (b.state === 'attack' && (b.attack === 'leap' && b.sub === 'air' || b.attack === 'dive')) ? 1 : 0;
    function leg(lx, ph, far) {
      var s = (walking || legSpd) ? Math.sin(lp + ph) * (legSpd ? 12 : 9) : 0, lift = (walking || legSpd) ? Math.max(0, Math.cos(lp + ph)) * 8 : 0;
      if (tuck) { s = lx > 0 ? 18 : -18; lift = 22; }
      ctx.fillStyle = c(far ? '#120d26' : '#251c48');
      ctx.beginPath(); ctx.moveTo(lx - 11, -46); ctx.quadraticCurveTo(lx - 12 + s * 0.3, -22, lx - 5 + s, -lift); ctx.lineTo(lx + 6 + s, -lift); ctx.quadraticCurveTo(lx + 10 + s * 0.3, -22, lx + 12, -46); ctx.fill();
      ctx.fillStyle = c('#8f8a7c'); ctx.fillRect(lx - 5 + s, -lift - 5, 11, 5);
    }
    leg(-34, 0, true); leg(40, 3.14, true);
    var sway = Math.sin(t * 2.4) * 6;
    ctx.fillStyle = c('#1d1538'); ctx.beginPath();
    ctx.moveTo(-40, -92); ctx.quadraticCurveTo(-92, -80, -88 + sway * 0.4, -34 + sway); ctx.lineTo(-78, -46); ctx.lineTo(-74 + sway * 0.3, -20 + sway); ctx.lineTo(-64, -44); ctx.lineTo(-58, -26); ctx.lineTo(-50, -60); ctx.fill();
    // body
    var gr = ctx.createLinearGradient(0, -110, 0, -20); gr.addColorStop(0, fur2); gr.addColorStop(1, fur);
    ctx.fillStyle = c(gr); ctx.beginPath();
    ctx.moveTo(-64, -50); ctx.quadraticCurveTo(-70, -96, -30, -108); ctx.quadraticCurveTo(10, -116, 40, -96); ctx.quadraticCurveTo(62, -80, 56, -52);
    // ragged fur under the belly
    ctx.lineTo(46, -30); ctx.lineTo(38, -40); ctx.lineTo(28, -24); ctx.lineTo(18, -38); ctx.lineTo(6, -22); ctx.lineTo(-6, -36); ctx.lineTo(-18, -22); ctx.lineTo(-30, -36); ctx.lineTo(-42, -24); ctx.lineTo(-52, -38); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-64, -50); ctx.quadraticCurveTo(-68, -96, -30, -108); ctx.quadraticCurveTo(10, -116, 40, -96); ctx.stroke();
    // the hour-mark on its flank
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.strokeStyle = rgba(col, clamp(0.25 * glowK + 0.15 * pulse * glowK, 0, 1)); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.arc(-10, -70, 15, 0.6, 5.2); ctx.moveTo(-10, -70); ctx.lineTo(-10, -82); ctx.moveTo(-10, -70); ctx.lineTo(-2, -66); ctx.stroke();
    if (b.state === 'dying') { glow(ctx, -10, -70, 60 + 60 * Math.abs(Math.sin(t * 20)), C.white, 0.8); }
    glow(ctx, -10, -70, 44, col, 0.25 * glowK);
    leg(-52, 3.14, false); leg(26, 0, false);

    // neck + head
    ctx.fillStyle = c(fur2); ctx.beginPath(); ctx.moveTo(30, -100); ctx.quadraticCurveTo(52, -112, 62, -96); ctx.lineTo(58, -70); ctx.quadraticCurveTo(44, -60, 34, -66); ctx.fill();
    ctx.translate(52, -92); ctx.rotate(head);
    // antlers (far, then near) with hanging lantern-fruit
    function antler(ox, shade, lanterns) {
      ctx.strokeStyle = c(shade); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ox, -12); ctx.quadraticCurveTo(ox - 12, -44, ox - 38, -60); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(ox - 7, -32); ctx.quadraticCurveTo(ox + 2, -44, ox + 8, -58);
      ctx.moveTo(ox - 20, -49); ctx.quadraticCurveTo(ox - 18, -64, ox - 10, -76);
      ctx.moveTo(ox - 38, -60); ctx.quadraticCurveTo(ox - 44, -72, ox - 40, -86);
      ctx.moveTo(ox - 38, -60); ctx.lineTo(ox - 56, -58); ctx.stroke();
      if (!lanterns) return;
      [[ox + 8, -58], [ox - 10, -76], [ox - 56, -58], [ox - 40, -86]].forEach(function (pt, i) {
        var sw = Math.sin(t * 2.6 + i * 1.3) * 3 - head * 8, ly = pt[1] + 15;
        ctx.strokeStyle = c('#3b3350'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(pt[0] + sw, ly); ctx.stroke();
        ctx.fillStyle = rgba(col, clamp(0.2 + glowK * 0.5, 0, 1)); ctx.beginPath(); ctx.ellipse(pt[0] + sw, ly + 5, 4, 5.5, 0, 0, TAU); ctx.fill();
        glow(ctx, pt[0] + sw, ly + 5, 10 + glowK * 12, col, clamp(glowK * 0.5, 0, 1));
      });
    }
    antler(8, '#6d6858', false); antler(0, '#bdb6a0', true);
    // jaw
    ctx.fillStyle = c('#b4ad98'); ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(38, 14 + mouth * 12); ctx.lineTo(32, 19 + mouth * 12); ctx.lineTo(0, 13); ctx.fill();
    if (mouth > 0.3) { ctx.fillStyle = rgba(col, 0.8 * mouth); ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(34, 12); ctx.lineTo(32, 14 + mouth * 11); ctx.fill(); }
    // skull
    gr = ctx.createLinearGradient(0, -20, 0, 16); gr.addColorStop(0, C.bone); gr.addColorStop(1, '#a8a18c');
    ctx.fillStyle = c(gr); ctx.beginPath();
    ctx.moveTo(-12, -12); ctx.quadraticCurveTo(8, -24, 26, -10); ctx.lineTo(46, 6); ctx.quadraticCurveTo(49, 13, 42, 14); ctx.lineTo(20, 10); ctx.quadraticCurveTo(4, 14, -10, 8); ctx.quadraticCurveTo(-16, -2, -12, -12); ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,70,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(22, -8); ctx.lineTo(30, 4); ctx.moveTo(38, 4); ctx.lineTo(40, 10); ctx.stroke();
    ctx.fillStyle = '#0b0714'; ctx.beginPath(); ctx.ellipse(10, -4, 6.5, 5, 0.3, 0, TAU); ctx.fill();
    if (eye > 0) {
      ctx.fillStyle = rgba(col, eye); ctx.beginPath(); ctx.arc(11, -4, 2.8, 0, TAU); ctx.fill();
      glow(ctx, 11, -4, 10 + glowK * 12, col, eye * clamp(0.5 + glowK * 0.3, 0, 1));
    }
    ctx.restore();

    if (b.state === 'stagger') { // reeling stars
      for (var i = 0; i < 3; i++) {
        var an = t * 5 + i * 2.1, sx = b.x + b.w / 2 + b.dir * 40 + Math.cos(an) * 26, sy2 = b.y - 20 + Math.sin(an) * 8;
        glow(ctx, sx, sy2, 10, C.white, 0.9);
      }
    }
    if (b.state === 'roar' || (b.state === 'intro' && b.roared) || b.state === 'dying') { // shock rings
      var dur = b.state === 'roar' ? B.roarTime : (b.state === 'dying' ? B.deathTime : 1.5), kk = clamp(1 - b.t / dur, 0, 1);
      for (i = 0; i < 3; i++) {
        var ph = (kk * 2.5 + i / 3) % 1;
        ctx.strokeStyle = rgba(col, 0.5 * (1 - ph)); ctx.lineWidth = 4 * (1 - ph) + 1; ctx.beginPath(); ctx.arc(b.x + b.w / 2 + b.dir * 50, b.y - 10, 30 + ph * 420, 0, TAU); ctx.stroke();
      }
    }
  };

  A.drawDiveMarker = function (ctx, b, t) {
    if (b.state !== 'attack' || b.attack !== 'dive' || (b.sub !== 'track' && b.sub !== 'lock')) return;
    var A2 = Boss.bounds(), lock = b.sub === 'lock', col = lock ? C.red : C.phase[b.phase];
    var w = lock ? 120 : 70 + Math.sin(t * 20) * 8, a = lock ? 0.34 + 0.2 * Math.sin(t * 50) : 0.14;
    var gr = ctx.createLinearGradient(b.markerX - w / 2, 0, b.markerX + w / 2, 0);
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr; ctx.fillRect(b.markerX - w / 2, A2.top, w, A2.floor - A2.top);
    ctx.strokeStyle = rgba(col, lock ? 0.95 : 0.5); ctx.lineWidth = lock ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(b.markerX, A2.floor - 2, lock ? 62 : 46, 7, 0, 0, TAU); ctx.stroke();
    glow(ctx, b.markerX, A2.floor, lock ? 90 : 50, col, lock ? 0.7 : 0.35);
  };

  A.drawHazard = function (ctx, h, t, phase) {
    var col = C.phase[phase], i;
    if (h.kind === 'wave') {
      var a = clamp(h.life / 0.3, 0, 1);
      ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.dir, 1); ctx.globalAlpha = a;
      glow(ctx, 0, -h.h * 0.4, 50, col, 0.7);
      var gr = ctx.createLinearGradient(0, -h.h - 8, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, rgba(col, 0.95)); gr.addColorStop(1, rgba(col, 0.2));
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-6, -8, 2 + Math.sin(t * 30) * 3, -h.h - 8); ctx.quadraticCurveTo(22, -h.h * 0.5, 18, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-30, -4, -24, -h.h * 0.55); ctx.quadraticCurveTo(-14, -8, -12, 0); ctx.fill();
      ctx.restore();
    } else if (h.kind === 'shard') {
      var S = CFG.boss.shards;
      if (!h.falling) { // warning beam
        var k = clamp(1 - h.t / S.tell, 0, 1);
        ctx.fillStyle = rgba(C.violet, 0.08 + 0.2 * k); ctx.fillRect(h.x - 2 - k * 6, h.y + h.h, 4 + k * 12, h.floor - h.y - h.h);
        ctx.fillStyle = rgba(C.red, 0.5 + 0.4 * k); ctx.beginPath(); ctx.ellipse(h.x, h.floor - 2, 6 + 12 * k, 3, 0, 0, TAU); ctx.fill();
        return;
      }
      glow(ctx, h.x, h.y + h.h * 0.7, 40, C.violet, 0.7);
      gr = ctx.createLinearGradient(0, h.y, 0, h.y + h.h); gr.addColorStop(0, rgba(C.violet, 0.1)); gr.addColorStop(0.6, rgba(C.violet, 0.95)); gr.addColorStop(1, '#fff');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(h.x - h.w / 2, h.y + h.h * 0.35); ctx.lineTo(h.x - 3, h.y - 30); ctx.lineTo(h.x + 3, h.y - 30); ctx.lineTo(h.x + h.w / 2, h.y + h.h * 0.35); ctx.lineTo(h.x, h.y + h.h); ctx.fill();
    }
  };

  // ---------------------------------------------------------------- particles
  A.drawParticles = function (ctx, list) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (var i = 0; i < list.length; i++) {
      var p = list[i], a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'spark') {
        ctx.strokeStyle = rgba(p.color, a); ctx.lineWidth = p.size * a + 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = rgba(p.color, a * 0.8); ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
      } else if (p.type === 'shard') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(p.color, a); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 9 + i);
        ctx.beginPath(); ctx.moveTo(-p.size, p.size * 0.6); ctx.lineTo(0, -p.size); ctx.lineTo(p.size, p.size * 0.5); ctx.fill(); ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.fillStyle = rgba(p.color, a * 0.9); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- lighting
  // lights: [{x, y, r, color, a, g}] in world space
  A.drawLighting = function (ctx, lights, cam, ambient, tint) {
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = 'rgba(' + (tint || '2,5,14') + ',' + ambient + ')'; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    var i, l;
    for (i = 0; i < lights.length; i++) {
      l = lights[i]; lctx.globalAlpha = l.a === undefined ? 1 : l.a;
      lctx.drawImage(holeSprite, l.x - cam.x - l.r, l.y - cam.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(lightCanvas, 0, 0, W, H);
    for (i = 0; i < lights.length; i++) {
      l = lights[i];
      if (l.color) glow(ctx, l.x - cam.x, l.y - cam.y, l.r * 0.9, l.color, l.g === undefined ? 0.16 : l.g);
    }
  };

  A.drawVignette = function (ctx, hurt) {
    var gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,8,0.75)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (hurt > 0) {
      gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
      gr.addColorStop(0, 'rgba(255,30,60,0)'); gr.addColorStop(1, 'rgba(255,30,60,' + (0.55 * hurt) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
  };

  A.drawFade = function (ctx, a, col) {
    if (a <= 0) return;
    ctx.fillStyle = 'rgba(' + (col || '0,0,4') + ',' + clamp(a, 0, 1) + ')'; ctx.fillRect(0, 0, W, H);
  };

  // ---------------------------------------------------------------- HUD and screens
  A.drawHUD = function (ctx, G, t) {
    var p = G.player, i, P = CFG.player;
    for (i = 0; i < p.maxHealth; i++) {
      var x = 34 + i * 30, y = 36, full = i < p.health;
      ctx.save(); ctx.translate(x, y);
      if (full) {
        glow(ctx, 0, 2, 20, C.gold, 0.55 + 0.15 * Math.sin(t * 3 + i));
        dropPath(ctx, 11); ctx.fillStyle = rgba(C.gold, 1); ctx.fill();
        dropPath(ctx, 5.5); ctx.fillStyle = '#fff'; ctx.fill();
      } else {
        dropPath(ctx, 11); ctx.fillStyle = 'rgba(10,20,34,0.7)'; ctx.fill();
        ctx.strokeStyle = 'rgba(140,170,190,0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
      }
      ctx.restore();
    }
    // energy
    var ex = 24, ey = 58, ew = 150, k = p.energy / P.maxEnergy, ready = p.energy >= P.healCost;
    ctx.fillStyle = 'rgba(6,14,26,0.75)'; ctx.fillRect(ex, ey, ew, 8);
    var gr = ctx.createLinearGradient(ex, 0, ex + ew, 0); gr.addColorStop(0, rgba(C.cyan, 0.55)); gr.addColorStop(1, '#fff');
    ctx.fillStyle = gr; ctx.fillRect(ex, ey, ew * k, 8);
    if (ready) glow(ctx, ex + ew * k, ey + 4, 14, C.cyan, 0.6 + 0.3 * Math.sin(t * 5));
    ctx.strokeStyle = 'rgba(150,235,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(ex - 0.5, ey - 0.5, ew + 1, 9);
    ctx.fillStyle = 'rgba(4,10,20,0.9)'; ctx.fillRect(ex + ew / 3 - 1, ey, 2, 8); ctx.fillRect(ex + ew * 2 / 3 - 1, ey, 2, 8);
    if (G.god) text(ctx, 'unwavering', 24, 84, 12, 'rgba(255,214,130,0.7)', 'left', 'italic');
    if (Sound.isMuted()) text(ctx, 'muted', W - 20, 20, 12, 'rgba(190,230,240,0.6)', 'right', 'italic');
  };

  A.drawBossBar = function (ctx, b, t, alpha) {
    var B = CFG.boss, w = 460, x = (W - w) / 2, y = 62, k = clamp(b.hp / b.maxHp, 0, 1), col = C.phase[b.phase];
    ctx.save(); ctx.globalAlpha = alpha;
    text(ctx, B.name, W / 2, y - 26, 20, '#eee8d8', 'center', '', 7);
    text(ctx, B.title, W / 2, y - 9, 12, rgba(col, 0.9), 'center', 'italic', 1);
    ctx.fillStyle = 'rgba(4,6,14,0.8)'; ctx.fillRect(x, y, w, 9);
    var gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 1));
    ctx.fillStyle = gr; ctx.fillRect(x, y, w * k, 9);
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x, y, w * k, 9); }
    ctx.strokeStyle = 'rgba(233,227,208,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 10);
    ctx.fillStyle = '#e9e3d0';
    [B.phase3, B.phase2].forEach(function (f) { ctx.beginPath(); ctx.moveTo(x + w * f, y - 4); ctx.lineTo(x + w * f + 4, y + 4.5); ctx.lineTo(x + w * f, y + 13); ctx.lineTo(x + w * f - 4, y + 4.5); ctx.fill(); });
    ctx.restore();
  };

  // big centred name card (area name, boss name, short notices)
  A.drawCard = function (ctx, title, sub, alpha, col) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    var gr = ctx.createLinearGradient(0, 150, 0, 290); gr.addColorStop(0, 'rgba(0,0,6,0)'); gr.addColorStop(0.5, 'rgba(0,0,6,0.6)'); gr.addColorStop(1, 'rgba(0,0,6,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 150, W, 140);
    glow(ctx, W / 2, 210, 260, col || C.cyan, 0.16);
    text(ctx, title, W / 2, 208, 46, '#f1ecdc', 'center', '', 12);
    ctx.fillStyle = rgba(col || C.cyan, 0.8); ctx.fillRect(W / 2 - 130, 240, 260, 1.5);
    if (sub) text(ctx, sub, W / 2, 260, 17, rgba(col || C.cyan, 0.95), 'center', 'italic', 2);
    ctx.restore();
  };

  A.drawNotice = function (ctx, str, alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    text(ctx, str, W / 2, 130, 20, rgba(C.gold, 1), 'center', 'italic', 2);
    ctx.restore();
  };

  var CONTROLS = [
    ['Move / aim', 'Arrow keys or WASD'], ['Jump', 'Space or Z  (hold for height)'], ['Slash', 'X or J  (hold Up / Down to aim)'],
    ['Dash', 'C, K or Shift'], ['Energy bolt', 'V or L'], ['Mend a wound', 'hold F, standing still'],
    ['Pause', 'Esc or P'], ['Return to rest point', 'R'], ['Mute', 'M']
  ];
  function drawControls(ctx, x, y) {
    for (var i = 0; i < CONTROLS.length; i++) {
      text(ctx, CONTROLS[i][0], x - 12, y + i * 23, 15, rgba(C.gold, 0.95), 'right', 'italic');
      text(ctx, CONTROLS[i][1], x + 12, y + i * 23, 15, 'rgba(215,236,242,0.92)', 'left');
    }
  }

  A.drawTitle = function (ctx, t) {
    A.drawFade(ctx, 0.5);
    var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,8,0.2)'); gr.addColorStop(1, 'rgba(0,0,8,0.8)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // emblem: a wick-flame
    var fy = 78 + Math.sin(t * 1.6) * 3;
    glow(ctx, W / 2, fy, 110, C.gold, 0.5 + 0.1 * Math.sin(t * 7));
    ctx.save(); ctx.translate(W / 2, fy); dropPath(ctx, 20); ctx.fillStyle = rgba(C.gold, 1); ctx.fill(); dropPath(ctx, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    glow(ctx, W / 2, 150, 330, C.cyan, 0.14);
    text(ctx, CFG.TITLE, W / 2 + 10, 152, 76, '#f3eedf', 'center', '', 20);
    ctx.fillStyle = rgba(C.cyan, 0.7); ctx.fillRect(W / 2 - 190, 198, 380, 1.5);
    text(ctx, 'a night in ' + CFG.AREA_NAME, W / 2, 218, 18, rgba(C.cyan, 0.95), 'center', 'italic', 3);
    drawControls(ctx, W / 2 - 30, 268);
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3);
    text(ctx, 'Press Enter to begin', W / 2, 500, 22, '#fff', 'center', '', 4);
    ctx.globalAlpha = 1;
  };

  A.drawPause = function (ctx, t) {
    A.drawFade(ctx, 0.72);
    text(ctx, 'PAUSED', W / 2, 110, 44, '#f3eedf', 'center', '', 14);
    ctx.fillStyle = rgba(C.cyan, 0.7); ctx.fillRect(W / 2 - 110, 142, 220, 1.5);
    drawControls(ctx, W / 2 - 30, 190);
    text(ctx, 'Esc or P to resume', W / 2, 440, 18, rgba(C.cyan, 0.95), 'center', 'italic', 2);
  };

  function fmtTime(s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

  A.drawVictory = function (ctx, G, t, alpha) {
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    A.drawFade(ctx, 0.78);
    glow(ctx, W / 2, 150, 300, C.gold, 0.3);
    text(ctx, 'THE HOUR IS LIT', W / 2, 150, 54, '#f6f0df', 'center', '', 12);
    ctx.fillStyle = rgba(C.gold, 0.8); ctx.fillRect(W / 2 - 170, 190, 340, 1.5);
    text(ctx, CFG.boss.name + ' has fallen. Dawn may find the vale again.', W / 2, 216, 17, rgba(C.gold, 0.95), 'center', 'italic', 1);
    text(ctx, 'Time', W / 2 - 16, 290, 22, rgba(C.cyan, 0.95), 'right', 'italic');
    text(ctx, fmtTime(G.playTime), W / 2 + 16, 290, 26, '#fff', 'left');
    text(ctx, 'Deaths', W / 2 - 16, 330, 22, rgba(C.cyan, 0.95), 'right', 'italic');
    text(ctx, '' + G.deaths, W / 2 + 16, 330, 26, '#fff', 'left');
    text(ctx, 'Secret found', W / 2 - 16, 370, 22, rgba(C.cyan, 0.95), 'right', 'italic');
    text(ctx, G.flags.heart ? 'yes' : 'no', W / 2 + 16, 370, 26, '#fff', 'left');
    ctx.globalAlpha = clamp(alpha, 0, 1) * (0.55 + 0.45 * Math.sin(t * 3));
    text(ctx, 'Press Enter to return to the title', W / 2, 470, 19, '#fff', 'center', '', 3);
    ctx.restore();
  };

  return A;
})();
