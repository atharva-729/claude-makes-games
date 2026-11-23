// GLOAMREACH - ALL drawing lives here. Replace this file to reskin the game.
// Everything is drawn with canvas paths and gradients (no image files).
var ART = { rs: 1, chunks: {}, bg: null, light: null, lctx: null, time: 0 };

var FONT_DISPLAY = 'Georgia, "Palatino Linotype", "Times New Roman", serif';
var FONT_UI = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

function artHash(x, y) {
  var h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function rgba(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function glow(ctx, x, y, r, color, a) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ------------------------------------------------------------------ setup
function artSetScale(rs) {
  if (Math.abs(rs - ART.rs) > 0.01) { ART.rs = rs; ART.chunks = {}; ART.chunkOrder = []; ART.bg = null; }
  if (!ART.light) { ART.light = makeCanvas(480, 270); ART.lctx = ART.light.getContext('2d'); }
  if (!ART.bg) buildBackground();
}

// ------------------------------------------------------------------ background
function buildBackground() {
  var rs = Math.min(ART.rs, 1.5);
  var bg = { rs: rs };
  // far layer: mountains, spires
  bg.farW = 1800; bg.farH = 520;
  bg.far = makeCanvas(Math.ceil(bg.farW * rs), Math.ceil(bg.farH * rs));
  var c = bg.far.getContext('2d'); c.scale(rs, rs);
  var W = bg.farW, H = bg.farH, i, x;
  var gr = c.createLinearGradient(0, 120, 0, H);
  gr.addColorStop(0, '#10233a'); gr.addColorStop(1, '#0a1626');
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(0, H);
  for (x = 0; x <= W; x += 30) {
    var y = 260 + Math.sin(x * 0.004) * 60 + Math.sin(x * 0.011 + 1) * 28 + Math.sin(x * 0.031) * 8;
    c.lineTo(x, y);
  }
  c.lineTo(W, H); c.closePath(); c.fill();
  // spires
  var spires = [[180, 120, 16], [420, 70, 22], [460, 140, 12], [900, 90, 18], [1250, 60, 26], [1300, 150, 10], [1600, 110, 14]];
  spires.forEach(function (s) {
    c.fillStyle = '#0d1f33';
    c.beginPath(); c.moveTo(s[0] - s[2], 330); c.lineTo(s[0] - s[2] * 0.6, s[1] + 40); c.lineTo(s[0], s[1]);
    c.lineTo(s[0] + s[2] * 0.6, s[1] + 40); c.lineTo(s[0] + s[2], 330); c.fill();
    for (var k = 0; k < 3; k++) {
      if (artHash(s[0], k) > 0.45) { c.fillStyle = 'rgba(191,246,255,0.5)'; c.fillRect(s[0] - 1.5, s[1] + 60 + k * 40, 3, 5); }
    }
  });
  // far mist band
  var mg = c.createLinearGradient(0, 280, 0, 420);
  mg.addColorStop(0, 'rgba(60,120,150,0)'); mg.addColorStop(0.6, 'rgba(60,120,150,0.12)'); mg.addColorStop(1, 'rgba(60,120,150,0)');
  c.fillStyle = mg; c.fillRect(0, 280, W, 140);

  // mid layer: twisted trees, ruined arches
  bg.midW = 1500; bg.midH = 560;
  bg.mid = makeCanvas(Math.ceil(bg.midW * rs), Math.ceil(bg.midH * rs));
  c = bg.mid.getContext('2d'); c.scale(rs, rs);
  W = bg.midW; H = bg.midH;
  c.fillStyle = '#071220';
  c.beginPath(); c.moveTo(0, H);
  for (x = 0; x <= W; x += 20) c.lineTo(x, 400 + Math.sin(x * 0.007) * 30 + Math.sin(x * 0.023) * 10);
  c.lineTo(W, H); c.fill();
  // arches
  [[300, 250], [1050, 230]].forEach(function (a) {
    c.fillStyle = '#081525';
    c.beginPath();
    c.moveTo(a[0] - 90, 420); c.lineTo(a[0] - 90, a[1] + 40);
    c.quadraticCurveTo(a[0], a[1] - 60, a[0] + 90, a[1] + 40); c.lineTo(a[0] + 90, 420);
    c.lineTo(a[0] + 60, 420); c.lineTo(a[0] + 60, a[1] + 60);
    c.quadraticCurveTo(a[0], a[1] - 10, a[0] - 60, a[1] + 60); c.lineTo(a[0] - 60, 420); c.closePath(); c.fill();
    // broken top
    c.fillStyle = '#071220'; c.beginPath(); c.moveTo(a[0] + 20, a[1] - 18); c.lineTo(a[0] + 50, a[1] - 5); c.lineTo(a[0] + 35, a[1] + 15); c.fill();
  });
  // trees
  for (i = 0; i < 9; i++) {
    var tx = 80 + i * 170 + artHash(i, 7) * 60, th = 180 + artHash(i, 3) * 140;
    drawBgTree(c, tx, 420, th, 0.8 + artHash(i, 9) * 0.5, '#06101c');
  }
  // tiny lantern lights in mid layer
  for (i = 0; i < 7; i++) {
    var lx = 120 + i * 210 + artHash(i, 2) * 50, ly = 330 + artHash(i, 5) * 60;
    glow(c, lx, ly, 14, '#ffd27a', 0.35); c.fillStyle = 'rgba(255,220,150,0.9)'; c.fillRect(lx - 1, ly - 1, 2, 2);
  }
  ART.bg = bg;
}

function drawBgTree(c, x, base, h, s, col) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - 14 * s, base); c.quadraticCurveTo(x - 4 * s, base - h * 0.5, x - 6 * s, base - h);
  c.lineTo(x + 4 * s, base - h); c.quadraticCurveTo(x + 6 * s, base - h * 0.5, x + 16 * s, base); c.fill();
  function branch(bx, by, ang, len, w, d) {
    var ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    c.lineWidth = w; c.beginPath(); c.moveTo(bx, by);
    c.quadraticCurveTo((bx + ex) / 2 + Math.sin(ang) * 10, (by + ey) / 2, ex, ey); c.stroke();
    if (d > 0) {
      branch(ex, ey, ang - 0.5, len * 0.65, w * 0.6, d - 1);
      branch(ex, ey, ang + 0.4, len * 0.6, w * 0.6, d - 1);
    }
  }
  branch(x, base - h * 0.95, -Math.PI / 2 - 0.6, 50 * s, 6 * s, 2);
  branch(x, base - h * 0.8, -Math.PI / 2 + 0.7, 45 * s, 5 * s, 2);
  branch(x, base - h * 0.6, -Math.PI / 2 - 1.1, 35 * s, 4 * s, 1);
}

// sky + moon + far/mid parallax layers (screen space)
function drawBackground(ctx, cam, t, mood) {
  var W = CFG.W, H = CFG.H;
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, CFG.colors.skyTop); g.addColorStop(0.55, CFG.colors.skyMid); g.addColorStop(1, CFG.colors.skyLow);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  for (var i = 0; i < 70; i++) {
    var sx = (artHash(i, 1) * 1400 - cam.x * 0.02) % 1400; if (sx < 0) sx += 1400;
    var sy = artHash(i, 2) * 300 - cam.y * 0.02 + 20;
    var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + artHash(i, 3)) + i));
    ctx.fillStyle = 'rgba(200,230,255,' + (0.5 * tw) + ')';
    ctx.fillRect(sx - 40, sy, 1.5, 1.5);
  }
  // moon
  var mx = 850 - cam.x * 0.01, my = 96 - cam.y * 0.012;
  glow(ctx, mx, my, 220, '#9fd8ff', 0.16 * mood.moon);
  ctx.fillStyle = 'rgba(225,240,255,' + (0.85 * mood.moon) + ')';
  ctx.beginPath(); ctx.arc(mx, my, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,190,215,' + (0.35 * mood.moon) + ')';
  ctx.beginPath(); ctx.arc(mx - 12, my - 8, 10, 0, Math.PI * 2); ctx.arc(mx + 15, my + 12, 7, 0, Math.PI * 2); ctx.arc(mx + 8, my - 18, 5, 0, Math.PI * 2); ctx.fill();
  // drifting cloud bands across moon
  for (var k = 0; k < 3; k++) {
    var cx = ((t * (6 + k * 3) + k * 400 - cam.x * 0.03) % 1500) - 300;
    var cg = ctx.createRadialGradient(cx, my + 20 + k * 30, 0, cx, my + 20 + k * 30, 260);
    cg.addColorStop(0, 'rgba(20,40,60,0.45)'); cg.addColorStop(1, 'rgba(20,40,60,0)');
    ctx.fillStyle = cg; ctx.save(); ctx.translate(cx, my + 20 + k * 30); ctx.scale(1, 0.18); ctx.translate(-cx, -(my + 20 + k * 30));
    ctx.fillRect(cx - 260, my + 20 + k * 30 - 260, 520, 520); ctx.restore();
  }
  var bg = ART.bg;
  drawLayer(ctx, bg.far, bg.farW, bg.farH, cam.x * 0.12, 190 - cam.y * 0.08, '#0a1626');
  drawLayer(ctx, bg.mid, bg.midW, bg.midH, cam.x * 0.3, 360 - cam.y * 0.18, '#071220');
}
function drawLayer(ctx, img, w, h, ox, y, bottomColor) {
  var x = -(ox % w); if (x > 0) x -= w;
  y = Math.round(y);
  for (; x < CFG.W; x += w) ctx.drawImage(img, x, y, w, h);
  if (y + h < CFG.H) { ctx.fillStyle = bottomColor; ctx.fillRect(0, y + h - 1, CFG.W, CFG.H - y - h + 1); }
}

