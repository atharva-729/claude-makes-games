// WICKFALL - all music and sound effects, synthesised with WebAudio.
var Sound = (function () {
  var ac = null, master, sfxBus, musicBus, modeGain = null, delay, noiseBuf;
  var muted = false, mode = 'none', nextTime = 0, stepIdx = 0, seed = 7;

  function rnd() { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 0x10000; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85;
    var comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    delay = ac.createDelay(1.0); delay.delayTime.value = 0.42;
    var fb = ac.createGain(); fb.gain.value = 0.42;
    var dl = ac.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (mode !== 'none') { var m = mode; mode = 'none'; setMusic(m); }
  }

  // --- primitive voices -----------------------------------------------------
  function tone(o) {
    if (!ac) return;
    var t = o.when || ac.currentTime, dur = o.dur || 0.2, a = o.attack || 0.005;
    var osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = g;
    if (o.lp) {
      var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t);
      if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + dur);
      g.connect(f); out = f;
    }
    osc.connect(g); out.connect(o.dest || sfxBus);
    if (o.echo) out.connect(delay);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(o) {
    if (!ac) return;
    var t = o.when || ac.currentTime, dur = o.dur || 0.2;
    var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q || 1;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // --- sound effects -----------------------------------------------------------
  var fx = {
    slash: function () { noise({ f0: 5200, f1: 900, dur: 0.13, vol: 0.22, q: 0.8 }); tone({ type: 'triangle', f0: 900, f1: 300, dur: 0.09, vol: 0.06 }); },
    hit: function () { noise({ f0: 1800, f1: 300, dur: 0.12, vol: 0.4, q: 0.6 }); tone({ type: 'square', f0: 240, f1: 70, dur: 0.12, vol: 0.2, lp: 1400 }); },
    clink: function () { tone({ type: 'triangle', f0: 1900, f1: 1400, dur: 0.14, vol: 0.2 }); tone({ type: 'sine', f0: 2850, dur: 0.2, vol: 0.09 }); noise({ f0: 6000, dur: 0.05, vol: 0.15 }); },
    enemyDie: function () { noise({ f0: 900, f1: 120, dur: 0.38, vol: 0.4, q: 0.5 }); tone({ type: 'sawtooth', f0: 320, f1: 50, dur: 0.35, vol: 0.2, lp: 1200 }); tone({ type: 'sine', f0: 880, f1: 1760, dur: 0.25, vol: 0.07, echo: true }); },
    hurt: function () { tone({ type: 'sawtooth', f0: 420, f1: 90, dur: 0.32, vol: 0.32, lp: 1800 }); noise({ f0: 500, f1: 150, dur: 0.3, vol: 0.4, q: 0.4 }); },
    jump: function () { tone({ type: 'sine', f0: 280, f1: 520, dur: 0.11, vol: 0.13 }); },
    land: function () { noise({ type: 'lowpass', f0: 380, f1: 90, dur: 0.1, vol: 0.28 }); },
    dash: function () { noise({ f0: 700, f1: 3800, dur: 0.17, vol: 0.26, q: 1.2 }); tone({ type: 'sine', f0: 220, f1: 660, dur: 0.14, vol: 0.07 }); },
    healCharge: function () { tone({ type: 'sine', f0: 330, f1: 660, dur: 0.95, vol: 0.09, attack: 0.3 }); },
    heal: function () { [72, 76, 79, 84].forEach(function (m, i) { tone({ type: 'sine', f0: mtof(m), dur: 0.5, vol: 0.13, when: ac.currentTime + i * 0.05, echo: true }); }); },
    bolt: function () { tone({ type: 'sawtooth', f0: 1300, f1: 240, dur: 0.24, vol: 0.2, lp: 3200 }); noise({ f0: 3000, f1: 700, dur: 0.2, vol: 0.2 }); },
    rest: function () { [57, 64, 69, 72, 76].forEach(function (m, i) { tone({ type: 'sine', f0: mtof(m), dur: 1.9, vol: 0.12, attack: 0.08, when: ac.currentTime + i * 0.17, echo: true }); }); },
    pickup: function () { [69, 73, 76, 81, 85].forEach(function (m, i) { tone({ type: 'triangle', f0: mtof(m), dur: 0.8, vol: 0.13, when: ac.currentTime + i * 0.09, echo: true }); }); },
    breakWall: function () { noise({ type: 'lowpass', f0: 1400, f1: 120, dur: 0.5, vol: 0.5 }); tone({ type: 'square', f0: 110, f1: 40, dur: 0.3, vol: 0.25, lp: 500 }); },
    gate: function () { tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 0.6, vol: 0.35, lp: 500 }); noise({ type: 'lowpass', f0: 600, f1: 80, dur: 0.6, vol: 0.4 }); },
    tellSmall: function () { tone({ type: 'square', f0: 620, f1: 930, dur: 0.22, vol: 0.09, lp: 2500 }); },
    spit: function () { tone({ type: 'sine', f0: 240, f1: 520, dur: 0.14, vol: 0.2 }); noise({ f0: 900, dur: 0.08, vol: 0.14 }); },
    swoop: function () { noise({ f0: 500, f1: 2600, dur: 0.3, vol: 0.2, q: 2 }); },
    spawn: function () { tone({ type: 'sine', f0: 140, f1: 420, dur: 0.6, vol: 0.14, attack: 0.2 }); },
    // boss wind-ups: each attack has its own voice
    tellCharge: function () { tone({ type: 'sawtooth', f0: 70, f1: 150, dur: 0.6, vol: 0.4, lp: 500, lp1: 1800, attack: 0.1 }); noise({ type: 'lowpass', f0: 300, f1: 900, dur: 0.55, vol: 0.2, attack: 0.2 }); },
    tellLeap: function () { tone({ type: 'triangle', f0: 190, f1: 95, dur: 0.5, vol: 0.4 }); tone({ type: 'sine', f0: 95, f1: 60, dur: 0.5, vol: 0.3 }); },
    tellVolley: function () { tone({ type: 'sine', f0: 500, f1: 1250, dur: 0.55, vol: 0.2, attack: 0.15 }); tone({ type: 'sine', f0: 755, f1: 1880, dur: 0.55, vol: 0.12, attack: 0.15 }); },
    tellDive: function () { tone({ type: 'sawtooth', f0: 900, f1: 180, dur: 0.5, vol: 0.2, lp: 2600 }); noise({ f0: 2400, f1: 400, dur: 0.5, vol: 0.16, q: 3 }); },
    diveLock: function () { tone({ type: 'square', f0: 1100, dur: 0.09, vol: 0.14, lp: 3000 }); tone({ type: 'square', f0: 1100, dur: 0.09, vol: 0.14, lp: 3000, when: ac.currentTime + 0.14 }); },
    tellSummon: function () { tone({ type: 'sawtooth', f0: 160, f1: 320, dur: 0.7, vol: 0.22, lp: 900, attack: 0.2 }); tone({ type: 'sawtooth', f0: 163, f1: 480, dur: 0.7, vol: 0.16, lp: 900, attack: 0.2 }); },
    tellShards: function () { [0, 0.1, 0.2, 0.3].forEach(function (d, i) { tone({ type: 'triangle', f0: 1600 - i * 220, dur: 0.3, vol: 0.13, when: ac.currentTime + d, echo: true }); }); },
    slam: function () { tone({ type: 'sine', f0: 130, f1: 32, dur: 0.55, vol: 0.7 }); noise({ type: 'lowpass', f0: 900, f1: 70, dur: 0.5, vol: 0.6 }); },
    stagger: function () { tone({ type: 'triangle', f0: 700, f1: 120, dur: 0.6, vol: 0.25 }); noise({ f0: 2500, f1: 300, dur: 0.4, vol: 0.2 }); },
    roar: function () {
      tone({ type: 'sawtooth', f0: 150, f1: 58, dur: 1.5, vol: 0.5, lp: 1500, lp1: 300, attack: 0.08 });
      tone({ type: 'sawtooth', f0: 226, f1: 80, dur: 1.4, vol: 0.32, lp: 2000, lp1: 300, attack: 0.08, detune: 30 });
      tone({ type: 'square', f0: 75, f1: 40, dur: 1.5, vol: 0.3, lp: 400 });
      noise({ f0: 900, f1: 220, dur: 1.4, vol: 0.4, q: 0.7, attack: 0.1 });
    },
    bossDie: function () {
      tone({ type: 'sawtooth', f0: 320, f1: 30, dur: 2.6, vol: 0.5, lp: 2500, lp1: 120 });
      noise({ type: 'lowpass', f0: 3000, f1: 60, dur: 2.6, vol: 0.5 });
    },
    burst: function () { noise({ type: 'lowpass', f0: 5000, f1: 80, dur: 1.6, vol: 0.8 }); tone({ type: 'sine', f0: 90, f1: 25, dur: 1.4, vol: 0.8 }); },
    death: function () { tone({ type: 'sawtooth', f0: 300, f1: 40, dur: 1.1, vol: 0.35, lp: 1500, lp1: 200 }); noise({ f0: 800, f1: 100, dur: 0.9, vol: 0.35, q: 0.5 }); },
    victory: function () { [57, 64, 69, 73, 76, 81].forEach(function (m, i) { tone({ type: 'triangle', f0: mtof(m), dur: 2.6, vol: 0.13, attack: 0.05, when: ac.currentTime + i * 0.22, echo: true }); }); },
    thunder: function () { noise({ type: 'lowpass', f0: 500, f1: 50, dur: 1.8, vol: 0.5, attack: 0.03 }); },
    ui: function () { tone({ type: 'sine', f0: 660, f1: 880, dur: 0.12, vol: 0.1 }); }
  };

  function play(name) {
    if (!ac || muted) return;
    try { if (fx[name]) fx[name](); } catch (e) { /* audio must never break the game */ }
  }

  // --- music ------------------------------------------------------------------
  var AMB_CHORDS = [[45, 52, 60, 64, 71], [41, 48, 57, 60, 64], [38, 50, 57, 60, 65], [40, 47, 55, 59, 62]];
  var AMB_SCALE = [69, 72, 74, 76, 79, 81, 84];
  var BOSS_BASS = [38, 38, 50, 38, 41, 38, 45, 43, 38, 38, 50, 38, 46, 45, 41, 36];
  var BOSS_CHORDS = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];

  function pad(notes, t, dur, vol, dest, lp) {
    notes.forEach(function (m, i) {
      tone({ type: i % 2 ? 'sawtooth' : 'triangle', f0: mtof(m), dur: dur, vol: vol, attack: dur * 0.3, when: t, dest: dest, lp: lp || 700, detune: (i % 3 - 1) * 7 });
    });
  }

  function stepDur() { return mode === 'ambient' ? 0.5 : (mode === 'boss3' ? 60 / 158 / 2 : 60 / 134 / 2); }

  function scheduleStep(i, t) {
    var g = modeGain;
    if (mode === 'ambient') {
      if (i % 16 === 0) pad(AMB_CHORDS[(i / 16) % 4], t, 9.5, 0.05, g, 620);
      if (i % 16 === 0) tone({ type: 'sine', f0: mtof(AMB_CHORDS[(i / 16) % 4][0] - 12), dur: 8, vol: 0.16, attack: 2, when: t, dest: g });
      if (i % 2 === 0 && rnd() < 0.34) {
        var m = AMB_SCALE[Math.floor(rnd() * AMB_SCALE.length)];
        tone({ type: 'sine', f0: mtof(m), dur: 1.6, vol: 0.075, attack: 0.02, when: t, dest: g, echo: true });
        if (rnd() < 0.3) tone({ type: 'sine', f0: mtof(m + 7), dur: 1.2, vol: 0.035, when: t + 0.25, dest: g, echo: true });
      }
      if (i % 32 === 20) noise({ type: 'bandpass', f0: 400, f1: 900, q: 3, dur: 5, vol: 0.03, attack: 2.2, when: t, dest: g });
    } else {
      var p3 = mode === 'boss3', tr = p3 ? 2 : 0, sd = stepDur();
      var b = BOSS_BASS[i % 16] + tr;
      tone({ type: 'sawtooth', f0: mtof(b), dur: sd * 0.95, vol: 0.2, when: t, dest: g, lp: p3 ? 900 : 620, lp1: 200 });
      if (i % 4 === 0 || (p3 && i % 8 === 3)) { tone({ type: 'sine', f0: 140, f1: 38, dur: 0.22, vol: 0.55, when: t, dest: g }); }
      if (i % 2 === 1) noise({ type: 'highpass', f0: 7000, dur: 0.05, vol: 0.07, when: t, dest: g });
      if (i % 8 === 4) noise({ f0: 1700, q: 0.6, dur: 0.16, vol: p3 ? 0.22 : 0.13, when: t, dest: g });
      if (i % 16 === 0) pad(BOSS_CHORDS[(i / 16) % 4].map(function (n) { return n + tr; }), t, sd * 17, 0.045, g, 1100);
      if (i % 16 === 6 || i % 16 === 12 || (p3 && i % 16 === 9)) {
        var ch = BOSS_CHORDS[Math.floor(i / 16) % 4];
        tone({ type: 'square', f0: mtof(ch[(i >> 1) % 3] + 12 + tr), dur: sd * 2.5, vol: 0.06, when: t, dest: g, lp: 2200, echo: true });
      }
      if (p3) {
        var c3 = BOSS_CHORDS[Math.floor(i / 16) % 4];
        tone({ type: 'triangle', f0: mtof(c3[i % 3] + 24 + tr), dur: sd * 0.5, vol: 0.05, when: t, dest: g });
        tone({ type: 'triangle', f0: mtof(c3[(i + 1) % 3] + 24 + tr), dur: sd * 0.5, vol: 0.04, when: t + sd / 2, dest: g });
      }
    }
  }

  function setMusic(m) {
    if (m === mode) return;
    mode = m;
    if (!ac) return;
    if (modeGain) {
      var old = modeGain;
      old.gain.cancelScheduledValues(ac.currentTime);
      old.gain.setValueAtTime(old.gain.value, ac.currentTime);
      old.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.7);
      setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 1200);
      modeGain = null;
    }
    if (m === 'none') return;
    modeGain = ac.createGain();
    modeGain.gain.setValueAtTime(0.0001, ac.currentTime);
    modeGain.gain.linearRampToValueAtTime(1, ac.currentTime + (m === 'ambient' ? 2.5 : 0.3));
    modeGain.connect(musicBus);
    stepIdx = 0; nextTime = ac.currentTime + 0.08;
  }

  function update() {
    if (!ac || mode === 'none' || !modeGain) return;
    if (nextTime < ac.currentTime - 0.5) nextTime = ac.currentTime + 0.05; // tab was asleep
    var guard = 0;
    while (nextTime < ac.currentTime + 0.25 && guard++ < 16) {
      try { scheduleStep(stepIdx, nextTime); } catch (e) {}
      stepIdx++; nextTime += stepDur();
    }
  }

  function toggleMute() {
    muted = !muted;
    if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.03);
    return muted;
  }

  return { init: init, play: play, setMusic: setMusic, update: update, toggleMute: toggleMute, isMuted: function () { return muted; } };
})();
