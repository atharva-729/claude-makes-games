// Key bindings, a key-remapping panel and a "stuck?" hint.
// Added after the original run (2026-11-23) and shared by both A1 games, so it is
// not part of what the model wrote. The game asks Controls which action a key
// code means, and calls Controls.tick() once per frame.
var Controls = (function () {
  'use strict';

  // Actions the player can remap, in the order the panel lists them.
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'bolt', 'heal'];
  var DEFAULTS = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    jump: ['Space'], attack: ['KeyJ'], dash: ['KeyK', 'ShiftLeft', 'ShiftRight'],
    bolt: ['KeyL'], heal: ['Semicolon']
  };
  // Keys that can never be bound to an action: the game's fixed keys, the panel key,
  // and keys the browser or OS would grab (Ctrl+W closes the tab, Ctrl+S saves, ...).
  var RESERVED = {
    Escape: 1, Enter: 1, NumpadEnter: 1, KeyP: 1, KeyR: 1, KeyM: 1, KeyO: 1,
    F1: 1, F2: 1, F5: 1, F11: 1, F12: 1, Tab: 1,
    ControlLeft: 1, ControlRight: 1, AltLeft: 1, AltRight: 1, MetaLeft: 1, MetaRight: 1
  };
  var OPEN_KEY = 'KeyO';

  var opts = { storageKey: 'a1.keys.v1', fixed: {}, names: {} };
  var bind = {}, byCode = {};
  var listeners = [];

  function copyDefaults() { var b = {}; ACTIONS.forEach(function (a) { b[a] = DEFAULTS[a].slice(); }); return b; }
  function rebuild() {
    byCode = {};
    ACTIONS.forEach(function (a) { bind[a].forEach(function (c) { byCode[c] = a; }); });
  }
  function load() {
    bind = copyDefaults();
    try {
      var s = JSON.parse(localStorage.getItem(opts.storageKey) || 'null');
      if (s) ACTIONS.forEach(function (a) {
        if (Array.isArray(s[a]) && s[a].length && s[a].every(function (c) { return typeof c === 'string' && !RESERVED[c]; })) bind[a] = s[a].slice();
      });
    } catch (e) { /* storage blocked: defaults only */ }
    rebuild();
  }
  function save() { try { localStorage.setItem(opts.storageKey, JSON.stringify(bind)); } catch (e) { /* ignore */ } }
  function isDefault() { return ACTIONS.every(function (a) { return bind[a].join() === DEFAULTS[a].join(); }); }

  // ---------------------------------------------------------------- key labels
  var NAMED = {
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
    Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Backspace: 'Backspace', CapsLock: 'Caps Lock',
    Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down',
    ContextMenu: 'Menu', IntlBackslash: '\\'
  };
  function keyName(code) {
    if (NAMED[code]) return NAMED[code];
    var m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
    if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
    return code;
  }
  function label(action, max) {
    var seen = {}, out = [];
    (bind[action] || []).forEach(function (c) { var n = keyName(c); if (!seen[n]) { seen[n] = 1; out.push(n); } });
    if (max) out = out.slice(0, max);
    return out.join(' or ') || '(none)';
  }
  // One short string for the four movement keys.
  function moveLabel() {
    var d = DEFAULTS;
    if (['left', 'right', 'up', 'down'].every(function (a) { return bind[a].join() === d[a].join(); })) return 'WASD or arrow keys';
    return ['up', 'left', 'down', 'right'].map(function (a) { return label(a, 1); }).join(' ');
  }

  // ---------------------------------------------------------------- lookup
  function action(code) {
    if (panelOpen) return null;
    if (byCode[code]) return byCode[code];
    return opts.fixed[code] || null;
  }

  // ---------------------------------------------------------------- DOM: panel + hint
  var root, panel, list, hint, openBtn, panelOpen = false, sel = 0, waiting = null, msgEl;
  var CSS = [
    '.kc-root{position:fixed;inset:0;pointer-events:none;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:10}',
    '.kc-btn{position:fixed;top:12px;right:12px;pointer-events:auto;background:rgba(10,16,28,.72);color:#d8e6ee;border:1px solid rgba(160,200,220,.35);border-radius:6px;padding:5px 10px;font:inherit;font-size:13px;cursor:pointer;display:none}',
    '.kc-btn:hover{border-color:#f5c96a;color:#fff}',
    '.kc-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;pointer-events:auto;background:rgba(8,12,22,.96);color:#e6edf2;border:1px solid rgba(160,200,220,.35);border-radius:10px;padding:18px 18px 14px;box-shadow:0 20px 60px rgba(0,0,0,.6);display:none}',
    '.kc-panel h2{margin:0 0 4px;font-size:18px;font-weight:600}',
    '.kc-panel p{margin:0 0 12px;color:#93a6b4;font-size:12.5px}',
    '.kc-row{display:flex;justify-content:space-between;align-items:center;width:100%;background:none;border:1px solid transparent;border-radius:6px;padding:6px 8px;color:inherit;font:inherit;cursor:pointer;text-align:left}',
    '.kc-row:hover,.kc-row.sel{border-color:rgba(245,201,106,.55);background:rgba(245,201,106,.07)}',
    '.kc-row .k{font-family:ui-monospace,Consolas,monospace;background:#1b2535;border:1px solid #2c3a50;border-radius:4px;padding:1px 8px;color:#fff}',
    '.kc-row.wait .k{background:#f5c96a;color:#111;border-color:#f5c96a}',
    '.kc-fixed{margin:10px 0 0;padding:8px 8px 0;border-top:1px solid #223047;color:#93a6b4;font-size:12.5px}',
    '.kc-msg{min-height:18px;margin:8px 8px 0;color:#f5c96a;font-size:12.5px}',
    '.kc-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}',
    '.kc-foot button{background:#1b2535;color:#e6edf2;border:1px solid #2c3a50;border-radius:6px;padding:5px 12px;font:inherit;cursor:pointer}',
    '.kc-foot button:hover{border-color:#f5c96a}',
    '.kc-hint{position:fixed;transform:translate(-50%,0);padding:6px 14px;border-radius:999px;background:rgba(6,10,18,.78);color:#ffe9b8;border:1px solid rgba(245,201,106,.45);font-size:14px;white-space:nowrap;opacity:0;transition:opacity .6s;pointer-events:none}',
    '.kc-hint b{color:#fff}'
  ].join('\n');

  var NAMES = {
    left: 'Move left', right: 'Move right', up: 'Up (aim up, rest)', down: 'Down (aim down, pogo)',
    jump: 'Jump', attack: 'Slash', dash: 'Dash', bolt: 'Bolt', heal: 'Heal (hold)'
  };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function buildDom() {
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div', 'kc-root');
    openBtn = el('button', 'kc-btn', 'Change controls (O)');
    openBtn.addEventListener('click', function () { openPanel(); openBtn.blur(); });
    panel = el('div', 'kc-panel');
    panel.appendChild(el('h2', null, 'Controls'));
    panel.appendChild(el('p', null, 'Click an action (or pick it with ↑ ↓ and press Enter), then press the new key. Saved in this browser.'));
    list = el('div'); panel.appendChild(list);
    msgEl = el('div', 'kc-msg'); panel.appendChild(msgEl);
    panel.appendChild(el('div', 'kc-fixed', 'Fixed keys: Esc or P pause · R back to rest point · M mute · O this panel<br>Testing aids: F1 invincibility on/off · F2 skip to the boss'));
    var foot = el('div', 'kc-foot');
    var reset = el('button', null, 'Reset to defaults');
    reset.addEventListener('click', function () { bind = copyDefaults(); rebuild(); save(); msg('Defaults restored.'); renderList(); reset.blur(); });
    var done = el('button', null, 'Done (Esc)');
    done.addEventListener('click', closePanel);
    foot.appendChild(reset); foot.appendChild(done); panel.appendChild(foot);
    hint = el('div', 'kc-hint');
    root.appendChild(openBtn); root.appendChild(panel); root.appendChild(hint);
    document.body.appendChild(root);
  }

  function renderList() {
    list.innerHTML = '';
    ACTIONS.forEach(function (a, i) {
      var row = el('button', 'kc-row' + (i === sel ? ' sel' : '') + (waiting === a ? ' wait' : ''));
      row.appendChild(el('span', null, opts.names[a] || NAMES[a]));
      row.appendChild(el('span', 'k', waiting === a ? 'press a key…' : label(a)));
      row.addEventListener('click', function () { sel = i; startWait(a); row.blur(); });
      list.appendChild(row);
    });
  }
  function msg(s) { msgEl.textContent = s || ''; }
  function startWait(a) { waiting = a; msg('Press a key for ' + (opts.names[a] || NAMES[a]).toLowerCase() + '. Esc cancels.'); renderList(); }

  function assign(a, code) {
    if (RESERVED[code]) { msg(keyName(code) + ' is reserved. Pick another key.'); return; }
    var prev = bind[a].slice(), other = byCode[code];
    bind[a] = [code];
    if (other && other !== a) {
      // swap: the other action takes this action's old keys (minus the stolen one)
      var rest = bind[other].filter(function (c) { return c !== code; });
      bind[other] = rest.length ? rest : prev.filter(function (c) { return c !== code; });
      if (!bind[other].length) bind[other] = prev;
      msg(keyName(code) + ' was on ' + (opts.names[other] || NAMES[other]).toLowerCase() + '; that action now uses ' + bind[other].map(keyName).join(' or ') + '.');
    } else msg('');
    rebuild(); save();
  }

  function openPanel() {
    if (panelOpen) return;
    panelOpen = true; waiting = null; sel = 0; msg('');
    renderList(); panel.style.display = 'block';
    listeners.forEach(function (f) { f('open'); });
  }
  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false; waiting = null; panel.style.display = 'none';
    listeners.forEach(function (f) { f('close'); });
  }

  // Capture-phase listener: runs before the game's own key handler and swallows keys while the panel is open.
  function onKey(ev) {
    if (!panelOpen) {
      if (ev.code === OPEN_KEY && menuShown && !ev.repeat) { ev.preventDefault(); ev.stopImmediatePropagation(); openPanel(); }
      return;
    }
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (ev.type !== 'keydown' || ev.repeat) return;
    if (waiting) {
      if (ev.code === 'Escape') { waiting = null; msg(''); }
      else { assign(waiting, ev.code); waiting = null; }
      renderList(); return;
    }
    if (ev.code === 'Escape' || ev.code === OPEN_KEY) { closePanel(); return; }
    if (ev.code === 'ArrowDown' || ev.code === 'KeyS') { sel = (sel + 1) % ACTIONS.length; renderList(); return; }
    if (ev.code === 'ArrowUp' || ev.code === 'KeyW') { sel = (sel + ACTIONS.length - 1) % ACTIONS.length; renderList(); return; }
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') { startWait(ACTIONS[sel]); }
  }

  // ---------------------------------------------------------------- stuck hint
  // Cheap heuristics, no pathfinding:
  //  - died 3+ times: show the hint for a few seconds after each respawn;
  //  - outside the boss fight, 75 s of play without reaching a new part of the map
  //    (the map is split into 5x5-tile cells);
  //  - inside the boss fight, the fight has lasted more than 150 s.
  var menuShown = false, hintA = 0, lastDeaths = 0, deathShowT = 0, idleT = 0, bossT = 0, cells = {}, cellSize = 160;
  function tick(dt, s) {
    // s: { menu, playing, deaths, x, y, boss, god }
    menuShown = !!s.menu;
    if (openBtn) openBtn.style.display = s.menu && !panelOpen ? 'block' : 'none';
    if (s.deaths < lastDeaths) { cells = {}; idleT = 0; bossT = 0; }  // new game
    if (s.deaths > lastDeaths && s.deaths >= 3) deathShowT = 9;
    lastDeaths = s.deaths;
    var why = '';
    if (s.playing) {
      deathShowT = Math.max(0, deathShowT - dt);
      var k = Math.floor(s.x / cellSize) + ',' + Math.floor(s.y / cellSize);
      if (!cells[k]) { cells[k] = 1; idleT = 0; } else idleT += dt;
      if (s.boss) bossT += dt; else bossT = 0;
      if (deathShowT > 0) why = 'deaths';
      else if (!s.boss && idleT > 75) why = 'lost';
      else if (s.boss && bossT > 150) why = 'boss';
    }
    var show = !!why && !s.god && s.playing;
    if (show) {
      hint.innerHTML = 'Stuck? Press <b>F1</b> for invincibility' + (s.boss ? '' : ' · <b>F2</b> skips to the boss');
      var r = s.canvas.getBoundingClientRect();
      hint.style.left = (r.left + r.width / 2) + 'px';
      hint.style.top = (r.bottom - Math.max(34, r.height * 0.075)) + 'px';
    }
    hintA = show ? 1 : 0;
    if (hint.style.opacity !== String(hintA)) hint.style.opacity = String(hintA);
    if (s.god) { idleT = 0; bossT = 0; deathShowT = 0; }
  }

  function init(o) {
    for (var k in o) opts[k] = o[k];
    load();
    buildDom();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
  }

  // Replace {jump}, {attack}, {move} ... in sign text with the current keys.
  function fill(str) {
    return String(str).replace(/\{(\w+)\}/g, function (m, a) {
      if (a === 'move') return Controls.moveLabel();
      return bind[a] ? label(a, a === 'dash' ? 2 : 1) : m;
    });
  }

  return {
    init: init, action: action, label: label, moveLabel: moveLabel, tick: tick, fill: fill,
    isOpen: function () { return panelOpen; },
    onPanel: function (f) { listeners.push(f); },
    isDefault: isDefault
  };
})();