// foreground fog bands (screen space, drawn over the world)
function drawFog(ctx, cam, t, density) {
  for (var i = 0; i < 5; i++) {
    var w = 700 + i * 120;
    var x = ((i * 530 + t * (10 + i * 4) - cam.x * 1.25) % (CFG.W + w)) ;
    if (x < 0) x += CFG.W + w;
    x -= w * 0.5;
    var y = 380 + (i % 3) * 60 - ((cam.y * 1.2) % 200) * 0.2 + Math.sin(t * 0.3 + i) * 15;
    var g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.5);
    g.addColorStop(0, 'rgba(90,150,170,' + (0.085 * density) + ')');
    g.addColorStop(1, 'rgba(90,150,170,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.fillRect(x - w * 0.5, y - w * 0.5, w, w); ctx.restore();
  }
  // low ground fog gradient
  var lg = ctx.createLinearGradient(0, CFG.H - 140, 0, CFG.H);
  lg.addColorStop(0, 'rgba(60,110,130,0)'); lg.addColorStop(1, 'rgba(60,110,130,' + (0.12 * density) + ')');
  ctx.fillStyle = lg; ctx.fillRect(0, CFG.H - 140, CFG.W, 140);
}

// ------------------------------------------------------------------ tiles
function tileAt(map, tx, ty) {
  if (ty < 0 || ty >= map.length) return '#';
  var row = map[ty];
  if (tx < 0 || tx >= row.length) return '#';
  return row.charAt(tx);
}
function isRockish(ch) { return ch === '#' || ch === 'B'; }

function renderChunk(map, cx, cy) {
  var T = CFG.TILE, N = 16, rs = ART.rs;
  var cv = makeCanvas(Math.ceil(N * T * rs), Math.ceil(N * T * rs));
  var c = cv.getContext('2d');
  c.scale(rs, rs);
  c.translate(-cx * N * T, -cy * N * T);
  var x0 = cx * N, y0 = cy * N, tx, ty, ch;
  // pass 1: cave back walls
  for (ty = y0 - 1; ty < y0 + N + 1; ty++) for (tx = x0 - 1; tx < x0 + N + 1; tx++) {
    ch = tileAt(map, tx, ty);
    var cave = ch === ',' || ch === 'B' || ch === 'a' || ch === 'G';
    if (!cave && ch !== '.') {
      // spikes / ledges / rock touching a cave tile get a back wall too
      if (tileAt(map, tx - 1, ty) === ',' || tileAt(map, tx + 1, ty) === ',' || tileAt(map, tx, ty - 1) === ',' || tileAt(map, tx, ty + 1) === ',') cave = true;
    }
    if (cave) drawBackWallTile(c, map, tx, ty);
  }
  // pass 2: rock, spikes, ledges
  for (ty = y0; ty < y0 + N; ty++) for (tx = x0; tx < x0 + N; tx++) {
    ch = tileAt(map, tx, ty);
    if (ch === '#') drawRockTile(c, map, tx, ty);
    else if (ch === '^') drawSpikeTile(c, tx * T, ty * T, tx);
    else if (ch === '-') drawLedgeTile(c, map, tx, ty);
  }
  // pass 3: moss & grass on top edges (may overhang into neighbours)
  for (ty = y0; ty < y0 + N; ty++) for (tx = x0 - 1; tx < x0 + N + 1; tx++) {
    if (tileAt(map, tx, ty) === '#' && !isRockish(tileAt(map, tx, ty - 1)) && tileAt(map, tx, ty - 1) !== '^') drawMoss(c, tx, ty);
  }
  return cv;
}

function drawBackWallTile(c, map, tx, ty) {
  var T = CFG.TILE, x = tx * T, y = ty * T;
  c.fillStyle = CFG.colors.backWall; c.fillRect(x, y, T + 0.5, T + 0.5);
  var h = artHash(tx, ty);
  if (h > 0.55) {
    c.fillStyle = 'rgba(30,55,75,0.35)';
    c.beginPath(); c.ellipse(x + h * 24 + 4, y + artHash(ty, tx) * 24 + 4, 6 + h * 8, 4 + h * 4, h * 3, 0, Math.PI * 2); c.fill();
  }
  if (h < 0.12) {
    c.strokeStyle = 'rgba(4,8,14,0.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x + 8, y); c.lineTo(x + 14, y + 12); c.lineTo(x + 10, y + 22); c.lineTo(x + 16, y + 32); c.stroke();
  }
  // ambient occlusion near solid rock
  var g;
  if (tileAt(map, tx, ty - 1) === '#') { g = c.createLinearGradient(0, y, 0, y + 14); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, T, 14); }
  if (tileAt(map, tx - 1, ty) === '#') { g = c.createLinearGradient(x, 0, x + 12, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, 12, T); }
  if (tileAt(map, tx + 1, ty) === '#') { g = c.createLinearGradient(x + T, 0, x + T - 12, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x + T - 12, y, 12, T); }
}

function drawRockTile(c, map, tx, ty) {
  var T = CFG.TILE, x = tx * T, y = ty * T, r = 10;
  var up = !isRockish(tileAt(map, tx, ty - 1)), dn = !isRockish(tileAt(map, tx, ty + 1));
  var lf = !isRockish(tileAt(map, tx - 1, ty)), rt = !isRockish(tileAt(map, tx + 1, ty));
  var tl = up && lf ? r : 0, tr = up && rt ? r : 0, br = dn && rt ? r : 0, bl = dn && lf ? r : 0;
  c.fillStyle = CFG.colors.rock;
  c.beginPath();
  c.moveTo(x + tl, y); c.lineTo(x + T - tr, y);
  if (tr) c.quadraticCurveTo(x + T, y, x + T, y + tr); else c.lineTo(x + T, y);
  c.lineTo(x + T, y + T - br);
  if (br) c.quadraticCurveTo(x + T, y + T, x + T - br, y + T); else c.lineTo(x + T, y + T);
  c.lineTo(x + bl, y + T);
  if (bl) c.quadraticCurveTo(x, y + T, x, y + T - bl); else c.lineTo(x, y + T);
  c.lineTo(x, y + tl);
  if (tl) c.quadraticCurveTo(x, y, x + tl, y); else c.lineTo(x, y);
  c.closePath(); c.fill();
  // stones texture
  var h = artHash(tx * 3, ty * 7);
  c.fillStyle = 'rgba(25,45,65,0.32)';
  c.beginPath(); c.ellipse(x + 6 + h * 18, y + 8 + artHash(tx, ty * 5) * 16, 5 + h * 5, 3 + h * 2, h * 2, 0, Math.PI * 2); c.fill();
  if (h > 0.6) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x + 22 - h * 10, y + 22, 4, 2.5, 0.4, 0, Math.PI * 2); c.fill(); }
  // rim light
  c.lineWidth = 2;
  if (lf) { c.strokeStyle = 'rgba(40,85,110,0.55)'; c.beginPath(); c.moveTo(x + 1, y + tl); c.lineTo(x + 1, y + T - bl); c.stroke(); }
  if (rt) { c.strokeStyle = 'rgba(40,85,110,0.55)'; c.beginPath(); c.moveTo(x + T - 1, y + tr); c.lineTo(x + T - 1, y + T - br); c.stroke(); }
  if (dn) {
    c.fillStyle = CFG.colors.rock;
    var n = 2 + Math.floor(h * 2);
    for (var i = 0; i < n; i++) {
      var dx = x + 5 + (i + 0.5) * (T - 10) / n, dl = 4 + artHash(tx + i, ty) * 9;
      c.beginPath(); c.moveTo(dx - 4, y + T - 1); c.quadraticCurveTo(dx, y + T + dl * 0.4, dx, y + T + dl); c.quadraticCurveTo(dx + 1, y + T + dl * 0.4, dx + 4, y + T - 1); c.fill();
    }
    c.strokeStyle = 'rgba(20,40,60,0.6)'; c.beginPath(); c.moveTo(x + bl, y + T - 1); c.lineTo(x + T - br, y + T - 1); c.stroke();
  }
}

function drawMoss(c, tx, ty) {
  var T = CFG.TILE, x = tx * T, y = ty * T;
  var h = artHash(tx, ty + 99);
  c.fillStyle = '#123a3e';
  c.beginPath(); c.moveTo(x - 1, y - 1);
  c.lineTo(x + T + 1, y - 1);
  c.lineTo(x + T + 1, y + 4);
  c.quadraticCurveTo(x + T * 0.75, y + 7 + h * 5, x + T * 0.5, y + 4);
  c.quadraticCurveTo(x + T * 0.25, y + 9 - h * 4, x - 1, y + 4);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(79,179,164,0.55)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + T, y); c.stroke();
  c.strokeStyle = '#1f5a57'; c.lineWidth = 1.3; c.lineCap = 'round';
  for (var i = 0; i < 4; i++) {
    var bx = x + 3 + i * 8 + artHash(tx, i) * 4, bh = 3 + artHash(i, tx + ty) * 7;
    c.beginPath(); c.moveTo(bx, y + 1); c.quadraticCurveTo(bx + 1, y - bh * 0.5, bx + (artHash(tx + i, 3) - 0.5) * 6, y - bh); c.stroke();
  }
  if (h > 0.8) { // little glowing mushroom
    c.fillStyle = '#2b5f6a'; c.fillRect(x + 20, y - 5, 1.5, 5);
    c.fillStyle = 'rgba(160,240,255,0.9)'; c.beginPath(); c.ellipse(x + 20.7, y - 5, 3.5, 2, 0, Math.PI, 0); c.fill();
  }
}

function drawSpikeTile(c, x, y, tx) {
  var T = CFG.TILE;
  for (var i = 0; i < 3; i++) {
    var bx = x + 2 + i * 10, h = 18 + artHash(tx, i) * 6;
    var g = c.createLinearGradient(0, y + T - h, 0, y + T);
    g.addColorStop(0, '#e6eef7'); g.addColorStop(0.35, '#8a98b5'); g.addColorStop(1, '#1b2232');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(bx, y + T); c.quadraticCurveTo(bx + 4, y + T - h * 0.5, bx + 5, y + T - h); c.quadraticCurveTo(bx + 6, y + T - h * 0.5, bx + 10, y + T); c.fill();
  }
  c.fillStyle = 'rgba(180,140,255,0.18)'; c.fillRect(x, y + T - 4, T, 4);
}
function drawLedgeTile(c, map, tx, ty) {
  var T = CFG.TILE, x = tx * T, y = ty * T;
  var lEnd = tileAt(map, tx - 1, ty) !== '-', rEnd = tileAt(map, tx + 1, ty) !== '-';
  c.fillStyle = '#0d1b2b';
  c.beginPath();
  c.moveTo(x + (lEnd ? 4 : 0), y); c.lineTo(x + T - (rEnd ? 4 : 0), y);
  c.lineTo(x + T - (rEnd ? 8 : 0), y + 11); c.lineTo(x + (lEnd ? 8 : 0), y + 11); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(79,179,164,0.6)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x + (lEnd ? 4 : 0), y + 0.5); c.lineTo(x + T - (rEnd ? 4 : 0), y + 0.5); c.stroke();
  c.strokeStyle = 'rgba(20,50,55,0.9)'; c.lineWidth = 1;
  var h = artHash(tx, ty);
  c.beginPath(); c.moveTo(x + 10 + h * 10, y + 10); c.quadraticCurveTo(x + 12 + h * 10, y + 18, x + 9 + h * 10, y + 22 + h * 8); c.stroke();
}

