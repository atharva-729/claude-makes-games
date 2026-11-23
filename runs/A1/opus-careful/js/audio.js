// GLOAMREACH - all music and sound effects, synthesized with WebAudio.
var Snd = (function () {
  var ac = null, master, musicBus, sfxBus, reverb, revSend, noiseBuf, comp;
  var muted = false;
  var track = 'none', wantTrack = 'none', intensity = 1;
  var nextTime = 0, step = 0, musicVol = 0;
  var chordIdx = 0;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
    reverb = ac.createConvolver(); reverb.buffer = makeImpulse(3.2, 2.6);
    revSend = ac.createGain(); revSend.gain.value = 0.55;
    revSend.connect(reverb); reverb.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextTime = ac.currentTime + 0.1;
  }

  function makeImpulse(sec, decay) {
    var len = Math.floor(ac.sampleRate * sec);
    var b = ac.createBuffer(2, len, ac.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = b.getChannelData(c);
      for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---------- building blocks ----------
  function env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur + rel);
  }
  function osc(type, freq, t, a, peak, dur, rel, dest, rev, freqEnd, detune) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + a + dur + rel);
    env(g, t, a, peak, dur, rel);
    o.connect(g); g.connect(dest || sfxBus);
    if (rev) { var s = ac.createGain(); s.gain.value = rev; g.connect(s); s.connect(revSend); }
    o.start(t); o.stop(t + a + dur + rel + 0.05);
    return o;
  }
  function noise(t, a, peak, dur, rel, ftype, f0, f1, q, dest, rev) {
    var s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = 1;
    var f = ac.createBiquadFilter(); f.type = ftype || 'bandpass';
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + dur + rel);
    f.Q.value = q || 1;
    var g = ac.createGain(); env(g, t, a, peak, dur, rel);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    if (rev) { var r = ac.createGain(); r.gain.value = rev; g.connect(r); r.connect(revSend); }
    s.start(t, Math.random() * 1.5); s.stop(t + a + dur + rel + 0.05);
  }
  function bell(m, t, vol, dest, rev) {
    var f = mtof(m);
    osc('sine', f, t, 0.005, vol, 0.02, 2.2, dest, rev);
    osc('sine', f * 2.01, t, 0.005, vol * 0.35, 0.01, 0.9, dest, rev);
    osc('triangle', f * 3.0, t, 0.002, vol * 0.12, 0.01, 0.35, dest, rev);
  }

  // ---------- sound effects ----------
  var S = {
    slash: function (t) { noise(t, 0.005, 0.5, 0.03, 0.1, 'bandpass', 4200, 900, 1.2); osc('triangle', 900, t, 0.002, 0.06, 0.02, 0.06, null, 0, 300); },
    hit: function (t) { osc('sine', 160, t, 0.002, 0.7, 0.02, 0.14, null, 0, 50); noise(t, 0.001, 0.5, 0.01, 0.07, 'highpass', 2500, 0, 0.7); osc('square', 1300, t, 0.001, 0.05, 0.01, 0.05, null, 0.2, 700); },
    clink: function (t) { osc('triangle', 2200, t, 0.001, 0.15, 0.01, 0.15, null, 0.3, 1800); noise(t, 0.001, 0.2, 0.01, 0.05, 'highpass', 5000); },
    kill: function (t) { noise(t, 0.002, 0.6, 0.05, 0.35, 'lowpass', 2500, 200, 1); osc('sawtooth', 420, t, 0.002, 0.15, 0.05, 0.3, null, 0.3, 60); bell(84, t + 0.02, 0.05, null, 0.5); },
    hurt: function (t) { osc('sawtooth', 180, t, 0.002, 0.45, 0.06, 0.3, null, 0.2, 40); noise(t, 0.002, 0.6, 0.05, 0.25, 'lowpass', 1800, 150); osc('sine', 1760, t, 0.002, 0.08, 0.05, 0.5, null, 0.6, 1600); },
    jump: function (t) { osc('sine', 300, t, 0.004, 0.12, 0.02, 0.08, null, 0, 520); noise(t, 0.003, 0.08, 0.01, 0.06, 'highpass', 2000); },
    land: function (t) { noise(t, 0.002, 0.18, 0.01, 0.08, 'lowpass', 600, 150); },
    dash: function (t) { noise(t, 0.005, 0.45, 0.06, 0.14, 'bandpass', 500, 3500, 1.4); osc('sine', 220, t, 0.004, 0.1, 0.05, 0.1, null, 0, 440); },
    wallJump: function (t) { osc('sine', 340, t, 0.004, 0.1, 0.02, 0.07, null, 0, 600); noise(t, 0.003, 0.12, 0.01, 0.05, 'bandpass', 1500); },
    healCharge: function (t) { osc('sine', mtof(62), t, 0.4, 0.06, 0.4, 0.3, null, 0.6, mtof(74)); },
    heal: function (t) { [74, 78, 81, 86].forEach(function (m, i) { bell(m, t + i * 0.06, 0.09, null, 0.7); }); },
    bolt: function (t) { osc('sawtooth', 1400, t, 0.002, 0.2, 0.04, 0.2, null, 0.3, 200); noise(t, 0.002, 0.35, 0.05, 0.15, 'bandpass', 3000, 600, 2); osc('sine', 90, t, 0.002, 0.3, 0.05, 0.15, null, 0, 40); },
    rest: function (t) { [62, 69, 74, 77, 81].forEach(function (m, i) { bell(m, t + i * 0.18, 0.11, null, 0.9); }); osc('sine', mtof(50), t, 0.8, 0.08, 1.2, 2, null, 0.8); },
    pickup: function (t) { [76, 83, 88, 91, 95].forEach(function (m, i) { bell(m, t + i * 0.07, 0.1, null, 0.8); }); },
    breakWall: function (t) { noise(t, 0.002, 0.8, 0.15, 0.6, 'lowpass', 1200, 100); osc('sine', 70, t, 0.002, 0.6, 0.1, 0.4, null, 0.3, 30); for (var i = 0; i < 5; i++) noise(t + 0.08 + i * 0.07, 0.001, 0.2, 0.01, 0.06, 'bandpass', 1500 + i * 300, 0, 3); },
    crumble: function (t) { noise(t, 0.002, 0.3, 0.02, 0.1, 'bandpass', 900, 400, 2); },
    gate: function (t) { osc('sine', 60, t, 0.002, 0.9, 0.1, 0.7, null, 0.5, 35); noise(t, 0.002, 0.6, 0.05, 0.5, 'lowpass', 900, 80); osc('square', 220, t, 0.002, 0.06, 0.05, 0.4, null, 0.5, 200); },
    spit: function (t) { osc('sine', 500, t, 0.003, 0.25, 0.02, 0.12, null, 0.2, 140); noise(t, 0.002, 0.2, 0.02, 0.08, 'lowpass', 1500, 300); },
    spitWind: function (t) { osc('sine', 120, t, 0.1, 0.15, 0.3, 0.15, null, 0.2, 260); },
    flyWind: function (t) { osc('sawtooth', 900, t, 0.05, 0.07, 0.2, 0.15, null, 0.3, 1900); osc('square', 1300, t, 0.05, 0.03, 0.2, 0.1, null, 0.3, 2400); },
    swoop: function (t) { noise(t, 0.02, 0.2, 0.15, 0.15, 'bandpass', 800, 2400, 2); },
    pop: function (t) { osc('sine', 700, t, 0.002, 0.15, 0.01, 0.08, null, 0.2, 200); },
    // boss
    windCharge: function (t) { osc('sawtooth', 55, t, 0.1, 0.35, 0.35, 0.2, null, 0.3, 110); noise(t, 0.05, 0.3, 0.4, 0.15, 'bandpass', 300, 900, 3); },
    windLeap: function (t) { osc('sawtooth', 70, t, 0.05, 0.3, 0.35, 0.15, null, 0.3, 40); osc('sine', 140, t, 0.05, 0.25, 0.35, 0.15, null, 0.3, 70); },
    windVolley: function (t) { [0, 4, 7, 11].forEach(function (k, i) { osc('triangle', mtof(70 + k), t + i * 0.08, 0.02, 0.08, 0.25, 0.25, null, 0.6); }); noise(t, 0.2, 0.15, 0.25, 0.1, 'highpass', 3000, 6000); },
    windDive: function (t) { osc('sine', 600, t, 0.05, 0.18, 0.35, 0.15, null, 0.4, 1800); osc('sawtooth', 80, t, 0.05, 0.2, 0.3, 0.15, null, 0.3, 60); },
    windSummon: function (t) { osc('sawtooth', 220, t, 0.1, 0.18, 0.4, 0.3, null, 0.6, 330); osc('sawtooth', 223, t, 0.1, 0.18, 0.4, 0.3, null, 0.6, 450); },
    diveLock: function (t) { osc('square', 1500, t, 0.002, 0.08, 0.05, 0.05, null, 0.3); osc('square', 1500, t + 0.15, 0.002, 0.08, 0.05, 0.05, null, 0.3); osc('square', 1500, t + 0.3, 0.002, 0.08, 0.05, 0.05, null, 0.3); },
    slam: function (t) { osc('sine', 80, t, 0.002, 1.0, 0.1, 0.6, null, 0.4, 28); noise(t, 0.002, 0.8, 0.08, 0.5, 'lowpass', 1400, 90); },
    thud: function (t) { osc('sine', 90, t, 0.002, 0.6, 0.05, 0.3, null, 0.3, 40); noise(t, 0.002, 0.4, 0.03, 0.2, 'lowpass', 800, 100); },
    debrisWarn: function (t) { for (var i = 0; i < 4; i++) noise(t + i * 0.1, 0.001, 0.12, 0.01, 0.05, 'bandpass', 2500 - i * 300, 0, 4); },
    roar: function (t) {
      [0, 7, 12.3, -12].forEach(function (k, i) {
        osc('sawtooth', mtof(38 + k), t, 0.15, 0.22, 0.9, 0.6, null, 0.6, mtof(31 + k), i * 7);
      });
      noise(t, 0.1, 0.5, 0.9, 0.6, 'bandpass', 700, 250, 1.5, null, 0.5);
    },
    bossHurt: function (t) { osc('sawtooth', 110, t, 0.002, 0.2, 0.04, 0.15, null, 0.2, 70); },
    bossDie: function (t) {
      [0, 5, 12, -12, 19].forEach(function (k, i) { osc('sawtooth', mtof(43 + k), t, 0.1, 0.18, 1.2, 1.5, null, 0.8, mtof(24 + k), i * 9); });
      noise(t, 0.05, 0.7, 1.2, 1.8, 'lowpass', 3000, 60, 1, null, 0.8);
    },
    victory: function (t) {
      [[62, 69, 74], [58, 65, 70, 74], [60, 67, 72, 76], [62, 69, 74, 78, 81]].forEach(function (ch, i) {
        ch.forEach(function (m) { osc('triangle', mtof(m), t + i * 0.9, 0.3, 0.05, 0.6, 1.4, null, 0.8); });
        bell(ch[ch.length - 1] + 12, t + i * 0.9, 0.08, null, 0.9);
      });
    },
    death: function (t) { osc('sine', 300, t, 0.002, 0.3, 0.2, 1.2, null, 0.8, 50); noise(t, 0.01, 0.4, 0.2, 1.0, 'lowpass', 2000, 80, 1, null, 0.6); },
    ui: function (t) { bell(81, t, 0.08, null, 0.5); }
  };

  function play(name) {
    if (!ac || muted) return;
    var f = S[name]; if (!f) return;
    try { f(ac.currentTime + 0.005); } catch (e) { /* ignore audio glitches */ }
  }

  // ---------- music ----------
  // Explore: slow pads in D minor, a low drone, sparse bell melody.
  var exploreChords = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 69], [43, 50, 55, 58, 65], [45, 52, 57, 61, 64]];
  var exploreScale = [62, 65, 67, 69, 72, 74, 77, 81];
  // Boss: phrygian ostinato.
  var bossBass = [38, 38, 50, 38, 39, 38, 36, 38, 38, 38, 50, 38, 41, 39, 36, 34];
  var bossArp = [74, 77, 81, 77, 75, 77, 74, 70, 74, 77, 82, 81, 77, 75, 74, 70];

  function pad(notes, t, dur, vol) {
    notes.forEach(function (m, i) {
      var f = mtof(m);
      var o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      o1.frequency.value = f; o2.frequency.value = f; o1.detune.value = -7 + i; o2.detune.value = 6;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(500, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 2.2); g.gain.setValueAtTime(vol, t + dur - 1.5); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicBus);
      var s = ac.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(revSend);
      o1.start(t); o2.start(t); o1.stop(t + dur + 1.6); o2.stop(t + dur + 1.6);
    });
  }

  function kick(t, v) { osc('sine', 150, t, 0.001, v, 0.02, 0.22, musicBus, 0, 40); }
  function snare(t, v) { noise(t, 0.001, v, 0.02, 0.14, 'bandpass', 1800, 900, 0.8, musicBus, 0.3); osc('triangle', 200, t, 0.001, v * 0.4, 0.01, 0.08, musicBus, 0, 120); }
  function hat(t, v) { noise(t, 0.001, v, 0.005, 0.04, 'highpass', 7000, 0, 1, musicBus); }
  function bassNote(m, t, d, v, grit) {
    var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(grit ? 1400 : 700, t); lp.frequency.exponentialRampToValueAtTime(160, t + d); lp.Q.value = grit ? 8 : 4;
    env(g, t, 0.005, v, d * 0.5, d * 0.5);
    o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(t); o.stop(t + d + 0.05);
  }

  function scheduleExplore(t) {
    var spb = 0.42; // seconds per step (8th note at ~71 bpm)
    var s = step % 16;
    if (s === 0) {
      var ch = exploreChords[chordIdx % exploreChords.length]; chordIdx++;
      pad(ch.slice(1), t, spb * 16, 0.028);
      osc('sine', mtof(ch[0] - 12), t, 2.5, 0.12, spb * 16 - 2.5, 2.5, musicBus, 0.2);
    }
    if ((s % 2 === 0) && Math.random() < 0.32) {
      var m = exploreScale[Math.floor(Math.random() * exploreScale.length)];
      bell(m, t, 0.05, musicBus, 0.9);
      if (Math.random() < 0.3) bell(m - 5, t + spb, 0.03, musicBus, 0.9);
    }
    if (s === 8 && Math.random() < 0.5) noise(t, 1.5, 0.025, 1.0, 2.0, 'bandpass', 400, 1200, 6, musicBus, 0.8); // wind
    return spb;
  }

  function scheduleBoss(t) {
    var spb = intensity >= 3 ? 0.092 : intensity === 2 ? 0.1 : 0.107;
    var s = step % 16, bar = Math.floor(step / 16);
    var kpat = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0];
    if (kpat[s]) kick(t, 0.75);
    if (s === 4 || s === 12) snare(t, 0.35);
    if (intensity >= 3 ? true : s % 2 === 0) hat(t, s % 4 === 2 ? 0.12 : 0.06);
    var shift = (bar % 4 === 3) ? -2 : 0;
    bassNote(bossBass[s] + shift, t, spb * 0.95, 0.24, intensity >= 3);
    if (s === 0) {
      var root = 50 + shift;
      [root, root + 3, root + 7, root + 10].forEach(function (m) { osc('sawtooth', mtof(m), t, 0.3, 0.018, spb * 12, 0.6, musicBus, 0.5, 0, Math.random() * 10 - 5); });
    }
    if (intensity >= 2) osc('square', mtof(bossArp[s] + shift), t, 0.003, 0.03, spb * 0.4, 0.1, musicBus, 0.4);
    if (intensity >= 3) {
      if (s % 4 === 0) osc('sawtooth', mtof(bossArp[(s + 8) % 16] + 12 + shift), t, 0.01, 0.025, spb * 1.5, 0.2, musicBus, 0.5);
      if (s === 14) snare(t, 0.2);
      if (s === 15) snare(t, 0.25);
    }
    return spb;
  }

  function update() {
    if (!ac) return;
    // crossfade on track change
    var target = (track === 'none' ? 0 : (track === 'boss' ? 0.75 : 0.6));
    if (wantTrack !== track) {
      musicVol -= 0.02;
      if (musicVol <= 0) { musicVol = 0; track = wantTrack; step = 0; nextTime = ac.currentTime + 0.1; }
    } else {
      musicVol += (target - musicVol) * 0.03;
    }
    musicBus.gain.value = Math.max(0, musicVol);
    if (track === 'none') return;
    if (nextTime < ac.currentTime - 0.5) nextTime = ac.currentTime + 0.05; // tab was hidden
    while (nextTime < ac.currentTime + 0.3) {
      var d = track === 'boss' ? scheduleBoss(nextTime) : scheduleExplore(nextTime);
      nextTime += d; step++;
    }
  }

  return {
    init: init,
    play: play,
    update: update,
    music: function (name) { wantTrack = name; },
    stopMusicNow: function () { wantTrack = 'none'; track = 'none'; musicVol = 0; if (musicBus) musicBus.gain.value = 0; },
    setIntensity: function (n) { intensity = n; },
    toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
    isMuted: function () { return muted; },
    ready: function () { return !!ac; }
  };
})();
