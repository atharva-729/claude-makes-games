// WICKFALL - enemy logic: Bramblebacks (crawlers), Gloamwings (flyers), Mirepods (spitters).
var Enemies = (function () {
  var T = CFG.TILE, E = CFG.enemy;

  function create(type, tx, ty, opts) {
    opts = opts || {};
    var c = CFG[type];
    var e = {
      type: type, w: c.w, h: c.h, vx: 0, vy: 0, kx: 0, ky: 0, dir: opts.dir || -1,
      hp: c.hp, maxHp: c.hp, state: 'idle', t: 0, cd: 0.6 + Math.random() * 0.6, flash: 0,
      spawnT: opts.spawn ? E.spawnTime : 0, dead: false, animT: Math.random() * 10,
      harmless: type === 'grub', onGround: false, minion: !!opts.minion
    };
    e.x = tx * T - c.w / 2;
    e.y = (type === 'flyer') ? ty * T - c.h / 2 : ty * T - c.h;
    e.home = { x: e.x, y: e.y };
    if (type === 'crawler' || type === 'grub') e.state = 'walk';
    if (type === 'flyer') e.state = 'hover';
    return e;
  }

  function cx(o) { return o.x + o.w / 2; }
  function cy(o) { return o.y + o.h / 2; }

  function edgeAhead(e) {
    var ax = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
    return Game.solidAtPx(ax, e.y + e.h - 6) || !Game.solidAtPx(ax, e.y + e.h + 6) || Game.spikeAtPx(ax, e.y + e.h - 6);
  }

  function updateCrawler(e, dt, p) {
    var c = CFG.crawler, grub = e.type === 'grub';
    e.vy = Math.min(900, e.vy + c.gravity * dt);
    e.cd -= dt;
    if (e.state === 'walk') {
      if (e.onGround && edgeAhead(e)) e.dir = -e.dir;
      e.vx = e.dir * (grub ? CFG.grub.speed : c.speed);
      if (!grub && e.cd <= 0 && e.onGround && !p.dead) {
        var dx = cx(p) - cx(e), dy = Math.abs(cy(p) - cy(e));
        if (Math.abs(dx) < c.lungeRange && dy < 60) {
          e.dir = dx > 0 ? 1 : -1; e.state = 'tell'; e.t = c.lungeTell; Sound.play('tellSmall');
        }
      }
    } else if (e.state === 'tell') {
      e.vx = 0; e.t -= dt;
      if (e.t <= 0) { e.state = 'lunge'; e.t = c.lungeTime; }
    } else if (e.state === 'lunge') {
      e.vx = e.dir * c.lungeSpeed; e.t -= dt;
      if (e.onGround && edgeAhead(e)) { e.vx = 0; e.t = 0; }
      if (Math.random() < 0.4) Game.addParticle({ x: cx(e) - e.dir * 14, y: e.y + e.h, vx: -e.dir * 40, vy: -30, life: 0.3, size: 2.5, color: [140, 150, 190], type: 'dot' });
      if (e.t <= 0) { e.state = 'walk'; e.cd = c.lungeCooldown; }
    }
    Game.moveBody(e, (e.vx + e.kx) * dt, e.vy * dt);
    e.kx *= 0.86;
  }

  function updateFlyer(e, dt, p) {
    var c = CFG.flyer;
    e.cd -= dt;
    var dx = cx(p) - cx(e), dy = cy(p) - cy(e), dist = Math.sqrt(dx * dx + dy * dy);
    var mvx = 0, mvy = 0;
    if (e.state === 'hover') {
      var ax = e.home.x + Math.sin(e.animT * 0.8) * 40, ay = e.home.y + Math.sin(e.animT * 2.1) * 10;
      if (!p.dead && dist < c.aggro * 1.7) {
        // shadow the player from above and to the side
        var side = dx > 0 ? -1 : 1;
        ax = cx(p) + side * 130 - e.w / 2; ay = p.y - 120 + Math.sin(e.animT * 2.1) * 10;
        e.dir = dx > 0 ? 1 : -1;
      }
      var hx = ax - e.x, hy = ay - e.y, hd = Math.sqrt(hx * hx + hy * hy);
      if (hd > 4) { mvx = hx / hd * c.hoverSpeed; mvy = hy / hd * c.hoverSpeed; }
      if (!p.dead && dist < c.aggro && e.cd <= 0) { e.state = 'tell'; e.t = c.tell; Sound.play('tellSmall'); }
    } else if (e.state === 'tell') {
      e.t -= dt; e.dir = dx > 0 ? 1 : -1;
      mvx = -Math.sign(dx) * 30; mvy = -40;        // draws back before the swoop
      if (e.t <= 0) {
        var d = Math.max(1, dist);
        e.sx = dx / d; e.sy = dy / d;
        e.state = 'swoop'; e.t = Math.min(1.0, (dist + 110) / c.swoopSpeed);
        Sound.play('swoop');
      }
    } else if (e.state === 'swoop') {
      e.t -= dt;
      mvx = e.sx * c.swoopSpeed; mvy = e.sy * c.swoopSpeed;
      if (e.t <= 0) { e.state = 'hover'; e.cd = c.cooldown; }
    }
    mvx += e.kx; mvy += e.ky; e.kx *= 0.88; e.ky *= 0.88;
    var nx = e.x + mvx * dt, ny = e.y + mvy * dt;
    if (!Game.solidAtPx(nx + e.w / 2, e.y + e.h / 2)) e.x = nx; else if (e.state === 'swoop') e.t = 0;
    if (!Game.solidAtPx(e.x + e.w / 2, ny + e.h / 2)) e.y = ny; else if (e.state === 'swoop') e.t = 0;
    e.vx = mvx; e.vy = mvy;
  }

  function updateSpitter(e, dt, p) {
    var c = CFG.spitter;
    e.cd -= dt;
    var dx = cx(p) - cx(e), dy = cy(p) - e.y;
    if (Math.abs(dx) > 10) e.dir = dx > 0 ? 1 : -1;
    if (e.state === 'idle') {
      if (!p.dead && e.cd <= 0 && Math.abs(dx) < c.range && Math.abs(dy) < 420) { e.state = 'tell'; e.t = c.tell; Sound.play('tellSmall'); }
    } else if (e.state === 'tell') {
      e.t -= dt;
      if (e.t <= 0) {
        var Tm = c.flight;
        Game.spawnProjectile({
          kind: 'spore', friendly: false, x: cx(e), y: e.y + 2, r: c.shotRadius, g: c.gravity, life: 4,
          vx: Math.max(-c.range, Math.min(c.range, dx)) / Tm, vy: dy / Tm - 0.5 * c.gravity * Tm, damage: 1, pogo: true
        });
        Sound.play('spit');
        e.state = 'spit'; e.t = 0.25;
      }
    } else if (e.state === 'spit') {
      e.t -= dt;
      if (e.t <= 0) { e.state = 'idle'; e.cd = c.cooldown; }
    }
  }

  function update(e, dt) {
    e.animT += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    var p = Game.player;
    if (e.type === 'crawler' || e.type === 'grub') updateCrawler(e, dt, p);
    else if (e.type === 'flyer') updateFlyer(e, dt, p);
    else updateSpitter(e, dt, p);
  }

  // returns true if the blow killed it
  function hurt(e, dmg, dirX, dirY) {
    if (e.dead) return false;
    e.hp -= dmg; e.flash = E.flash;
    if (e.type !== 'spitter') { e.kx = dirX * E.knock; e.ky = (dirY || 0) * E.knock; }
    if (e.type === 'crawler' && e.state !== 'walk') { e.state = 'walk'; e.cd = 0.5; }
    if (e.type === 'flyer' && e.state !== 'hover') { e.state = 'hover'; e.cd = 0.5; }
    if (e.hp <= 0) { kill(e); return true; }
    return false;
  }

  function kill(e) {
    e.dead = true;
    var col = e.type === 'spitter' ? CFG.colors.green : (e.type === 'grub' ? CFG.colors.gold : CFG.colors.violet);
    Game.burst(cx(e), cy(e), 22, { color: col, speed: 260, life: 0.7, type: 'spark', g: 500 });
    Game.burst(cx(e), cy(e), 10, { color: [30, 26, 60], speed: 160, life: 0.8, type: 'shard', g: 900, size: 6 });
    Game.addParticle({ x: cx(e), y: cy(e), life: 0.35, size: 8, grow: 220, color: col, type: 'ring' });
    Sound.play('enemyDie');
  }

  return { create: create, update: update, hurt: hurt, kill: kill };
})();
