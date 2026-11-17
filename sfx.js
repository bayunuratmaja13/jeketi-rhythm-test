// ============================================================
//  JEKETI RHYTHM — sfx.js  (UI sounds for cards and points)
//  Uses the AudioContext from game.js (ensureAudio / audioCtx)
// ============================================================
(() => {
  'use strict';
  const C = () => { ensureAudio(); return audioCtx; };

  let noiseBuf = null;
  function noise(c) {
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
      const n = (c.sampleRate * 0.4) | 0;
      noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // one oscillator note: type, start freq, end freq, delay (s), length (s), volume
  function tone(type, f0, f1, at, dur, vol) {
    const c = C(), t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // filtered noise burst (dur must stay under 0.18s)
  function hiss(at, dur, vol, type, f0, f1) {
    const c = C(), t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = type === 'bandpass' ? 1.2 : 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t, Math.random() * 0.2, dur + 0.02);
  }

  // a cluster of tiny clicks = crinkling plastic / mylar
  function crackle(at, n, span, vol) {
    for (let i = 0; i < n; i++) {
      hiss(at + Math.random() * span, 0.025 + Math.random() * 0.02, vol * (0.5 + Math.random() * 0.5), 'highpass', 2500 + Math.random() * 4500);
    }
  }

  // a long swelling note (volume rises with the pitch): for charge-ups
  function swell(type, f0, f1, dur, vol, at = 0) {
    const c = C(), t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.96);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.06);
  }
  // long rising wash of filtered noise
  function wash(dur, vol, f0, f1) {
    const c = C(), t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = noise(c);
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.96);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
    s.stop(t + dur + 0.08);
  }

  const NOTES = [880, 1109, 1319, 1760, 2217];   // pentatonic climb, one more note per tier

  const SFX = {
    // mouse moves over a card
    hover() { tone('triangle', 2400, 2000, 0, 0.02, 0.025); },

    // opening a card you own: thump + click, then a chime that gets richer with the tier (0 = C ... 4 = SS)
    cardTap(tier = 0) {
      tone('sine', 230, 80, 0, 0.14, 0.28);
      tone('triangle', 1900, 1000, 0, 0.035, 0.1);
      hiss(0, 0.03, 0.08, 'highpass', 4000);
      for (let k = 0; k <= Math.min(tier, 4); k++) {
        tone('sine', NOTES[k], NOTES[k], 0.05 + k * 0.055, 0.5, 0.1);
        tone('triangle', NOTES[k] * 2, NOTES[k] * 2, 0.05 + k * 0.055, 0.25, 0.03);
      }
      if (tier >= 3) {                              // S and SS get a sparkle on top
        for (let j = 0; j < 3; j++) tone('sine', 3800 + j * 500, 3800 + j * 500, 0.22 + j * 0.05, 0.25, 0.05);
        hiss(0.2, 0.15, 0.05, 'highpass', 6000);
      }
    },

    // card flips over
    flip() {
      hiss(0, 0.17, 0.12, 'bandpass', 500, 3200);
      tone('triangle', 1300, 800, 0.17, 0.03, 0.08);
    },

    // tapping a locked card
    locked() {
      tone('triangle', 210, 120, 0, 0.15, 0.25);
      tone('triangle', 170, 95, 0.09, 0.17, 0.22);
      tone('square', 90, 70, 0, 0.1, 0.04);
    },

    // viewer closes
    close() { tone('triangle', 760, 430, 0, 0.09, 0.1); },

    // pack lands on the table: deep thump + paper slap
    thump() {
      tone('sine', 150, 42, 0, 0.32, 0.38);
      tone('triangle', 90, 50, 0, 0.2, 0.15);
      hiss(0, 0.12, 0.1, 'lowpass', 900, 300);
    },

    // pack rattles (i = 0..3): crinkly plastic that gets louder and higher each time
    shake(i = 0) {
      crackle(0, 5 + i * 2, 0.13, 0.09 + i * 0.03);
      hiss(0, 0.13, 0.05 + i * 0.02, 'bandpass', 3200 + i * 500, 5000 + i * 600);
      tone('triangle', 180 + i * 70, 230 + i * 90, 0, 0.12, 0.04 + i * 0.015);
    },

    // one little plastic tear tick while the pack is being pulled (p = 0..1, higher and louder)
    tear(p = 0) {
      crackle(0, 4, 0.07, 0.1 + p * 0.1);
      hiss(0, 0.08, 0.05 + p * 0.06, 'bandpass', 3500 + p * 3000, 5000 + p * 3000);
    },

    // the plastic finally cracks open: sharp crackle, an air-release whump, a boom, a rising sparkle run
    rip() {
      crackle(0, 16, 0.17, 0.3);
      hiss(0, 0.17, 0.24, 'highpass', 1500, 9000);
      hiss(0.04, 0.15, 0.2, 'lowpass', 1800, 300);
      tone('sine', 130, 36, 0, 0.5, 0.5);
      tone('sine', 65, 30, 0, 0.55, 0.3);
      tone('triangle', 420, 90, 0.02, 0.2, 0.16);
      [1047, 1319, 1568, 2093, 2637, 3136, 3520].forEach((f, k) => {
        tone('sine', f, f, 0.1 + k * 0.045, 0.5, 0.08);
        tone('triangle', f * 2, f * 2, 0.1 + k * 0.045, 0.22, 0.025);
      });
      hiss(0.1, 0.17, 0.08, 'highpass', 7000);
    },

    // cards slide up out of the pack
    whoosh() {
      hiss(0, 0.17, 0.14, 'bandpass', 300, 2800);
      tone('sine', 280, 900, 0, 0.25, 0.07);
    },

    // a card is revealed (i = how many cards in so far, tier = 0..4): impact + chord that climbs with every card
    pull(i = 0, tier = 0) {
      const L = [523, 587, 659, 784, 880, 1047, 1175], f = L[Math.min(i, L.length - 1)];
      tone('sine', 120, 42, 0, 0.26, 0.38);
      hiss(0, 0.05, 0.1, 'highpass', 4500);
      tone('triangle', f, f, 0.02, 0.5, 0.13);
      tone('sine', f * 1.5, f * 1.5, 0.04, 0.45, 0.08);
      tone('sine', f * 2, f * 2, 0.06, 0.4, 0.07);
      for (let j = 0; j < 3 + tier; j++) tone('sine', 2400 + j * 420 + i * 60, 2400 + j * 420 + i * 60, 0.08 + j * 0.045, 0.22, 0.04);
      if (tier >= 3) { tone('sine', f * 3, f * 3, 0.1, 0.6, 0.08); hiss(0.1, 0.17, 0.07, 'highpass', 6000); }
    },

    // the NEW stamp slams down
    slam() {
      tone('sine', 220, 50, 0, 0.2, 0.42);
      tone('square', 130, 60, 0, 0.05, 0.05);
      hiss(0, 0.07, 0.16, 'lowpass', 1600, 300);
    },

    // confetti cannon
    pop() {
      tone('triangle', 900, 260, 0, 0.07, 0.18);
      hiss(0, 0.1, 0.12, 'bandpass', 2500, 6000);
    },

    // card sent to its slot: whoosh + soft tap
    deal() {
      hiss(0, 0.12, 0.1, 'bandpass', 900, 2600);
      tone('triangle', 520, 300, 0.1, 0.06, 0.1);
      tone('sine', 160, 90, 0.1, 0.09, 0.12);
    },

    // all cards collected: bright arpeggio into a held chord
    fanfare() {
      [523, 659, 784, 1047, 1319].forEach((f, k) => {
        tone('triangle', f, f, k * 0.09, 0.35, 0.12);
        tone('sine', f * 2, f * 2, k * 0.09, 0.3, 0.04);
      });
      [523, 659, 784, 1047].forEach(f => tone('sine', f, f, 0.5, 1.1, 0.07));
      for (let j = 0; j < 4; j++) tone('sine', 3000 + j * 500, 3000 + j * 500, 0.5 + j * 0.07, 0.3, 0.04);
      hiss(0.5, 0.16, 0.06, 'highpass', 6000);
      [0, 0.18, 0.36].forEach(d => { tone('triangle', 900, 260, d, 0.07, 0.16); hiss(d, 0.1, 0.1, 'bandpass', 2500, 6000); });
    },

    // combining cards: a power-up that swells for `dur` seconds (T = tier being made, 1 B .. 4 SS), bigger every tier
    mergeCharge(dur = 1.2, T = 1) {
      swell('sine', 45, 90, dur, 0.16);
      swell('sawtooth', 90, 90 * (6 + T * 2), dur, 0.04 + T * 0.012);
      swell('sine', 180, 180 * (6 + T * 2), dur, 0.1);
      swell('triangle', 360, 360 * (4 + T), dur, 0.06);
      wash(dur, 0.1 + T * 0.03, 300, 4000 + T * 1500);
      const N = 10 + T * 8;
      for (let k = 0; k < N; k++) {
        const at = dur * Math.pow(k / N, 1.7), f = 900 + k * (40 + T * 12);
        tone('sine', f, f * 1.15, at, 0.05, 0.05 + 0.03 * (k / N));
      }
      if (T >= 2) {
        const P = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];
        const M = 6 + T * 2;
        for (let k = 0; k < M; k++) tone('triangle', P[Math.min(k, P.length - 1)], P[Math.min(k, P.length - 1)], dur * (0.3 + 0.65 * Math.pow(k / M, 1.2)), 0.25, 0.05);
      }
      if (T >= 3) {
        swell('sine', 196, 392 * (1 + T * 0.25), dur, 0.06);
        swell('sine', 198.5, 396 * (1 + T * 0.25), dur, 0.06);
        swell('sine', 294, 588 * (1 + T * 0.25), dur, 0.04);
      }
      if (T >= 4) swell('square', 55, 330, dur, 0.03);
    },

    // the merge explodes: sub drop, crack, a chord that gets bigger with every tier, sparkle shower
    mergeBoom(T = 1) {
      tone('sine', 150, 28, 0, 0.6 + T * 0.15, 0.5 + T * 0.05);
      tone('sine', 70, 24, 0, 0.9 + T * 0.2, 0.35);
      tone('triangle', 520, 70, 0, 0.25, 0.2);
      hiss(0, 0.17, 0.3, 'highpass', 1500, 9000);
      hiss(0.03, 0.16, 0.25, 'lowpass', 2200, 200);
      crackle(0, 12 + T * 4, 0.17, 0.25);
      const chords = [[], [523, 659, 784], [523, 659, 784, 1047], [523, 659, 784, 1047, 1319], [523, 659, 784, 1047, 1319, 1568]];
      chords[T].forEach((f, k) => {
        tone('triangle', f, f, 0.02 + k * 0.03, 0.9 + T * 0.25, 0.1);
        tone('sine', f * 2, f * 2, 0.02 + k * 0.03, 0.6, 0.04);
      });
      const n = 5 + T * 3;
      for (let j = 0; j < n; j++) { const f = 1800 + j * 260 + Math.random() * 60; tone('sine', f, f, 0.1 + j * 0.04, 0.3, 0.04); }
      if (T >= 2) hiss(0.1, 0.17, 0.08, 'highpass', 7000);
      if (T >= 3) {
        [392, 494, 587, 784].forEach(f => tone('sine', f, f, 0.05, 1.8, 0.08));
        crackle(0.05, 24, 0.17, 0.3);
        [0, 0.18, 0.34].forEach(d => { tone('triangle', 900, 260, d + 0.1, 0.07, 0.16); hiss(d + 0.1, 0.1, 0.1, 'bandpass', 2500, 6000); });
      }
      if (T >= 4) {
        [1047, 1319, 1568, 2093, 2637, 3136, 3951, 4186].forEach((f, k) => {
          tone('sine', f, f, 0.35 + k * 0.07, 0.9, 0.07);
          tone('triangle', f * 2, f * 2, 0.35 + k * 0.07, 0.3, 0.02);
        });
        [523, 659, 784, 1047].forEach(f => tone('sine', f, f, 0.3, 2.6, 0.07));
        tone('sine', 65, 30, 0.25, 1.4, 0.3);
        hiss(0.25, 0.17, 0.12, 'highpass', 6000);
      }
    },

    // rising tick while Points count up (n = 1, 2, 3 ...)
    tick(n = 1) {
      const f = 900 + n * 70;
      tone('sine', f, f * 1.2, 0, 0.04, 0.08);
    },

    // cha-ching when the count finishes
    coin() {
      tone('sine', 1319, 1319, 0, 0.35, 0.14);
      tone('triangle', 2637, 2637, 0, 0.25, 0.06);
      tone('sine', 1760, 1760, 0.09, 0.6, 0.15);
      tone('triangle', 3520, 3520, 0.09, 0.4, 0.06);
      hiss(0.09, 0.15, 0.05, 'highpass', 7000);
    },
  };

  // never let a blocked / missing audio context break the game
  window.SFX = new Proxy(SFX, {
    get: (o, k) => (...a) => { try { o[k](...a); } catch (e) { /* audio unavailable */ } },
  });
})();