function drawTiles(ctx, map, cam) {
  var N = 16 * CFG.TILE;
  var cx0 = Math.floor(cam.x / N), cx1 = Math.floor((cam.x + CFG.W) / N);
  var cy0 = Math.floor(cam.y / N), cy1 = Math.floor((cam.y + CFG.H) / N);
  for (var cy = cy0; cy <= cy1; cy++) for (var cx = cx0; cx <= cx1; cx++) {
    if (cx < 0 || cy < 0) continue;
    var key = cx + ',' + cy;
    var ch = ART.chunks[key];
    if (!ch) {
      ch = ART.chunks[key] = renderChunk(map, cx, cy);
      ART.chunkOrder = ART.chunkOrder || [];
      ART.chunkOrder.push(key);
      if (ART.chunkOrder.length > 18) delete ART.chunks[ART.chunkOrder.shift()];
    }
    ctx.drawImage(ch, cx * N, cy * N, N, N);
  }
}

// dynamic tiles
function drawBreakable(ctx, tx, ty, t, hp) {
  var T = CFG.TILE, x = tx * T, y = ty * T;
  ctx.fillStyle = '#0a1220'; ctx.fillRect(x, y, T, T);
  ctx.fillStyle = '#0c1626';
  ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + T - 3, y + 1); ctx.lineTo(x + T - 1, y + T - 2); ctx.lineTo(x + 1, y + T - 1); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,' + (0.25 + 0.15 * Math.sin(t * 2 + ty) + (3 - hp) * 0.15) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + 14, y + 14); ctx.lineTo(x + 11, y + 24); ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + 26, y + 10);
  ctx.moveTo(x + 20, y + 30); ctx.lineTo(x + 17, y + 22); ctx.lineTo(x + 27, y + 19); ctx.stroke();
}
function drawGate(ctx, tx, ty0, ty1, amount, t) {
  // amount: 0 open .. 1 shut. Bars descend from above.
  if (amount <= 0.01) return;
  var T = CFG.TILE, x = tx * T, top = ty0 * T, full = (ty1 - ty0 + 1) * T;
  var len = full * amount;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 4, top, T + 8, full); ctx.clip();
  for (var i = 0; i < 3; i++) {
    var bx = x + 5 + i * 11;
    var g = ctx.createLinearGradient(bx - 3, 0, bx + 3, 0);
    g.addColorStop(0, '#1b1530'); g.addColorStop(0.5, '#4a3d6e'); g.addColorStop(1, '#120e22');
    ctx.fillStyle = g;
    ctx.fillRect(bx - 3, top, 6, len - 8);
    ctx.beginPath(); ctx.moveTo(bx - 4, top + len - 10); ctx.lineTo(bx, top + len); ctx.lineTo(bx + 4, top + len - 10); ctx.fill();
  }
  ctx.fillStyle = '#2a2142'; ctx.fillRect(x, top + len * 0.3, T, 4); ctx.fillRect(x, top + len * 0.7, T, 4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(180,140,255,' + (0.12 + 0.06 * Math.sin(t * 4)) + ')';
  ctx.fillRect(x + 2, top, T - 4, len);
  ctx.restore();
}
function drawRisingSpikes(ctx, tx, ty, amount) {
  if (amount <= 0) return;
  var T = CFG.TILE;
  ctx.save(); ctx.beginPath(); ctx.rect(tx * T, ty * T, T, T); ctx.clip();
  ctx.translate(0, (1 - amount) * T);
  drawSpikeTile(ctx, tx * T, ty * T, tx);
  ctx.restore();
}

