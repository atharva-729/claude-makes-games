// All drawing for every entity type lives here. game.js never draws an entity
// itself; it only calls these functions. To swap in sprite images later,
// replace the bodies of these functions (e.g. with ctx.drawImage) and nothing
// else needs to change.
//
// Interface (all coordinates are world pixels unless noted):
//   Assets.drawBackground(ctx, camX, camY, viewW, viewH, time)   screen space
//   Assets.drawTile(ctx, type, x, y, info)    type: '#', '=', '^'
//                                             info: { tx, ty, above }
//   Assets.drawCoin(ctx, coin, time)          coin: { x, y } (centre)
//   Assets.drawCheckpoint(ctx, cp, time)      cp: { x, y, active } (tile top-left)
//   Assets.drawFlag(ctx, flag, time)          flag: { x, y } (tile top-left)
//   Assets.drawPlayer(ctx, player)            player: { x, y, w, h, facing, vx, vy,
//                                               onGround, animTime, sx, sy }
//   Assets.drawParticle(ctx, particle)        particle: { x, y, size, color, life, maxLife }
var Assets = (function () {
  'use strict';
  var col = CONFIG.colors;
  var T = CONFIG.tile;

  function hash(a, b) {
    var h = (a * 73856093) ^ (b * 19349663);
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  var skyGradient = null;
  var clouds = [
    { x: 80, y: 70, s: 1.0 }, { x: 380, y: 120, s: 0.7 }, { x: 640, y: 50, s: 1.2 },
    { x: 900, y: 150, s: 0.8 }, { x: 1150, y: 90, s: 1.0 }
  ];

  function drawCloud(ctx, x, y, s) {
    x = Math.round(x); y = Math.round(y);
    var u = Math.round(12 * s);
    ctx.fillRect(x, y, u * 6, u);
    ctx.fillRect(x + u, y - u, u * 4, u);
    ctx.fillRect(x + u * 2, y - u * 2, u * 2, u);
  }

  function drawHills(ctx, offset, baseY, amp, wave, viewW, viewH, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (var sx = 0; sx <= viewW + 16; sx += 16) {
      var wx = sx + offset;
      var y = baseY - Math.sin(wx / wave) * amp - Math.sin(wx / (wave * 0.37) + 1.3) * amp * 0.35;
      ctx.lineTo(sx, Math.round(y));
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground(ctx, camX, camY, viewW, viewH, time) {
    if (!skyGradient) {
      skyGradient = ctx.createLinearGradient(0, 0, 0, viewH);
      skyGradient.addColorStop(0, col.skyTop);
      skyGradient.addColorStop(1, col.skyBottom);
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.fillStyle = col.sun;
    ctx.fillRect(viewW - 170, 60, 56, 56);
    ctx.fillRect(viewW - 178, 68, 72, 40);
    ctx.fillRect(viewW - 162, 52, 40, 72);

    ctx.fillStyle = col.cloud;
    ctx.globalAlpha = 0.85;
    var span = viewW + 300;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var x = ((c.x - camX * 0.08 - time * 6 * c.s) % span + span) % span - 150;
      drawCloud(ctx, x, c.y, c.s);
    }
    ctx.globalAlpha = 1;

    drawHills(ctx, camX * 0.18, viewH - 150, 46, 210, viewW, viewH, col.hillFar);
    drawHills(ctx, camX * 0.35 + 500, viewH - 90, 34, 140, viewW, viewH, col.hillNear);
  }

  function drawTile(ctx, type, x, y, info) {
    var h = hash(info.tx, info.ty);
    if (type === '#') {
      ctx.fillStyle = col.dirt;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = col.dirtDark;
      ctx.fillRect(x + 3 + (h % 5) * 5, y + 10 + ((h >>> 3) % 4) * 5, 4, 3);
      ctx.fillRect(x + 2 + ((h >>> 6) % 6) * 4, y + 12 + ((h >>> 9) % 3) * 6, 3, 3);
      ctx.fillStyle = col.dirtLight;
      ctx.fillRect(x + 4 + ((h >>> 12) % 6) * 4, y + 9 + ((h >>> 15) % 4) * 5, 3, 2);
      if (info.above !== '#') {
        ctx.fillStyle = col.grass;
        ctx.fillRect(x, y, T, 7);
        ctx.fillStyle = col.grassLight;
        ctx.fillRect(x, y, T, 3);
        ctx.fillStyle = col.grassDark;
        ctx.fillRect(x + 2 + (h % 3) * 4, y + 7, 4, 3);
        ctx.fillRect(x + 18 + ((h >>> 4) % 3) * 4, y + 7, 4, 2);
      }
    } else if (type === '=') {
      ctx.fillStyle = col.wood;
      ctx.fillRect(x, y, T, 9);
      ctx.fillStyle = col.woodLight;
      ctx.fillRect(x, y, T, 3);
      ctx.fillStyle = col.woodDark;
      ctx.fillRect(x, y + 8, T, 2);
      ctx.fillRect(x + 14, y + 10, 4, 5);
      ctx.fillRect(x + 31, y, 1, 9);
    } else if (type === '^') {
      ctx.fillStyle = col.spikeBase;
      ctx.fillRect(x, y + T - 4, T, 4);
      for (var i = 0; i < 2; i++) {
        var bx = x + i * 16;
        ctx.fillStyle = col.spike;
        ctx.beginPath();
        ctx.moveTo(bx + 1, y + T - 4);
        ctx.lineTo(bx + 8, y + T - 20);
        ctx.lineTo(bx + 15, y + T - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = col.spikeDark;
        ctx.beginPath();
        ctx.moveTo(bx + 8, y + T - 20);
        ctx.lineTo(bx + 15, y + T - 4);
        ctx.lineTo(bx + 9, y + T - 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawCoin(ctx, coin, time) {
    var phase = coin.x * 0.02;
    var bob = Math.round(Math.sin(time * 3 + phase) * 2);
    var w = Math.max(2, Math.round(Math.abs(Math.cos(time * 3.5 + phase)) * 14));
    var x = Math.round(coin.x - w / 2), y = Math.round(coin.y - 8) + bob;
    ctx.fillStyle = col.coinDark;
    ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = col.coin;
    ctx.fillRect(x, y + 1, Math.max(1, w - 1), 14);
    if (w > 6) {
      ctx.fillStyle = col.coinLight;
      ctx.fillRect(x + 2, y + 3, 2, 8);
    }
  }

  function drawCheckpoint(ctx, cp, time) {
    var x = cp.x, y = cp.y;
    ctx.fillStyle = col.flagPole;
    ctx.fillRect(x + 14, y - 12, 3, T + 12);
    ctx.fillStyle = cp.active ? col.checkpointOn : col.checkpointOff;
    var wave = cp.active ? Math.round(Math.sin(time * 6) * 1) : 0;
    ctx.fillRect(x + 17, y - 12 + wave, 6, 10);
    ctx.fillRect(x + 23, y - 10 - wave, 5, 6);
  }

  function drawFlag(ctx, flag, time) {
    var x = flag.x, y = flag.y;
    ctx.fillStyle = col.flagPole;
    ctx.fillRect(x + 14, y - T, 4, T * 2);
    ctx.fillStyle = col.coin;
    ctx.fillRect(x + 12, y - T - 6, 8, 8);
    for (var i = 0; i < 6; i++) {
      var dy = Math.round(Math.sin(time * 6 - i * 0.8) * (i * 0.6));
      ctx.fillStyle = (i % 2) ? col.flagDark : col.flag;
      ctx.fillRect(x + 18 + i * 5, y - T + 4 + dy, 5, 18 - i);
    }
  }

  function drawPlayer(ctx, p) {
    var hw = p.w / 2;
    ctx.save();
    ctx.translate(Math.round(p.x + hw), Math.round(p.y + p.h));
    ctx.scale(p.sx, p.sy);
    var f = p.facing;

    // feet
    var running = p.onGround && Math.abs(p.vx) > 30;
    var step = running ? Math.sin(p.animTime * 22) : 0;
    ctx.fillStyle = col.playerFeet;
    if (p.onGround) {
      ctx.fillRect(-hw + 2 + Math.round(step * 3), -4 - (step > 0.3 ? 2 : 0), 7, 4);
      ctx.fillRect(hw - 9 - Math.round(step * 3), -4 - (step < -0.3 ? 2 : 0), 7, 4);
    } else {
      var tuck = p.vy < 0 ? 0 : 2;
      ctx.fillRect(-hw + 1, -4 + tuck, 7, 4);
      ctx.fillRect(hw - 8, -4 + tuck, 7, 4);
    }

    // body
    ctx.fillStyle = col.player;
    ctx.fillRect(-hw, -p.h + 2, p.w, p.h - 5);
    ctx.fillRect(-hw + 2, -p.h, p.w - 4, 2);
    ctx.fillStyle = col.playerDark;
    ctx.fillRect(-hw, -8, p.w, 5);
    ctx.fillRect(f > 0 ? -hw : hw - 3, -p.h + 2, 3, p.h - 5);

    // headband
    ctx.fillStyle = col.playerBand;
    ctx.fillRect(-hw, -p.h + 5, p.w, 3);
    ctx.fillRect(f > 0 ? -hw - 4 : hw, -p.h + 6 + (running && step > 0 ? 1 : 0), 4, 2);

    // eyes
    var ex = f > 0 ? 1 : -9;
    ctx.fillStyle = col.playerEye;
    ctx.fillRect(ex, -p.h + 10, 4, 6);
    ctx.fillRect(ex + 5, -p.h + 10, 4, 6);
    ctx.fillStyle = col.playerPupil;
    var py = p.vy > 120 ? 3 : (p.vy < -120 ? 0 : 2);
    ctx.fillRect(ex + (f > 0 ? 2 : 0), -p.h + 10 + py, 2, 3);
    ctx.fillRect(ex + 5 + (f > 0 ? 2 : 0), -p.h + 10 + py, 2, 3);
    ctx.restore();
  }

  function drawParticle(ctx, pt) {
    ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    ctx.fillStyle = pt.color;
    var s = pt.size;
    ctx.fillRect(Math.round(pt.x - s / 2), Math.round(pt.y - s / 2), s, s);
    ctx.globalAlpha = 1;
  }

  return {
    drawBackground: drawBackground,
    drawTile: drawTile,
    drawCoin: drawCoin,
    drawCheckpoint: drawCheckpoint,
    drawFlag: drawFlag,
    drawPlayer: drawPlayer,
    drawParticle: drawParticle
  };
})();
