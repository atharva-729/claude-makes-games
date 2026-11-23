// GLOAMREACH - optional in-page self checks. Only runs when the page is opened with ?test
// (e.g. index.html?test). Results go to the console and to a <pre id="testout">.
(function () {
  var shot = /shot=(\w+)/.exec(location.search);
  if (shot) { setTimeout(function () { scene(shot[1]); }, 30); return; }
  if (location.search.indexOf('test') < 0) return;
  setTimeout(run, 50);

  // screenshot scenarios: index.html?shot=NAME
  function scene(name) {
    var G = GAME.G, I = GAME.Input, T = CFG.TILE;
    if (name === 'title') return;
    GAME.newGame(); G.state = 'play';
    var p = GAME.player();
    function at(tx, ty) { p.x = tx * T + 5; p.y = (ty + 1) * T - p.h; p.vx = 0; p.vy = 0; }
    function steps(n, fn) { for (var i = 0; i < n; i++) { if (fn) fn(i); GAME.step(CFG.DT); I.endStep(); } }
    G.godMode = true;
    if (name === 'start') { steps(150); I.press('right'); steps(40); I.release('right'); I.press('attack'); steps(3); }
    if (name === 'shaft') { G.areaCardT = -1; at(64, 42); p.energy = 60; steps(60); }
    if (name === 'corridor') { G.areaCardT = -1; at(79, 26); steps(40); I.press('down'); I.press('attack'); steps(4); }
    if (name === 'mixed') { G.areaCardT = -1; at(118, 29); steps(200); }
    if (name === 'arena') { G.areaCardT = -1; at(163, 29); steps(200); }
    if (name === 'rest') { G.areaCardT = -1; at(181, 29); steps(60); }
    if (name === 'secret') { G.areaCardT = -1; G.broken = true; at(69, 42); steps(60); }
    if (name === 'boss' || name === 'boss2' || name === 'boss3' || name === 'win' || name === 'pause') {
      G.areaCardT = -1; GAME.debugWarp(); I.press('right'); steps(80); I.release('right');
      if (name === 'boss') steps(130);
      else steps(260);
      var b = G.boss;
      if (name === 'boss2' || name === 'boss3') { b.hp = name === 'boss2' ? 35 : 17; hurtBoss(b, 1, 1); steps(400); }
      if (name === 'boss3') steps(300);
      if (name === 'win') { b.hp = 1; hurtBoss(b, 1, 1); steps(60 * 8); }
      if (name === 'pause') G.state = 'paused';
    }
    if (name === 'hurt') { G.areaCardT = -1; at(112, 29); G.godMode = false; p.hp = 2; GAME.hurtPlayer(1, p.x + 30); steps(6); }
    G.godMode = false;
  }

  function run() {
    var p, out = [], ok = true, I = GAME.Input, G = GAME.G, T = CFG.TILE;
    function log(s) { out.push(s); console.log('[T] ' + s); }
    function check(name, cond, info) { log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); if (!cond) ok = false; }
    function steps(n, fn) { for (var i = 0; i < n; i++) { if (fn) fn(i); GAME.step(CFG.DT); I.endStep(); } }
    function releaseAll() { I.held = {}; I.edge = {}; }
    function tap(a) { I.release(a); I.press(a); }
    function releaseDir() { I.release('left'); I.release('right'); }
    function place(tx, ty) { p = GAME.player(); p.hp = p.maxHp; G.spikeResetT = 0; G.deathT = -1; p.x = tx * T + (T - p.w) / 2; p.y = (ty + 1) * T - p.h; p.vx = 0; p.vy = 0; p.dashT = 0; p.invuln = 0; p.hurtT = 0; }
    try {
      GAME.newGame(); G.state = 'play'; G.areaCardT = -1;
      p = GAME.player();
      steps(30);
      check('player rests on ground', p.onGround && Math.abs(p.y + p.h - 56 * T) < 1, 'y=' + (p.y + p.h));
      var x0 = p.x;
      I.press('right'); steps(60); releaseAll();
      check('run right moves player', p.x - x0 > 200, 'dx=' + Math.round(p.x - x0));
      steps(20);
      I.press('jump'); steps(1);
      check('jump launches', p.vy < -500, 'vy=' + Math.round(p.vy));
      var minY = p.y; steps(60, function () { minY = Math.min(minY, p.y); });
      releaseAll(); steps(40);
      check('full jump height ~4 tiles', (56 * T - p.h - minY) > 110 && (56 * T - p.h - minY) < 145, 'h=' + Math.round(56 * T - p.h - minY));
      check('lands again', p.onGround);

      // slash the tutorial grub
      var grub = G.enemies.filter(function (e) { return e.type === 'grub'; })[0];
      place(Math.floor((grub.x + grub.w / 2) / T) - 2, 55); p.facing = 1; grub.dir = -1;
      steps(2);
      var hp0 = grub.hp, en0 = p.energy;
      I.press('attack'); steps(12); releaseAll();
      check('forward slash hits grub', grub.hp < hp0 && p.energy > en0, 'hp ' + hp0 + '->' + grub.hp + ' energy ' + p.energy);

      // dash gap: run from col 36, jump at the edge, dash mid-air
      place(36, 55); p.hp = p.maxHp; var hpBefore = p.hp;
      I.press('right');
      var jumped = false, dashed = false, trace = [];
      steps(150, function () {
        if (!jumped && p.x + p.w > 44.7 * T) { I.press('jump'); jumped = true; }
        else if (jumped && !dashed && !p.onGround && p.vy > -250) { I.press('dash'); dashed = true; }
        if (jumped && !p.dead && p.hp === hpBefore) trace.push(Math.round(p.x) + ',' + Math.round(p.y));
      });
      log('gap trace ' + trace.filter(function (v, i) { return i % 4 === 0; }).join(' '));
      releaseAll(); steps(10);
      check('dash gap is clearable', p.x > 53 * T && p.hp === hpBefore && p.onGround, 'x tile=' + (p.x / T).toFixed(1) + ' hp=' + p.hp);
      // without dash it should fail (fall in spikes)
      place(36, 55); p.hp = p.maxHp; jumped = false;
      I.press('right');
      steps(150, function () { if (!jumped && p.x + p.w > 44.7 * T) { I.press('jump'); jumped = true; } });
      releaseAll(); steps(40);
      check('gap needs the dash', p.hp < p.maxHp, 'hp=' + p.hp);

      // wall-jump climb of the shaft (tiny bot: zig-zag between walls)
      place(60, 55); p.hp = p.maxHp;
      var dir = 1, maxClimb = 0;
      I.press('right');
      steps(900, function () {
        if (p.onGround && p.x > 62 * T) { tap('jump'); }
        if (p.wallSliding || (p.wallDir !== 0 && !p.onGround && p.vy > -100)) {
          tap('jump'); dir = -p.wallDir; releaseDir(); I.press(dir > 0 ? 'right' : 'left');
        }
        if (p.y < 30 * T) { releaseDir(); I.press('right'); }
        if (p.onGround && p.y + p.h <= 30 * T + 1) releaseAll();
        maxClimb = Math.max(maxClimb, 56 * T - p.y);
      });
      releaseAll(); steps(20);
      check('shaft climbable with wall jumps', 56 * T - maxClimb <= 30 * T + 1, 'feet row=' + ((p.y + p.h) / T).toFixed(1));

      // pogo across the spike corridor
      place(70, 29); p.energy = 0; G.enemies = []; p.safeX = p.x; p.safeY = p.y;
      var hits = 0, ptrace = [];
      I.press('right');
      steps(600, function () {
        if (p.onGround && p.x < 99 * T) tap('jump');
        I.release('down');
        if (!p.onGround && p.vy > 0 && p.y + p.h > 880 && p.atkCd <= 0) { I.press('down'); tap('attack'); }
        if (p.x > 100 * T) { I.release('right'); }
        if (ptrace.length < 400) ptrace.push(Math.round(p.x / T * 10) / 10 + ',' + Math.round(p.y + p.h) + (p.onGround ? 'G' : '') + (p.slashT > 0 ? 'S' : '') + (G.spikeResetT > 0 ? 'R' : ''));
      });
      log('pogo trace ' + ptrace.filter(function (v, i) { return i % 3 === 0; }).slice(0, 120).join(' '));
      releaseAll(); steps(10);
      check('spike corridor passable by pogo', p.x > 99 * T && p.hp === p.maxHp, 'x tile=' + (p.x / T).toFixed(1) + ' hp=' + p.hp);

      // spitters fire, flyers wind up
      GAME.newGame(); G.state = 'play'; p = GAME.player();
      place(121, 29);
      var sawSpit = false, sawWind = false;
      G.godMode = true;
      steps(300, function () {
        G.projectiles.forEach(function (pr) { if (pr.kind === 'spit') sawSpit = true; });
        G.enemies.forEach(function (e) { if (e.type === 'flyer' && e.state === 'wind') sawWind = true; });
      });
      G.godMode = false;
      check('spitter lobs seeds', sawSpit);
      check('flyer telegraphs swoop', sawWind);

      // arena closes and spawns waves
      GAME.newGame(); G.state = 'play'; p = GAME.player();
      place(163, 29); steps(80);
      check('arena gates close + wave spawns', G.arenaClosed && G.enemies.some(function (e) { return e.arena; }));
      G.enemies.forEach(function (e) { if (e.arena) e.dying = 0.01; });
      steps(120);
      G.enemies.forEach(function (e) { if (e.arena) e.dying = 0.01; });
      steps(120);
      check('arena opens after waves', G.arena.state === 'done' && !G.arenaClosed, G.arena.state);

      // rest + breakable + heart
      place(183, 29); steps(5); I.press('up'); steps(3); releaseAll();
      check('rest sets respawn', G.rested && G.respawn.x === 183);
      place(66, 42); p.facing = 1; steps(3);
      for (var k = 0; k < 3; k++) { tap('attack'); steps(25); releaseAll(); }
      check('secret wall breaks', G.broken);
      I.press('right'); steps(90); releaseAll();
      check('heart upgrade collected', G.heartTaken && p.maxHp === 6, 'maxHp=' + p.maxHp);

      // boss: trigger, phases, death, victory
      GAME.debugWarp(); I.press('right'); steps(90); releaseAll();
      var b = G.boss;
      check('boss intro starts + gate shuts', G.bossState === 'intro' && G.bossGateClosed);
      G.godMode = true;
      steps(260);
      check('boss fight begins', G.bossState === 'fight', b.state);
      var states = {};
      steps(1200, function () { states[b.state] = 1; });
      check('phase 1 attacks seen', !!(states.chargeWind || states.leapWind || states.volleyWind), Object.keys(states).join(','));
      var g1 = 0; while (b.phase === 1 && b.hp > 0 && g1++ < 3000) { if (b.state !== 'roar') hurtBoss(b, 1, 1); steps(2); }
      check('phase 2 transition roar', b.phase === 2 && (b.state === 'roar' || b.pendingPhase), 'hp=' + b.hp + ' state=' + b.state);
      steps(200);
      check('phase 2 dims + rain', G.rainTarget > 0 && G.brazierTarget < 1);
      states = {};
      steps(1800, function () { states[b.state] = 1; });
      check('phase 2 adds dive/summon', !!(states.diveWind || states.summonWind), Object.keys(states).join(','));
      var g2 = 0; while (b.phase === 2 && b.hp > 0 && g2++ < 3000) { if (b.state !== 'roar') hurtBoss(b, 1, 1); steps(2); }
      steps(200);
      check('phase 3 spikes', b.phase === 3 && G.bossSpikes);
      states = {}; var sawDebris = false, sawBig = false;
      steps(900, function () { states[b.state] = 1; G.projectiles.forEach(function (pr) { if (pr.kind === 'debris') sawDebris = true; }); if (b.state === 'diveFall' && bossContactDamage(b) === 2) sawBig = true; });
      check('phase 3 stalactites fall', sawDebris, Object.keys(states).join(','));
      check('phase 3 dive deals 2', sawBig || !states.diveFall);
      var guard = 0;
      while (b.hp > 0 && guard++ < 5000) { if (b.state !== 'roar') hurtBoss(b, 1, 1); steps(2); }
      check('boss dying slow-mo', b.state === 'dying' && G.timeScale < 1);
      steps(60 * 9);
      check('victory screen', G.state === 'victory', G.state);
      G.godMode = false;

      // death -> respawn at shrine
      GAME.newGame(); G.state = 'play'; G.rested = true; G.respawn = { x: 183, y: 29 };
      p = GAME.player(); p.hp = 1; GAME.hurtPlayer(1, p.x + 50);
      steps(200);
      p = GAME.player();
      check('death respawns at shrine with full hp', !p.dead && Math.abs(p.x - 183 * T) < 40 && p.hp === p.maxHp, 'x=' + (p.x / T).toFixed(1));
    } catch (err) {
      ok = false; log('EXCEPTION ' + err.message + '\n' + err.stack);
    }
    log(ok ? 'ALL PASS' : 'SOME FAILED');
    var pre = document.createElement('pre'); pre.id = 'testout'; pre.textContent = out.join('\n');
    document.body.appendChild(pre);
    console.log(out.join('\n'));
    GAME.newGame(); G.state = 'title';
  }
})();