// ------------------------------------------------------------------ decor
function drawLanternPost(ctx, d, t) {
  var x = d.px, y = d.py; // feet
  ctx.strokeStyle = '#0b1522'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3, y - 40, x + 2, y - 70); ctx.quadraticCurveTo(x + 6, y - 82, x + 16, y - 80); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 16, y - 80); ctx.lineTo(x + 16, y - 72); ctx.stroke();
  var fl = 0.85 + 0.15 * Math.sin(t * 9 + d.px) * Math.sin(t * 5.3);
  ctx.fillStyle = '#16202e';
  ctx.beginPath(); ctx.moveTo(x + 10, y - 72); ctx.lineTo(x + 22, y - 72); ctx.lineTo(x + 20, y - 56); ctx.lineTo(x + 12, y - 56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,' + fl + ')';
  ctx.beginPath(); ctx.moveTo(x + 12.5, y - 70); ctx.lineTo(x + 19.5, y - 70); ctx.lineTo(x + 18.5, y - 58); ctx.lineTo(x + 13.5, y - 58); ctx.closePath(); ctx.fill();
  glow(ctx, x + 16, y - 64, 26, '#ffd27a', 0.5 * fl);
}
function drawHangLamp(ctx, d, t) {
  var x = d.px + Math.sin(t * 0.8 + d.px) * 2, y = d.py;
  ctx.strokeStyle = '#0b1522'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(d.px, d.top); ctx.lineTo(x, y - 12); ctx.stroke();
  var fl = 0.85 + 0.15 * Math.sin(t * 7 + d.px);
  ctx.fillStyle = '#16202e'; ctx.beginPath(); ctx.ellipse(x, y - 4, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,' + fl + ')'; ctx.beginPath(); ctx.ellipse(x, y - 4, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  glow(ctx, x, y - 4, 22, '#ffd27a', 0.5 * fl);
}
function drawCrystal(ctx, d, t) {
  var x = d.px, y = d.py, p = 0.8 + 0.2 * Math.sin(t * 2 + d.px);
  var sh = [[-8, 18, -0.3], [0, 26, 0.05], [7, 16, 0.4], [-3, 12, -0.7]];
  sh.forEach(function (s) {
    ctx.save(); ctx.translate(x + s[0], y); ctx.rotate(s[2]);
    var g = ctx.createLinearGradient(-4, 0, 4, -s[1]);
    g.addColorStop(0, '#1b5d73'); g.addColorStop(1, 'rgba(200,250,255,' + p + ')');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -s[1] * 0.7); ctx.lineTo(0, -s[1]); ctx.lineTo(4, -s[1] * 0.7); ctx.lineTo(4, 0); ctx.fill();
    ctx.restore();
  });
  glow(ctx, x, y - 12, 30, '#bff6ff', 0.35 * p);
}
function drawBrazier(ctx, d, t, power) {
  var x = d.px, y = d.py;
  ctx.fillStyle = '#0d0b18';
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 3, y - 30); ctx.lineTo(x + 3, y - 30); ctx.lineTo(x + 6, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 16, y - 40); ctx.quadraticCurveTo(x, y - 24, x + 16, y - 40); ctx.lineTo(x + 12, y - 30); ctx.lineTo(x - 12, y - 30); ctx.fill();
  if (power <= 0.05) return;
  for (var i = 0; i < 3; i++) {
    var fh = (18 + 8 * Math.sin(t * 8 + i * 2)) * power, fx = x - 6 + i * 6;
    ctx.fillStyle = i === 1 ? 'rgba(255,230,180,0.9)' : 'rgba(190,140,255,0.8)';
    ctx.beginPath(); ctx.moveTo(fx - 5, y - 40); ctx.quadraticCurveTo(fx - 4, y - 40 - fh * 0.6, fx, y - 40 - fh); ctx.quadraticCurveTo(fx + 4, y - 40 - fh * 0.6, fx + 5, y - 40); ctx.fill();
  }
  glow(ctx, x, y - 50, 40, '#c9a8ff', 0.4 * power);
}
function drawSign(ctx, d, t, alpha) {
  var x = d.px, y = d.py;
  ctx.fillStyle = '#0c1724';
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 7, y - 30); ctx.quadraticCurveTo(x, y - 38, x + 7, y - 30); ctx.lineTo(x + 9, y); ctx.fill();
  ctx.strokeStyle = 'rgba(191,246,255,' + (0.35 + 0.4 * alpha) + ')'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x, y - 22, 4, 0, Math.PI * 2); ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 8); ctx.stroke();
  if (alpha > 0.01) {
    glow(ctx, x, y - 22, 20, '#bff6ff', 0.3 * alpha);
    ctx.font = '15px ' + FONT_DISPLAY; ctx.textAlign = 'center';
    var txt = Controls.fill(d.text), tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(3,8,16,' + (0.55 * alpha) + ')';
    ctx.fillRect(x - tw / 2 - 12, y - 78, tw + 24, 26);
    ctx.fillStyle = 'rgba(214,246,255,' + alpha + ')';
    ctx.fillText(txt, x, y - 60);
  }
}
function drawRestPoint(ctx, r, t, active, near) {
  var x = r.px, y = r.py;
  // stone shrine with a hovering ember
  ctx.fillStyle = '#0e1726';
  ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 24, y - 12); ctx.lineTo(x + 24, y - 12); ctx.lineTo(x + 30, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 18, y - 12); ctx.lineTo(x - 14, y - 52); ctx.quadraticCurveTo(x, y - 70, x + 14, y - 52); ctx.lineTo(x + 18, y - 12); ctx.fill();
  ctx.fillStyle = '#060a12';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 14); ctx.lineTo(x - 8, y - 46); ctx.quadraticCurveTo(x, y - 56, x + 8, y - 46); ctx.lineTo(x + 9, y - 14); ctx.fill();
  var p = active ? 1 : 0.55;
  var by = y - 34 + Math.sin(t * 1.6) * 3;
  glow(ctx, x, by, 60, '#ffd27a', 0.35 * p);
  ctx.fillStyle = 'rgba(255,236,190,' + (0.9 * p + 0.1) + ')';
  ctx.beginPath(); ctx.moveTo(x, by - 9); ctx.quadraticCurveTo(x + 6, by, x, by + 6); ctx.quadraticCurveTo(x - 6, by, x, by - 9); ctx.fill();
  // runes
  ctx.strokeStyle = 'rgba(255,210,122,' + (0.25 + 0.35 * p) + ')'; ctx.lineWidth = 1.2;
  for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 20 + i * 20, y - 6, 2.5, 0, Math.PI * 2); ctx.stroke(); }
  if (near) {
    ctx.font = '16px ' + FONT_DISPLAY; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,236,190,' + (0.7 + 0.3 * Math.sin(t * 4)) + ')';
    ctx.fillText(active ? 'Rested' : '↑  Rest', x, y - 84);
  }
}
function drawHeartPickup(ctx, h, t) {
  var x = h.px, y = h.py - 26 + Math.sin(t * 2) * 4;
  glow(ctx, x, y, 50, '#ffb36b', 0.4);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3) * 0.15);
  ctx.fillStyle = '#2a1410';
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(14, -4, 0, 14); ctx.quadraticCurveTo(-14, -4, 0, -16); ctx.fill();
  ctx.fillStyle = 'rgba(255,190,110,' + (0.85 + 0.15 * Math.sin(t * 5)) + ')';
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(9, -2, 0, 9); ctx.quadraticCurveTo(-9, -2, 0, -11); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,230,0.9)';
  ctx.beginPath(); ctx.ellipse(-2, -3, 2, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ player
function drawAfterimages(ctx, p) {
  for (var i = 0; i < p.afterimages.length; i++) {
    var a = p.afterimages[i];
    var al = a.life / 0.25;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.f, 1);
    ctx.fillStyle = 'rgba(140,230,255,' + (0.35 * al) + ')';
    ctx.beginPath(); ctx.moveTo(-9, -34); ctx.quadraticCurveTo(-14, -14, -16, -4); ctx.lineTo(12, -4); ctx.quadraticCurveTo(10, -18, 8, -34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(1, -38, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, p, t) {
  if (p.dead) return;
  if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 && p.hurtT <= 0) ctx.globalAlpha = 0.35;
  var x = p.x + p.w / 2, y = p.y + p.h;
  var hurt = p.hurtT > 0;
  var f = p.facing;
  ctx.save(); ctx.translate(x, y);
  ctx.scale(f / p.sq, p.sq);
  var run = p.onGround && Math.abs(p.vx) > 30 && !p.healing;
  var bob = p.onGround ? (run ? Math.abs(Math.sin(p.runPhase)) * -2 : Math.sin(t * 2.2) * 0.8) : 0;
  var crouch = p.healing ? 6 : 0;
  var lean = clamp01(Math.abs(p.vx) / 300) * 0.12 * (p.dashT > 0 ? 2 : 1);
  if (hurt) lean = -0.3;
  if (p.wallSliding) lean = 0;
  ctx.rotate(lean);
  ctx.translate(0, bob + crouch);
  var body = hurt ? '#ffffff' : '#123a44', bodyDark = hurt ? '#e8f4ff' : '#0a2229', edge = hurt ? '#ffffff' : '#2f8a8c';

  // legs
  ctx.strokeStyle = hurt ? '#fff' : '#08161b'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  var lp = run ? Math.sin(p.runPhase) : 0;
  if (!p.onGround && !p.wallSliding) {
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(-6, -2); ctx.moveTo(3, -10); ctx.lineTo(6, -4); ctx.stroke();
  } else if (p.healing) {
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(-8, -6); ctx.lineTo(-7, 0); ctx.moveTo(3, -10); ctx.lineTo(8, -2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + lp * 7, 0 - Math.max(0, -lp) * 3);
    ctx.moveTo(2, -10); ctx.lineTo(2 - lp * 7, 0 - Math.max(0, lp) * 3); ctx.stroke();
  }
  // cloak
  var trail = -clamp01(Math.abs(p.vx) / 320) * 9;
  var lift = p.onGround ? 0 : clamp01(p.vy / 600) * 8 - clamp01(-p.vy / 600) * 3;
  if (p.wallSliding) { trail = -4; lift = 6; }
  var wave = Math.sin(t * 6 + p.runPhase) * 1.5;
  var cg = ctx.createLinearGradient(0, -36, 0, -4);
  cg.addColorStop(0, body); cg.addColorStop(1, bodyDark);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-7, -34);
  ctx.quadraticCurveTo(-12 + trail * 0.4, -20, -14 + trail, -6 - lift + wave);
  ctx.lineTo(-6 + trail * 0.5, -8 - lift * 0.5 - wave);
  ctx.lineTo(2 + trail * 0.2, -6 - lift * 0.3 + wave);
  ctx.lineTo(11, -8 - lift * 0.2);
  ctx.quadraticCurveTo(10, -22, 7, -34);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(7, -34); ctx.quadraticCurveTo(10, -22, 11, -8 - lift * 0.2); ctx.stroke();
  // sword arm
  var sw = p.slashAnim > 0;
  ctx.strokeStyle = hurt ? '#fff' : '#d9e8f0'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (sw) {
    var k = 1 - p.slashAnim / 0.2;
    if (p.slashDir === 'up') { ctx.moveTo(4, -26); ctx.lineTo(8 - k * 4, -52); }
    else if (p.slashDir === 'down') { ctx.moveTo(4, -18); ctx.lineTo(6 + k * 2, 8); }
    else { ctx.moveTo(6, -24); ctx.lineTo(30, -26 + k * 14); }
  } else if (p.healing) {
    ctx.moveTo(4, -18); ctx.lineTo(16, -2);
  } else {
    ctx.moveTo(6, -20); ctx.lineTo(-10, -4);
  }
  ctx.stroke();
  // hood + mask head
  ctx.fillStyle = hurt ? '#fff' : '#0b2229';
  ctx.beginPath(); ctx.arc(0, -38, 11, 0, Math.PI * 2); ctx.fill();
  var mg = ctx.createRadialGradient(3, -41, 1, 2, -38, 9);
  mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, hurt ? '#ffffff' : '#bfd3d6');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.ellipse(2.5, -38, 7.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#081418';
  if (hurt) { ctx.fillRect(1, -40, 3, 1.5); ctx.fillRect(6, -40, 3, 1.5); }
  else {
    ctx.beginPath(); ctx.ellipse(2.3, -38.5, 1.6, 2.8, 0, 0, Math.PI * 2); ctx.ellipse(7.2, -38.5, 1.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  // the wick flame on the head
  var fh = 10 + Math.sin(t * 13) * 1.5 + Math.sin(t * 7.7) * 1 + (p.healing ? 6 * (p.healT / CFG.player.healTime) + 3 : 0);
  var sway = -clamp01(p.vx / 300) * 4 - (p.onGround ? 0 : clamp01(-p.vy / 700) * -2);
  ctx.fillStyle = 'rgba(160,240,255,0.95)';
  ctx.beginPath(); ctx.moveTo(-3, -46); ctx.quadraticCurveTo(-4 + sway * 0.5, -46 - fh * 0.6, sway, -46 - fh);
  ctx.quadraticCurveTo(4 + sway * 0.5, -46 - fh * 0.6, 3, -46); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.ellipse(sway * 0.3, -48, 1.6, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  // flame glow (additive)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x + f * 1, y - 54 + crouch, 26, '#9fefff', 0.35);
  if (p.healing) glow(ctx, x, y - 26, 50 + 20 * (p.healT / CFG.player.healTime), '#bff6ff', 0.25 + 0.3 * (p.healT / CFG.player.healTime));
  ctx.restore();
}

function drawSlash(ctx, p) {
  if (p.slashAnim <= 0 || p.dead) return;
  var k = 1 - p.slashAnim / 0.2; // 0..1
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var a0, a1, r = 46, ox = 0, oy = 0;
  if (p.slashDir === 'up') { ox = 0; oy = -24; a0 = Math.PI * 1.05; a1 = Math.PI * 1.95; }
  else if (p.slashDir === 'down') { ox = 0; oy = 26; a0 = Math.PI * 0.05; a1 = Math.PI * 0.95; }
  else { ox = p.facing * 18; oy = -2; a0 = -Math.PI * 0.42; a1 = Math.PI * 0.42; if (p.facing < 0) { a0 = Math.PI * 0.58; a1 = Math.PI * 1.42; } }
  var x = cx + ox, y = cy + oy;
  var sweep = Math.min(1, k * 2.2);
  var aStart = a0, aEnd = a0 + (a1 - a0) * sweep;
  if (p.slashDir === 'fwd' && p.facing < 0) { aStart = a1 - (a1 - a0) * sweep; aEnd = a1; }
  if (p.slashDir === 'down') { aStart = a1 - (a1 - a0) * sweep; aEnd = a1; }
  var alpha = 1 - Math.max(0, k - 0.35) / 0.65;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(200,250,255,' + (0.75 * alpha) + ')';
  ctx.beginPath();
  ctx.arc(x, y, r, aStart, aEnd, false);
  var mid = (aStart + aEnd) / 2;
  ctx.quadraticCurveTo(x + Math.cos(mid) * r * 0.35, y + Math.sin(mid) * r * 0.35, x + Math.cos(aStart) * r, y + Math.sin(aStart) * r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, aStart, aEnd, false); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,220,255,' + (0.5 * alpha) + ')'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(x, y, r - 5, aStart, aEnd, false); ctx.stroke();
  ctx.restore();
}

function drawHealRing(ctx, p) {
  if (!p.healing) return;
  var k = p.healT / CFG.player.healTime;
  ctx.strokeStyle = 'rgba(191,246,255,0.8)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y - 18, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
}

// ------------------------------------------------------------------ enemies
function eCol(e, c) { return e.flash > 0 ? '#ffffff' : c; }

function drawEnemy(ctx, e, t) {
  var d = e.dying > 0 ? e.dying / 0.4 : 1;
  ctx.save();
  if (e.dying > 0) ctx.globalAlpha = d;
  if (e.type === 'crawler' || e.type === 'grub') drawCrawler(ctx, e, t, d);
  else if (e.type === 'flyer' || e.type === 'wisp') drawFlyer(ctx, e, t, d);
  else if (e.type === 'spitter') drawSpitter(ctx, e, t, d);
  ctx.restore();
}

function drawCrawler(ctx, e, t, d) {
  var x = e.x + e.w / 2, y = e.y + e.h;
  var grub = e.type === 'grub';
  ctx.save(); ctx.translate(x, y);
  ctx.scale(e.dir, 1);
  if (e.dying > 0) { ctx.rotate((1 - d) * 2.4); ctx.translate(0, -(1 - d) * 10); ctx.scale(1, 0.5 + d * 0.5); }
  var step = e.walk;
  if (grub) {
    // soft pale grub with a little lantern-bulb on its back
    for (var i = 3; i >= 0; i--) {
      var sx = -12 + i * 7, sy = -8 - Math.abs(Math.sin(step + i * 0.9)) * 2;
      ctx.fillStyle = eCol(e, i === 3 ? '#a9c4c8' : '#6f8f99');
      ctx.beginPath(); ctx.ellipse(sx, sy, 7, 7 - i * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#1a2a30'; ctx.beginPath(); ctx.arc(11, -9, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eCol(e, 'rgba(191,246,255,0.9)'); ctx.beginPath(); ctx.arc(-6, -19, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6f8f99'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -15); ctx.lineTo(-6, -17); ctx.stroke();
    ctx.restore();
    return;
  }
  // legs
  ctx.strokeStyle = eCol(e, '#0b1a22'); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (var l = 0; l < 3; l++) {
    var lx = -9 + l * 9, ph = step * 1.0 + l * 2.1;
    ctx.beginPath(); ctx.moveTo(lx, -8); ctx.lineTo(lx + Math.sin(ph) * 4 - 3, -3); ctx.lineTo(lx + Math.sin(ph) * 6 - 2, 0 - Math.max(0, Math.cos(ph)) * 2); ctx.stroke();
  }
  // shell
  var sg = ctx.createLinearGradient(0, -26, 0, -6);
  sg.addColorStop(0, eCol(e, '#4a7590')); sg.addColorStop(1, eCol(e, '#16293a'));
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(-18, -6); ctx.quadraticCurveTo(-18, -26, 0, -26); ctx.quadraticCurveTo(16, -26, 18, -8); ctx.lineTo(18, -6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = eCol(e, 'rgba(140,220,230,0.55)'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-15, -14); ctx.quadraticCurveTo(-12, -25, 0, -25); ctx.quadraticCurveTo(12, -25, 16, -14); ctx.stroke();
  // plates
  ctx.strokeStyle = eCol(e, '#08121a'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, -25); ctx.quadraticCurveTo(-9, -15, -8, -6); ctx.moveTo(6, -25); ctx.quadraticCurveTo(8, -15, 7, -6); ctx.stroke();
  // head + mandibles
  ctx.fillStyle = eCol(e, '#0c1820');
  ctx.beginPath(); ctx.ellipse(18, -9, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = eCol(e, '#9fb7c2'); ctx.lineWidth = 1.6;
  var m = Math.sin(t * 8 + e.x) * 0.3;
  ctx.beginPath(); ctx.moveTo(23, -8); ctx.quadraticCurveTo(28, -10 - m * 4, 27, -4); ctx.moveTo(23, -7); ctx.quadraticCurveTo(27, -2 + m * 4, 24, -1); ctx.stroke();
  // glowing spots
  var gl = 0.6 + 0.4 * Math.sin(t * 3 + e.x * 0.1);
  ctx.fillStyle = e.flash > 0 ? '#fff' : 'rgba(110,240,220,' + gl + ')';
  ctx.beginPath(); ctx.arc(-11, -15, 2, 0, Math.PI * 2); ctx.arc(0, -19, 2.4, 0, Math.PI * 2); ctx.arc(11, -14, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#d8fff7';
  ctx.beginPath(); ctx.arc(20, -10, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFlyer(ctx, e, t, d) {
  var x = e.x + e.w / 2, y = e.y + e.h / 2;
  var wisp = e.type === 'wisp';
  var s = wisp ? 0.75 : 1;
  var wind = e.state === 'wind';
  var shake = wind ? (Math.random() - 0.5) * 3 : 0;
  ctx.save(); ctx.translate(x + shake, y); ctx.scale(s * (e.face || 1), s);
  if (e.dying > 0) { ctx.rotate((1 - d) * 3); ctx.scale(d, d); }
  var flap = Math.sin(t * (wind ? 30 : 16) + e.x);
  var spread = wind ? 1.3 : 1;
  var wc = wisp ? '#2a1d44' : '#14233a';
  // wings
  ctx.fillStyle = eCol(e, wc);
  for (var side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.scale(side, 1);
    ctx.rotate(-flap * 0.5 * spread);
    ctx.beginPath(); ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(18 * spread, -22, 30 * spread, -10);
    ctx.lineTo(24 * spread, -4); ctx.lineTo(27 * spread, 2); ctx.lineTo(18 * spread, 2); ctx.lineTo(16 * spread, 8);
    ctx.quadraticCurveTo(10, 6, 4, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = eCol(e, wisp ? '#6a4fa0' : '#2c4a6a'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(24 * spread, -10); ctx.moveTo(5, 1); ctx.lineTo(18 * spread, 1); ctx.stroke();
    ctx.restore();
  }
  // body
  var bg = ctx.createRadialGradient(-2, -4, 2, 0, 0, 13);
  bg.addColorStop(0, eCol(e, wisp ? '#4b3a78' : '#2b4766')); bg.addColorStop(1, eCol(e, wisp ? '#170f2a' : '#0b1626'));
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
  // little tail
  ctx.beginPath(); ctx.moveTo(-4, 10); ctx.quadraticCurveTo(0, 22, 2, 16); ctx.quadraticCurveTo(3, 12, 4, 10); ctx.fill();
  // eye
  var ec = wind ? '#ff5c8a' : (wisp ? '#e2b8ff' : '#c8a6ff');
  ctx.fillStyle = e.flash > 0 ? '#fff' : ec;
  ctx.beginPath(); ctx.ellipse(3, -1, wind ? 6 : 5, wind ? 6 : 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12081c'; ctx.beginPath(); ctx.ellipse(4, -1, 1.6, wind ? 4.5 : 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x + 3 * (e.face || 1), y - 1, wind ? 34 : 18, wind ? '#ff5c8a' : '#b48cff', wind ? 0.55 : 0.3);
  ctx.restore();
}

function drawSpitter(ctx, e, t, d) {
  var x = e.x + e.w / 2, y = e.y + e.h;
  var wind = e.state === 'wind';
  var k = wind ? 1 - e.t / CFG.enemies.spitter.windup : 0;
  var recoil = e.recoil > 0 ? e.recoil / 0.3 : 0;
  var swell = 1 + k * 0.28 - recoil * 0.15;
  var jolt = e.kbT > 0 ? e.kbVx * 0.02 : 0;
  ctx.save(); ctx.translate(x + jolt, y);
  if (e.dying > 0) { ctx.scale(1 + (1 - d) * 0.4, d); }
  // roots
  ctx.strokeStyle = eCol(e, '#0c1a1c'); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -4); ctx.quadraticCurveTo(-12, -2, -16, 0); ctx.moveTo(4, -4); ctx.quadraticCurveTo(12, -2, 17, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 0); ctx.stroke();
  // stalk
  var sway = Math.sin(t * 1.5 + e.x) * 2 + e.face * k * -3;
  ctx.strokeStyle = eCol(e, '#16302e'); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(sway, -14, sway * 1.5, -22); ctx.stroke();
  // pod
  ctx.translate(sway * 1.5, -28);
  ctx.scale(swell, swell);
  var pg = ctx.createRadialGradient(-3, -4, 2, 0, 0, 16);
  pg.addColorStop(0, eCol(e, '#3c5f3a')); pg.addColorStop(1, eCol(e, '#0f2219'));
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 14, 0, 0, Math.PI * 2); ctx.fill();
  // glowing veins / sac
  var gl = 0.45 + 0.4 * k + 0.1 * Math.sin(t * 4);
  ctx.fillStyle = e.flash > 0 ? '#fff' : 'rgba(210,255,140,' + gl + ')';
  ctx.beginPath(); ctx.ellipse(-2, 3, 6 + k * 2, 5 + k * 2, 0, 0, Math.PI * 2); ctx.fill();
  // petals / teeth ring on top (mouth)
  ctx.fillStyle = eCol(e, '#1d3a2a');
  var open = 0.2 + k * 0.8 + recoil * 0.6;
  for (var i = 0; i < 5; i++) {
    var a = -Math.PI / 2 + (i - 2) * 0.45;
    ctx.save(); ctx.translate(Math.cos(a) * 10, Math.sin(a) * 10 - 2); ctx.rotate(a + Math.PI / 2 + (i - 2) * open * 0.25);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(0, -10 - open * 6, 4, 0); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#05100a';
  ctx.beginPath(); ctx.ellipse(0, -10, 4 + open * 3, 1.5 + open * 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x + sway * 1.5, y - 26, 26 + k * 30, '#c8ff8a', 0.25 + k * 0.4);
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles
function drawProjectile(ctx, pr, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pr.kind === 'spit') {
    glow(ctx, pr.x, pr.y, 22, '#c8ff8a', 0.55);
    ctx.fillStyle = 'rgba(230,255,190,0.95)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,220,90,0.5)'; ctx.beginPath(); ctx.arc(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, pr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  } else if (pr.kind === 'orb') {
    glow(ctx, pr.x, pr.y, 30, '#ffb86b', 0.6);
    ctx.fillStyle = 'rgba(255,230,170,0.95)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,150,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r + Math.sin(t * 20) * 2, 0, Math.PI * 2); ctx.stroke();
  } else if (pr.kind === 'wave') {
    var h = pr.h, x = pr.x, yb = pr.y;
    for (var i = 0; i < 3; i++) {
      var fx = x + (i - 1) * 8 * pr.dir * -1, fh = h * (1 - i * 0.25) * (0.85 + 0.15 * Math.sin(t * 30 + i));
      ctx.fillStyle = i === 0 ? 'rgba(240,220,255,0.9)' : 'rgba(170,120,255,' + (0.7 - i * 0.2) + ')';
      ctx.beginPath(); ctx.moveTo(fx - 10, yb); ctx.quadraticCurveTo(fx - 6, yb - fh * 0.6, fx + pr.dir * 3, yb - fh); ctx.quadraticCurveTo(fx + 6, yb - fh * 0.5, fx + 10, yb); ctx.fill();
    }
    glow(ctx, x, yb - h * 0.4, 40, '#b48cff', 0.4);
  } else if (pr.kind === 'debris') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1c2638';
    ctx.beginPath(); ctx.moveTo(pr.x - 10, pr.y - 30); ctx.lineTo(pr.x + 10, pr.y - 30); ctx.lineTo(pr.x + 3, pr.y); ctx.lineTo(pr.x - 2, pr.y + 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8fa0c0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pr.x + 10, pr.y - 30); ctx.lineTo(pr.x - 2, pr.y + 6); ctx.stroke();
  }
  ctx.restore();
}
function drawBolt(ctx, b, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  var tail = 60;
  var g = ctx.createLinearGradient(b.x - b.dir * tail, 0, b.x, 0);
  g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(1, 'rgba(200,250,255,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(b.x - b.dir * tail, b.y - 2); ctx.lineTo(b.x, b.y - 7); ctx.lineTo(b.x + b.dir * 10, b.y); ctx.lineTo(b.x, b.y + 7); ctx.lineTo(b.x - b.dir * tail, b.y + 2); ctx.fill();
  glow(ctx, b.x, b.y, 34, '#bff6ff', 0.7);
  ctx.restore();
}
function drawDebrisWarning(ctx, w, t, floorY) {
  var k = 1 - w.t / CFG.boss.hazardWarn;
  ctx.save();
  ctx.fillStyle = 'rgba(255,90,120,' + (0.15 + 0.35 * k) + ')';
  ctx.beginPath(); ctx.ellipse(w.x, floorY - 2, 14 + k * 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,170,200,0.6)';
  for (var i = 0; i < 4; i++) {
    var py = w.top + ((t * 300 + i * 70) % (floorY - w.top));
    ctx.fillRect(w.x - 6 + artHash(i, Math.floor(w.x)) * 12, py, 2, 4);
  }
  ctx.restore();
}
function drawDiveMarker(ctx, x, floorY, locked, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  var c = locked ? '#ff5c7a' : '#b48cff';
  var pulse = locked ? (0.6 + 0.4 * Math.sin(t * 30)) : 0.5;
  ctx.fillStyle = rgba(c, 0.35 * pulse);
  ctx.beginPath(); ctx.ellipse(x, floorY - 3, 58, 8, 0, 0, Math.PI * 2); ctx.fill();
  var g = ctx.createLinearGradient(0, floorY - 300, 0, floorY);
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.25 * pulse));
  ctx.fillStyle = g; ctx.fillRect(x - 40, floorY - 300, 80, 300);
  ctx.restore();
}

// ------------------------------------------------------------------ boss
function drawBoss(ctx, b, t) {
  if (b.gone) return;
  var gfx = b.gfx || (b.gfx = { crouch: 0, headY: 0, headX: 0, rear: 0, mouth: 0, rib: 0.5, legs: 0, fall: 0, tuck: 0 });
  // pose targets
  var tg = { crouch: 0, headY: 0, headX: 0, rear: 0, mouth: 0.1, rib: 0.55, legs: 0, fall: 0, tuck: 0 };
  var s = b.state;
  var wind = 0;
  if (s === 'dormant') { tg.crouch = 1; tg.headY = 30; tg.headX = -10; tg.rib = 0.15; tg.mouth = 0; }
  else if (s === 'intro') { var it = b.t; if (it < 0.8) { tg.crouch = 1; tg.headY = 30; tg.rib = 0.2; } else { tg.rear = 0.6; tg.headY = -30; tg.mouth = 1; tg.rib = 1; } }
  else if (s === 'chargeWind') { tg.crouch = 0.6; tg.headY = 30; tg.headX = 18; tg.mouth = 0.4; wind = 1; }
  else if (s === 'charge') { tg.crouch = 0.4; tg.headY = 26; tg.headX = 30; tg.mouth = 0.8; tg.legs = 1; }
  else if (s === 'leapWind') { tg.crouch = 1; tg.headY = 10; tg.mouth = 0.3; wind = 1; }
  else if (s === 'leap') { tg.tuck = 1; tg.headY = -6; tg.mouth = 0.6; }
  else if (s === 'volleyWind') { tg.rear = 1; tg.headY = -36; tg.mouth = 0.9; tg.rib = 1.4; wind = 1; }
  else if (s === 'volleyRecover') { tg.rear = 0.5; tg.headY = -20; tg.mouth = 0.6; tg.rib = 0.9; }
  else if (s === 'diveWind') { tg.crouch = 1; tg.headY = -10; tg.rib = 1.2; wind = 1; }
  else if (s === 'diveUp' || s === 'diveFall') { tg.tuck = 1; tg.headY = 20; tg.mouth = 0.8; }
  else if (s === 'summonWind') { tg.rear = 0.7; tg.headY = -44; tg.mouth = 1; tg.rib = 1.6; wind = 1; }
  else if (s === 'stagger') { tg.fall = 1; tg.headY = 46; tg.mouth = 0.5; tg.rib = 0.3; }
  else if (s === 'roar') { tg.rear = 0.9; tg.headY = -44; tg.mouth = 1.2; tg.rib = 1.6; }
  else if (s === 'dying') { tg.fall = 1; tg.headY = 30; tg.mouth = 1; tg.rib = 2; }
  else if (s.indexOf('Recover') >= 0) { tg.crouch = 0.3; tg.headY = 14; tg.mouth = 0.3; }
  var lr = 0.18;
  for (var key in tg) gfx[key] += (tg[key] - gfx[key]) * lr;

  var f = b.facing;
  var x = b.x + b.w / 2, y = b.y + b.h;
  var flash = b.flash > 0;
  var C = function (c) { return flash ? '#ffffff' : c; };
  var breathe = Math.sin(t * 2) * 2;
  var shake = wind ? (Math.random() - 0.5) * 3 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  ctx.scale(f, 1);
  ctx.rotate(-gfx.rear * 0.25 + gfx.fall * 0.35);
  ctx.translate(0, gfx.fall * 10);
  var cr = gfx.crouch * 22 + gfx.tuck * 10;
  var bodyY = -64 + cr - breathe * (1 - gfx.tuck);
  var walk = b.walkPhase;
  var legRun = gfx.legs;
  // tail with lure lantern
  ctx.strokeStyle = C('#0a0f1c'); ctx.lineWidth = 9; ctx.lineCap = 'round';
  var tw = Math.sin(t * 1.7) * 10;
  ctx.beginPath(); ctx.moveTo(-40, bodyY + 4);
  ctx.bezierCurveTo(-75, bodyY - 10 + tw, -95, bodyY - 60, -78 + tw * 0.5, bodyY - 82);
  ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = C('#1b2436');
  ctx.beginPath(); ctx.moveTo(-78 + tw * 0.5, bodyY - 82); ctx.lineTo(-74 + tw * 0.5, bodyY - 66); ctx.stroke();
  ctx.fillStyle = flash ? '#fff' : 'rgba(255,214,140,' + (0.6 + 0.4 * Math.sin(t * 5)) + ')';
  ctx.beginPath(); ctx.ellipse(-74 + tw * 0.5, bodyY - 60, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  // back legs
  function leg(hx, hy, phase, len, back) {
    var sw = Math.sin(walk + phase) * (10 + legRun * 18);
    var knX = hx + (back ? -14 : 10) + sw * 0.4, knY = hy + len * 0.5 - gfx.tuck * 14;
    var ftX = hx + sw - (gfx.tuck * (back ? -10 : 10)), ftY = gfx.tuck > 0.3 ? hy + len * 0.6 : Math.min(-1, 0 - Math.max(0, Math.cos(walk + phase)) * legRun * 8);
    if (gfx.fall > 0.5) { knX = hx + (back ? -30 : 30); knY = hy + 10; ftX = hx + (back ? -46 : 46); ftY = -4; }
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(knX, knY, ftX, ftY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ftX - 6, ftY); ctx.lineTo(ftX + 7, ftY + 1); ctx.stroke();
  }
  ctx.strokeStyle = C('#080c17'); ctx.lineWidth = 9;
  leg(-28, bodyY + 10, Math.PI, -bodyY - 10, true);
  leg(26, bodyY + 10, 0, -bodyY - 10, false);
  // body mass (ragged mantle)
  var bg = ctx.createLinearGradient(0, bodyY - 50, 0, bodyY + 30);
  bg.addColorStop(0, C('#1a2540')); bg.addColorStop(1, C('#070b16'));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-52, bodyY + 8);
  ctx.quadraticCurveTo(-58, bodyY - 30, -20, bodyY - 44);
  ctx.quadraticCurveTo(20, bodyY - 56, 46, bodyY - 30);
  ctx.quadraticCurveTo(58, bodyY - 10, 50, bodyY + 14);
  // ragged hem
  for (var i = 0; i <= 8; i++) {
    var hx = 50 - i * 12.75, hy = bodyY + 18 + (i % 2 ? 12 : 2) + Math.sin(t * 3 + i) * 2;
    ctx.lineTo(hx, hy);
  }
  ctx.closePath(); ctx.fill();
  // ribcage with swallowed lanterns
  var rib = gfx.rib;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(4, bodyY - 6, 30, 22, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = flash ? '#fff' : '#120a12'; ctx.fillRect(-30, bodyY - 30, 70, 50);
  if (!flash) {
    ctx.globalCompositeOperation = 'lighter';
    var lanterns = [[-12, bodyY - 4], [6, bodyY - 12], [20, bodyY + 2]];
    lanterns.forEach(function (L, k) {
      var pul = rib * (0.7 + 0.3 * Math.sin(t * 4 + k * 2));
      glow(ctx, L[0], L[1], 22, '#ffd27a', 0.6 * pul);
      ctx.fillStyle = 'rgba(255,230,170,' + Math.min(1, pul) + ')';
      ctx.beginPath(); ctx.ellipse(L[0], L[1], 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
  ctx.restore();
  ctx.strokeStyle = C('#cfc6b4'); ctx.lineWidth = 3.5;
  for (var r = -2; r <= 2; r++) {
    ctx.beginPath(); ctx.moveTo(4 + r * 12, bodyY - 26); ctx.quadraticCurveTo(4 + r * 13 + 6, bodyY - 4, 4 + r * 11, bodyY + 14); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-26, bodyY - 24); ctx.quadraticCurveTo(4, bodyY - 32, 34, bodyY - 22); ctx.stroke();
  // front legs (long, mantis-like forelimbs)
  ctx.strokeStyle = C('#0a0f1c'); ctx.lineWidth = 10;
  leg(36, bodyY + 4, Math.PI * 0.5, -bodyY - 4, false);
  leg(14, bodyY + 8, Math.PI * 1.5, -bodyY - 8, false);
  // neck + head (bone mask with antlers)
  var hx = 52 + gfx.headX, hy = bodyY - 26 + gfx.headY;
  ctx.strokeStyle = C('#0b1120'); ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(34, bodyY - 24); ctx.quadraticCurveTo(52, bodyY - 40 + gfx.headY * 0.3, hx, hy); ctx.stroke();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(gfx.headY * 0.006 - gfx.rear * 0.25);
  // antlers
  ctx.strokeStyle = C('#bfb5a0'); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -14); ctx.quadraticCurveTo(-20, -40, -6, -58); ctx.moveTo(-14, -34); ctx.lineTo(-28, -42); ctx.moveTo(-10, -48); ctx.lineTo(4, -60);
  ctx.moveTo(4, -14); ctx.quadraticCurveTo(14, -36, 30, -46); ctx.moveTo(14, -32); ctx.lineTo(16, -48); ctx.moveTo(22, -40); ctx.lineTo(38, -38);
  ctx.stroke();
  // jaw
  var mo = gfx.mouth * 12;
  ctx.fillStyle = C('#a99f8c');
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(26, 6 + mo); ctx.lineTo(28, 10 + mo); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill();
  // teeth
  ctx.fillStyle = C('#e8e0cc');
  for (var tt = 0; tt < 4; tt++) { ctx.beginPath(); ctx.moveTo(4 + tt * 6, 6 + mo * (tt / 4)); ctx.lineTo(6 + tt * 6, 1 + mo * (tt / 4)); ctx.lineTo(8 + tt * 6, 6 + mo * (tt / 4)); ctx.fill(); }
  if (mo > 3 && !flash) { ctx.fillStyle = 'rgba(255,200,120,0.6)'; ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(24, 5 + mo * 0.6); ctx.lineTo(-2, 9); ctx.fill(); }
  // skull mask
  var mg = ctx.createLinearGradient(-10, -16, 20, 8);
  mg.addColorStop(0, C('#ece4d2')); mg.addColorStop(1, C('#9d927d'));
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(-12, -6); ctx.quadraticCurveTo(-10, -20, 6, -18); ctx.quadraticCurveTo(26, -14, 32, 0); ctx.lineTo(28, 6); ctx.quadraticCurveTo(10, 6, -8, 6); ctx.closePath(); ctx.fill();
  // cracks on mask in later phases
  if (b.phase >= 2) { ctx.strokeStyle = C('#4a3f30'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(8, -8); ctx.lineTo(4, -2); if (b.phase >= 3) { ctx.moveTo(20, -12); ctx.lineTo(16, -4); ctx.lineTo(22, 2); } ctx.stroke(); }
  // eyes
  var eyeC = (wind || s === 'roar' || s === 'charge') ? '#ff6b9a' : '#c49bff';
  if (s === 'stagger' || s === 'dormant') eyeC = '#55406e';
  ctx.fillStyle = flash ? '#fff' : '#0b0612';
  ctx.beginPath(); ctx.ellipse(10, -8, 5, 4, 0.2, 0, Math.PI * 2); ctx.ellipse(22, -6, 4, 3.4, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : eyeC;
  ctx.beginPath(); ctx.arc(11, -8, 2.4, 0, Math.PI * 2); ctx.arc(22.5, -6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
  // eye glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  var ex = x + f * (hx + 14), ey = y + hy - 8 + gfx.fall * 10;
  if (s !== 'dormant') glow(ctx, ex, ey, wind ? 60 : 30, wind ? '#ff6b9a' : '#b48cff', wind ? 0.6 : 0.35);
  if (wind) glow(ctx, x, y - 70, 120, '#ff6b9a', 0.12);
  ctx.restore();
}

// ------------------------------------------------------------------ particles
function drawParticles(ctx, list) {
  ctx.save();
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var k = p.life / p.max;
    if (p.add) ctx.globalCompositeOperation = 'lighter'; else ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = p.fade === false ? 1 : clamp01(k * 1.5);
    ctx.fillStyle = p.color;
    var s = p.size * (p.shrink ? k : 1);
    if (p.shape === 'ring') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - k) * p.grow, 0, Math.PI * 2); ctx.stroke();
    } else if (p.shape === 'streak') {
      ctx.strokeStyle = p.color; ctx.lineWidth = s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, s), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawAmbient(ctx, list, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var tw = a.kind === 'fly' ? (0.5 + 0.5 * Math.sin(t * a.sp + a.ph)) : 0.6;
    var al = tw * a.alpha;
    if (a.kind === 'fly') {
      glow(ctx, a.x, a.y, 10, a.color, 0.35 * al);
      ctx.fillStyle = rgba(a.color, al); ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
    } else {
      ctx.fillStyle = rgba(a.color, al * 0.6);
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
function drawRain(ctx, cam, t, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(150,190,230,' + (0.25 * amount) + ')'; ctx.lineWidth = 1;
  ctx.beginPath();
  var n = Math.floor(140 * amount);
  for (var i = 0; i < n; i++) {
    var x = (artHash(i, 11) * 1100 + t * 120) % 1100 - 70;
    var y = (artHash(i, 13) * 600 + t * (700 + artHash(i, 5) * 300)) % 600 - 30;
    ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16);
  }
  ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ lighting
// lights: [{x,y,r,i}] in world coords. Darkness overlay with soft holes, then a colored additive tint.
function drawLighting(ctx, lights, cam, darkness, tintLights) {
  var lc = ART.lctx, s = 0.5;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, 480, 270);
  lc.fillStyle = 'rgba(2,5,14,' + darkness + ')';
  lc.fillRect(0, 0, 480, 270);
  lc.globalCompositeOperation = 'destination-out';
  for (var i = 0; i < lights.length; i++) {
    var L = lights[i];
    var x = (L.x - cam.x) * s, y = (L.y - cam.y) * s, r = L.r * s;
    if (x < -r || y < -r || x > 480 + r || y > 270 + r) continue;
    var g = lc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,' + L.i + ')');
    g.addColorStop(0.5, 'rgba(0,0,0,' + (L.i * 0.55) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.drawImage(ART.light, 0, 0, CFG.W, CFG.H);
  // colored glows
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (var j = 0; j < tintLights.length; j++) {
    var T = tintLights[j];
    var tx = T.x - cam.x, ty = T.y - cam.y;
    if (tx < -T.r || ty < -T.r || tx > CFG.W + T.r || ty > CFG.H + T.r) continue;
    glow(ctx, tx, ty, T.r, T.c, T.a);
  }
  ctx.restore();
}

function drawVignette(ctx, hurtPulse, t, extraRed) {
  var g = ctx.createRadialGradient(CFG.W / 2, CFG.H / 2, CFG.H * 0.35, CFG.W / 2, CFG.H / 2, CFG.H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,6,0.65)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CFG.W, CFG.H);
  var red = Math.max(hurtPulse, extraRed || 0);
  if (red > 0.01) {
    var rg = ctx.createRadialGradient(CFG.W / 2, CFG.H / 2, CFG.H * 0.4, CFG.W / 2, CFG.H / 2, CFG.H * 0.95);
    rg.addColorStop(0, 'rgba(160,0,30,0)'); rg.addColorStop(1, 'rgba(200,10,40,' + (0.45 * red) + ')');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, CFG.W, CFG.H);
  }
}

// ------------------------------------------------------------------ HUD
function drawHUD(ctx, p, t, hud) {
  // energy vessel
  var vx = 52, vy = 52, vr = 30;
  ctx.save();
  ctx.fillStyle = 'rgba(3,8,16,0.7)'; ctx.beginPath(); ctx.arc(vx, vy, vr + 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(vx, vy, vr, 0, Math.PI * 2); ctx.clip();
  var k = p.energy / CFG.player.energyMax;
  var ly = vy + vr - k * vr * 2;
  var lg = ctx.createLinearGradient(0, vy - vr, 0, vy + vr);
  lg.addColorStop(0, '#fff2c8'); lg.addColorStop(1, '#d99a3c');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(vx - vr, vy + vr);
  for (var x = -vr; x <= vr; x += 4) ctx.lineTo(vx + x, ly + Math.sin(t * 3 + x * 0.2) * 2.5);
  ctx.lineTo(vx + vr, vy + vr); ctx.closePath(); ctx.fill();
  ctx.restore();
  var canUse = p.energy >= CFG.player.healCost;
  ctx.strokeStyle = canUse ? 'rgba(255,226,160,' + (0.75 + 0.25 * Math.sin(t * 4)) + ')' : 'rgba(160,190,210,0.6)';
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(vx, vy, vr + 2, 0, Math.PI * 2); ctx.stroke();
  // notches for 33 units
  ctx.strokeStyle = 'rgba(3,8,16,0.8)'; ctx.lineWidth = 1.5;
  for (var n = 1; n < 3; n++) { var ny = vy + vr - (n / 3) * vr * 2; ctx.beginPath(); ctx.moveTo(vx - vr, ny); ctx.lineTo(vx - vr + 8, ny); ctx.moveTo(vx + vr, ny); ctx.lineTo(vx + vr - 8, ny); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(vx - 10, vy - 14, 7, 10, -0.5, 0, Math.PI * 2); ctx.fill();
  if (canUse) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, vx, vy, 48, '#ffd27a', 0.18); ctx.restore(); }
  // health icons (glowing wick-flames in glass)
  for (var i = 0; i < p.maxHp; i++) {
    var hx = 104 + i * 30, hy = 46;
    var full = i < p.hp;
    var lost = hud.lostT > 0 && i === p.hp;
    var sc = full ? 1 + (hud.gainT > 0 && i === p.hp - 1 ? hud.gainT * 0.8 : 0) : 1;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(3,8,16,0.75)';
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(13, -2, 0, 14); ctx.quadraticCurveTo(-13, -2, 0, -16); ctx.fill();
    if (full) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, 22, '#9fefff', 0.35);
      ctx.globalCompositeOperation = 'source-over';
      var fg = ctx.createLinearGradient(0, -12, 0, 10);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#79d9ee');
      ctx.fillStyle = fg;
      var fl = Math.sin(t * 8 + i) * 1.2;
      ctx.beginPath(); ctx.moveTo(fl, -12); ctx.quadraticCurveTo(9, -1, 0, 10); ctx.quadraticCurveTo(-9, -1, fl, -12); ctx.fill();
    } else {
      ctx.strokeStyle = lost ? 'rgba(255,120,140,' + hud.lostT + ')' : 'rgba(120,160,180,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(9, -1, 0, 10); ctx.quadraticCurveTo(-9, -1, 0, -12); ctx.stroke();
    }
    ctx.restore();
  }
  if (hud.godMode) { ctx.font = '11px ' + FONT_UI; ctx.fillStyle = 'rgba(255,200,120,0.7)'; ctx.textAlign = 'left'; ctx.fillText('invulnerable', 104, 76); }
  if (Snd.isMuted()) { ctx.font = '12px ' + FONT_UI; ctx.fillStyle = 'rgba(200,220,240,0.6)'; ctx.textAlign = 'right'; ctx.fillText('muted (M)', CFG.W - 16, 24); }
}

function drawBossBar(ctx, b, t, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  var w = 560, x = (CFG.W - w) / 2, y = CFG.H - 30;
  ctx.font = '20px ' + FONT_DISPLAY; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(235,225,255,0.95)';
  ctx.fillText(CFG.boss.name, x, y - 12);
  ctx.font = 'italic 14px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(190,170,230,0.85)'; ctx.textAlign = 'right';
  ctx.fillText(CFG.boss.title, x + w, y - 12);
  ctx.fillStyle = 'rgba(3,6,14,0.85)'; ctx.fillRect(x - 3, y - 4, w + 6, 14);
  ctx.strokeStyle = 'rgba(200,180,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 4.5, w + 7, 15);
  var k = Math.max(0, b.hp / b.maxHp), kd = Math.max(0, b.hpShown / b.maxHp);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, y - 1, w * kd, 8);
  var g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#6b3fb8'); g.addColorStop(1, '#d0a8ff');
  ctx.fillStyle = g; ctx.fillRect(x, y - 1, w * k, 8);
  ctx.fillStyle = 'rgba(3,6,14,0.9)';
  ctx.fillRect(x + w * CFG.boss.phase2At - 1, y - 3, 2, 12); ctx.fillRect(x + w * CFG.boss.phase3At - 1, y - 3, 2, 12);
  ctx.restore();
}

function drawBigText(ctx, title, sub, alpha, y) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp01(alpha); ctx.textAlign = 'center';
  y = y || CFG.H * 0.36;
  ctx.font = '15px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(190,220,235,0.85)';
  if (sub) ctx.fillText(sub, CFG.W / 2, y - 46);
  ctx.font = '54px ' + FONT_DISPLAY;
  ctx.shadowColor = 'rgba(160,230,255,0.8)'; ctx.shadowBlur = 24;
  ctx.fillStyle = 'rgba(235,250,255,0.97)';
  ctx.fillText(title, CFG.W / 2, y);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(190,230,245,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CFG.W / 2 - 180, y + 18); ctx.lineTo(CFG.W / 2 + 180, y + 18); ctx.stroke();
  ctx.restore();
}
function drawBossTitleCard(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp01(alpha); ctx.textAlign = 'center';
  var y = CFG.H * 0.3;
  ctx.font = 'italic 18px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(200,180,240,0.9)';
  ctx.fillText(CFG.boss.title, CFG.W / 2, y - 52);
  ctx.font = '66px ' + FONT_DISPLAY;
  ctx.shadowColor = 'rgba(190,120,255,0.9)'; ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(245,235,255,0.98)';
  ctx.fillText(CFG.boss.name, CFG.W / 2, y + 6);
  ctx.restore();
}
function drawToast(ctx, text, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp01(alpha); ctx.textAlign = 'center';
  ctx.font = '20px ' + FONT_DISPLAY;
  var w = ctx.measureText(text).width + 50;
  ctx.fillStyle = 'rgba(3,8,16,0.7)'; ctx.fillRect(CFG.W / 2 - w / 2, 96, w, 40);
  ctx.fillStyle = 'rgba(255,236,200,0.95)'; ctx.fillText(text, CFG.W / 2, 122);
  ctx.restore();
}

// Built from the live key bindings (controls.js) so remapped keys show up here.
function controlRows() {
  var K = Controls.label;
  return [
    ['Move / aim', Controls.moveLabel()],
    ['Jump', K('jump') + '  (hold = higher)'],
    ['Slash', K('attack') + '  (+' + K('up', 1) + ' / +' + K('down', 1) + ' in air; ' + K('down', 1) + ' = pogo)'],
    ['Dash', K('dash')],
    ['Light bolt', K('bolt')],
    ['Mend (heal)', 'hold ' + K('heal') + '  (standing still)'],
    ['Rest at shrine', K('up', 1)],
    ['Pause / Restart / Mute', 'Esc or P  /  R  /  M'],
    ['Testing aids', 'F1 invincibility  /  F2 skip to the boss'],
    ['Change keys', 'O']
  ];
}
function drawControls(ctx, y, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = '15px ' + FONT_UI;
  var CONTROLS_TEXT = controlRows();
  for (var i = 0; i < CONTROLS_TEXT.length; i++) {
    var yy = y + i * 23;
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(160,200,215,0.85)'; ctx.fillText(CONTROLS_TEXT[i][0], CFG.W / 2 - 14, yy);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(230,245,250,0.95)'; ctx.fillText(CONTROLS_TEXT[i][1], CFG.W / 2 + 14, yy);
  }
  ctx.restore();
}

function drawTitleScreen(ctx, t) {
  ctx.fillStyle = 'rgba(2,5,12,0.45)'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.save(); ctx.textAlign = 'center';
  var a = 0.35 + 0.65 * clamp01(t / 1.5);
  ctx.globalAlpha = a;
  ctx.font = '84px ' + FONT_DISPLAY;
  ctx.shadowColor = 'rgba(140,230,255,0.9)'; ctx.shadowBlur = 36;
  ctx.fillStyle = '#eafcff';
  ctx.fillText('GLOAMREACH', CFG.W / 2, 140);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 18px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(190,220,235,0.85)';
  ctx.fillText('a short night beneath the drowned wood', CFG.W / 2, 176);
  ctx.restore();
  drawControls(ctx, 232, 0.35 + 0.65 * clamp01((t - 0.5) / 1.2));
  ctx.save(); ctx.textAlign = 'center';
  ctx.globalAlpha = (0.4 + 0.6 * clamp01((t - 1) / 1)) * (0.6 + 0.4 * Math.sin(t * 3));
  ctx.font = '24px ' + FONT_DISPLAY; ctx.fillStyle = '#ffe6b0';
  ctx.fillText('Press Enter to begin', CFG.W / 2, 474);
  ctx.globalAlpha = 0.5;
  ctx.font = '12px ' + FONT_UI; ctx.fillStyle = '#9fb8c6';
  ctx.fillText('best with sound', CFG.W / 2, 500);
  ctx.restore();
}
function drawPauseScreen(ctx, t) {
  ctx.fillStyle = 'rgba(2,5,12,0.78)'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = '46px ' + FONT_DISPLAY; ctx.fillStyle = '#eafcff';
  ctx.fillText('Paused', CFG.W / 2, 140);
  ctx.restore();
  drawControls(ctx, 200, 1);
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = '18px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(255,230,176,' + (0.7 + 0.3 * Math.sin(t * 3)) + ')';
  ctx.fillText('Esc / P  resume        R  return to last shrine', CFG.W / 2, 440);
  ctx.restore();
}
function drawVictoryScreen(ctx, t, stats) {
  ctx.fillStyle = 'rgba(2,5,12,' + Math.min(0.85, t * 0.4) + ')'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.save(); ctx.textAlign = 'center';
  ctx.globalAlpha = clamp01(t / 1.5);
  ctx.font = 'italic 18px ' + FONT_DISPLAY; ctx.fillStyle = 'rgba(255,220,160,0.9)';
  ctx.fillText('the lanterns it swallowed drift free into the night', CFG.W / 2, 150);
  ctx.font = '62px ' + FONT_DISPLAY;
  ctx.shadowColor = 'rgba(255,210,122,0.8)'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#fff4dc';
  ctx.fillText('Ossiveth Falls', CFG.W / 2, 220);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = clamp01((t - 1) / 1.5);
  ctx.font = '22px ' + FONT_DISPLAY; ctx.fillStyle = '#d8f4ff';
  ctx.fillText('Time   ' + stats.time, CFG.W / 2, 300);
  ctx.fillText('Deaths   ' + stats.deaths, CFG.W / 2, 334);
  if (stats.heart) { ctx.font = '16px ' + FONT_DISPLAY; ctx.fillStyle = '#ffcf9a'; ctx.fillText('Hidden ember found', CFG.W / 2, 366); }
  ctx.globalAlpha = clamp01((t - 2.5) / 1) * (0.6 + 0.4 * Math.sin(t * 3));
  ctx.font = '20px ' + FONT_DISPLAY; ctx.fillStyle = '#ffe6b0';
  ctx.fillText('Thank you for playing  -  press Enter', CFG.W / 2, 440);
  ctx.restore();
}
function drawFade(ctx, a) {
  if (a <= 0) return;
  ctx.fillStyle = 'rgba(0,0,0,' + clamp01(a) + ')'; ctx.fillRect(0, 0, CFG.W, CFG.H);
}
