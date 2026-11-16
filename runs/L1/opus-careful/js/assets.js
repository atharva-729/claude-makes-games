// All drawing lives here. The game only calls the functions on window.Assets,
// passing world-space pixel positions; it never touches colors or shapes itself.
// To switch to sprite images later, load the images in Assets.init() and
// replace the bodies of these functions; nothing else needs to change.
(function () {
  'use strict';

  var C = window.CONFIG;
  var COL = C.colors;
  var T = C.tileSize;

  var skyGradient = null;
  var skyCtx = null;

  // Cheap deterministic hash -> [0, 1), used for per-tile texture details.
  function hash(x, y) {
    var n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  var Assets = {
    // Hook for loading images later. Call before the first frame.
    init: function () {},

    // ---------------------------------------------------------------- backdrop
    drawBackground: function (ctx, camX, camY, w, h, time) {
      if (!skyGradient || skyCtx !== ctx) {
        skyGradient = ctx.createLinearGradient(0, 0, 0, h);
        skyGradient.addColorStop(0, COL.skyTop);
        skyGradient.addColorStop(1, COL.skyBottom);
        skyCtx = ctx;
      }
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, w, h);

      var x, wx, hgt, i;

      // Clouds (very slow parallax + drift).
      for (i = 0; i < 9; i++) {
        var span = w + 260;
        var cx = ((i * 337 + 60 - camX * 0.08 - time * (6 + i % 3 * 3)) % span + span) % span - 130;
        var cy = 40 + (i * 53) % 150 - camY * 0.05;
        var s = 1 + (i % 3) * 0.4;
        rect(ctx, COL.cloud, Math.round(cx), Math.round(cy), Math.round(60 * s), Math.round(12 * s));
        rect(ctx, COL.cloud, Math.round(cx + 12 * s), Math.round(cy - 8 * s), Math.round(32 * s), Math.round(10 * s));
      }

      // Far mountains: chunky columns, parallax 0.2.
      var baseM = h - 120 - camY * 0.2;
      for (x = 0; x < w; x += 8) {
        wx = (x + camX * 0.2) / 8;
        hgt = 110 + Math.sin(wx * 0.11) * 50 + Math.sin(wx * 0.037 + 1.3) * 60 + Math.sin(wx * 0.29) * 10;
        hgt = Math.round(hgt / 4) * 4;
        rect(ctx, COL.mountains, x, Math.round(baseM - hgt), 8, Math.round(hgt + 200));
        if ((Math.floor(wx) % 5) === 0) rect(ctx, COL.mountainsShade, x, Math.round(baseM - hgt + 8), 8, Math.round(hgt + 200));
      }

      // Near hills: parallax 0.45.
      var baseH = h - 60 - camY * 0.45;
      for (x = 0; x < w; x += 4) {
        wx = (x + camX * 0.45) / 4;
        hgt = 70 + Math.sin(wx * 0.045) * 35 + Math.sin(wx * 0.013 + 2) * 30;
        hgt = Math.round(hgt / 4) * 4;
        rect(ctx, COL.hills, x, Math.round(baseH - hgt), 4, Math.round(hgt + 200));
        rect(ctx, COL.hillsShade, x, Math.round(baseH - hgt + 18), 4, Math.round(hgt + 200));
      }
    },

    // ------------------------------------------------------------------ tiles
    // info: { tx, ty, top, left, right } (top/left/right = neighbour on that side is NOT solid ground)
    drawTile: function (ctx, type, x, y, info) {
      if (type === '#') {
        rect(ctx, COL.dirt, x, y, T, T);
        // texture specks
        for (var k = 0; k < 3; k++) {
          var r = hash(info.tx * 3 + k, info.ty * 7 + k);
          var px = x + Math.floor(r * 7) * 4 + 2;
          var py = y + Math.floor(hash(info.tx + k * 11, info.ty) * 6) * 4 + 6;
          rect(ctx, k === 0 ? COL.dirtLight : COL.dirtDark, px, py, 4, 4);
        }
        if (info.left) rect(ctx, COL.dirtDark, x, y, 2, T);
        if (info.right) rect(ctx, COL.dirtDark, x + T - 2, y, 2, T);
        if (info.top) {
          rect(ctx, COL.grass, x, y, T, 8);
          rect(ctx, COL.grassLight, x, y, T, 2);
          rect(ctx, COL.grassDark, x, y + 8, T, 2);
          // drips of grass over the dirt
          var d = hash(info.tx, 99);
          rect(ctx, COL.grass, x + 4 + Math.floor(d * 5) * 4, y + 8, 4, 4);
          rect(ctx, COL.grassDark, x + 4 + Math.floor(d * 5) * 4, y + 12, 4, 2);
          if (info.left) rect(ctx, COL.grassDark, x, y, 2, 10);
          if (info.right) rect(ctx, COL.grassDark, x + T - 2, y, 2, 10);
        }
      } else if (type === '=') {
        // Thin plank: visually says "only the top is solid".
        rect(ctx, COL.plankDark, x, y, T, 12);
        rect(ctx, COL.plank, x, y, T, 9);
        rect(ctx, COL.plankLight, x, y, T, 3);
        rect(ctx, COL.plankDark, x + (info.tx % 2 ? 6 : 20), y + 3, 2, 6);
        // little support brackets
        rect(ctx, COL.plankDark, x + 4, y + 12, 4, 4);
        rect(ctx, COL.plankDark, x + T - 8, y + 12, 4, 4);
      } else if (type === '^') {
        // Two spikes per tile, pointing up from the tile bottom.
        for (var s = 0; s < 2; s++) {
          var bx = x + s * 16;
          ctx.fillStyle = COL.spikeShade;
          ctx.beginPath();
          ctx.moveTo(bx + 1, y + T);
          ctx.lineTo(bx + 8, y + 14);
          ctx.lineTo(bx + 15, y + T);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = COL.spike;
          ctx.beginPath();
          ctx.moveTo(bx + 1, y + T);
          ctx.lineTo(bx + 8, y + 14);
          ctx.lineTo(bx + 8, y + T);
          ctx.closePath();
          ctx.fill();
          rect(ctx, COL.spikeTip, bx + 7, y + 14, 2, 3);
        }
      }
    },

    // ------------------------------------------------------------------ coins
    // coin: { x, y } = centre in world px, phase = per-coin offset.
    drawCoin: function (ctx, coin, time) {
      var bob = Math.round(Math.sin(time * 3 + coin.phase) * 2);
      var spin = Math.abs(Math.cos(time * 3.5 + coin.phase));
      var hw = Math.max(1, Math.round(spin * 8));
      var cx = Math.round(coin.x), cy = Math.round(coin.y) + bob;
      rect(ctx, COL.coinDark, cx - hw, cy - 9, hw * 2, 18);
      rect(ctx, COL.coinDark, cx - hw - 1, cy - 6, hw * 2 + 2, 12);
      rect(ctx, COL.coin, cx - hw + 1, cy - 8, Math.max(1, hw * 2 - 2), 16);
      if (hw > 3) rect(ctx, COL.coinShine, cx - hw + 2, cy - 6, 2, 8);
    },

    drawCoinIcon: function (ctx, x, y) {
      rect(ctx, COL.coinDark, x - 7, y - 9, 14, 18);
      rect(ctx, COL.coinDark, x - 8, y - 6, 16, 12);
      rect(ctx, COL.coin, x - 6, y - 8, 12, 16);
      rect(ctx, COL.coinShine, x - 4, y - 6, 2, 8);
    },

    // ----------------------------------------------------------------- player
    // x, y = top-left of the collision box (already interpolated, integer).
    // Uses player.w/h, facing, scaleX/scaleY (squash), onGround, vx, animTime.
    drawPlayer: function (ctx, p, x, y) {
      var w = Math.round(p.w * p.scaleX);
      var h = Math.round(p.h * p.scaleY);
      var left = Math.round(x + p.w / 2 - w / 2);
      var top = Math.round(y + p.h - h);

      // feet (two-frame walk cycle)
      var step = 0;
      if (p.onGround && Math.abs(p.vx) > 20) step = Math.floor(p.animTime * 12) % 2;
      var footY = y + p.h - 4;
      if (!p.onGround) {
        rect(ctx, COL.feet, left + 2, footY - 2, 7, 5);
        rect(ctx, COL.feet, left + w - 9, footY - 2, 7, 5);
      } else {
        rect(ctx, COL.feet, left + 1 + (step ? 2 : 0), footY, 7, 4);
        rect(ctx, COL.feet, left + w - 8 - (step ? 0 : 2), footY, 7, 4);
      }

      // body
      var bodyH = h - 3;
      rect(ctx, COL.playerDark, left, top, w, bodyH);
      rect(ctx, COL.player, left + 1, top + 1, w - 2, bodyH - 4);
      rect(ctx, COL.playerLight, left + 2, top + 2, w - 6, 3);

      // eyes look where we're going
      var f = p.facing;
      var eyeY = top + Math.round(bodyH * 0.28);
      var ex = left + Math.round(w / 2) + f * 3;
      rect(ctx, COL.eye, ex - 6, eyeY, 5, 7);
      rect(ctx, COL.eye, ex + 1, eyeY, 5, 7);
      var look = f > 0 ? 2 : 0;
      var lookY = p.vy < -50 ? 0 : p.vy > 200 ? 3 : 2;
      rect(ctx, COL.pupil, ex - 6 + look + 1, eyeY + lookY, 2, 3);
      rect(ctx, COL.pupil, ex + 1 + look + 1, eyeY + lookY, 2, 3);
    },

    // ------------------------------------------------------------------- goal
    // flag: { x, y } = top-left of the flag tile; pole stands on the tile bottom.
    drawFlag: function (ctx, flag, time, reached) {
      var px = flag.x + T / 2 - 2;
      var bottom = flag.y + T;
      var poleTop = bottom - T * 3;
      rect(ctx, COL.flagBase, px - 6, bottom - 6, 16, 6);
      rect(ctx, COL.flagPole, px, poleTop, 4, T * 3 - 6);
      rect(ctx, COL.flagCloth, px - 2, poleTop - 6, 8, 8);
      var clothTop = reached ? poleTop + 4 : poleTop + 6;
      for (var i = 0; i < 28; i += 2) {
        var wave = Math.round(Math.sin(time * 6 - i * 0.25) * 2 * (i / 28));
        var colH = Math.round(20 * (1 - i / 34));
        rect(ctx, (i / 2) % 4 < 2 ? COL.flagCloth : COL.flagClothDark, px + 4 + i, clothTop + wave + (20 - colH) / 2, 2, colH);
      }
    },

    // cp: { x, y, active } = top-left of the checkpoint tile.
    drawCheckpoint: function (ctx, cp, time) {
      var px = cp.x + T / 2 - 1;
      var bottom = cp.y + T;
      var top = bottom - 44;
      rect(ctx, COL.flagBase, px - 5, bottom - 4, 12, 4);
      rect(ctx, COL.flagPole, px, top, 3, 40);
      var col = cp.active ? COL.checkpointOn : COL.checkpointOff;
      var wave = cp.active ? Math.round(Math.sin(time * 7) * 1.5) : 0;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(px + 3, top);
      ctx.lineTo(px + 19, top + 6 + wave);
      ctx.lineTo(px + 3, top + 12);
      ctx.closePath();
      ctx.fill();
    },

    // sign: { x, y, text } = top-left of the tile the sign stands in.
    drawSign: function (ctx, sign) {
      ctx.font = 'bold 12px monospace';
      var tw = Math.ceil(ctx.measureText(sign.text).width);
      var bw = tw + 14, bh = 20;
      var cx = sign.x + T / 2;
      var bx = Math.round(cx - bw / 2), by = sign.y + T - 40;
      rect(ctx, COL.signWoodDark, cx - 2, by + bh, 4, sign.y + T - (by + bh));
      rect(ctx, COL.signWoodDark, bx, by, bw, bh);
      rect(ctx, COL.signWood, bx + 2, by + 2, bw - 4, bh - 4);
      ctx.fillStyle = COL.signText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.text, cx, by + bh / 2 + 1);
    },

    // part: { x, y, size, color, life, maxLife }
    drawParticle: function (ctx, part) {
      var s = Math.max(1, Math.round(part.size * Math.min(1, part.life / part.maxLife * 1.5)));
      rect(ctx, part.color, Math.round(part.x - s / 2), Math.round(part.y - s / 2), s, s);
    }
  };

  window.Assets = Assets;
})();
