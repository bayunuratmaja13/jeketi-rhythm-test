// ============================================================
//  JEKETI RHYTHM — game.js
//  v2: smoother clock, cheaper rendering, juicier feedback
// ============================================================

// ---------- VIEWPORT ----------
if (window.__applyViewport) window.__applyViewport();

// ---------- SMALL HELPERS ----------
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const HAS_TRANSLATE = !!(window.CSS && CSS.supports && CSS.supports('translate', '0 0'));

function mk(tag, id, parent) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  (parent || document.body).appendChild(el);
  return el;
}

// ---------- ELEMENTS ----------
const game = document.getElementById('game');
const mainMenuScreen = document.getElementById('main-menu-screen');
const menuScreen = document.getElementById('menu-screen');
const songGrid = document.getElementById('song-grid');
const playBtn = document.getElementById('play-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');

const music = document.getElementById('music');
music.preload = 'auto';
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const judgementEl = document.getElementById('judgement');

// Playfield is ONE canvas now (was 4 tilted DOM lanes with glowing notes = very heavy on phones)
const playfieldEl = document.getElementById('playfield');
const fieldBgCv = document.getElementById('field-bg');   // static: lanes, rails (drawn only on resize)
const fieldCv = document.getElementById('field');        // dynamic: notes, receptors, effects (every frame)
const bgCtx = fieldBgCv.getContext('2d');
const ctx = fieldCv.getContext('2d');
const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

const screenFlash = mk('div', 'screen-flash');
const missFlash = mk('div', 'miss-flash');
const tierGlow = mk('div', 'tier-glow');
const beatPulse = mk('div', 'beat-pulse');

// Combo: number + label
comboEl.innerHTML = '<span class="combo-num"></span><span class="combo-label">COMBO</span>';
comboEl.className = 'off';
const comboNumEl = comboEl.querySelector('.combo-num');

// Early / late indicator
const timingEl = mk('div', 'timing');

// Tier-up banner
const tierBanner = mk('div', 'tier-banner');
tierBanner.innerHTML = '<div class="tb-title"></div><div class="tb-sub"></div>';
const tbTitle = tierBanner.querySelector('.tb-title');
const tbSub = tierBanner.querySelector('.tb-sub');

// Resume countdown
const countdownEl = mk('div', 'countdown');

// Life gauge (how close you are to game over)
const lifeEl = mk('div', 'life');
lifeEl.innerHTML = '<div id="life-fill"></div>';
const lifeFill = lifeEl.querySelector('#life-fill');

// ---------- STATUS ----------
const status = document.createElement('div');
status.style.cssText =
  'position:fixed;bottom:8px;right:8px;color:#0f0;font-family:monospace;' +
  'font-size:10px;z-index:999;white-space:pre;background:rgba(0,0,0,0.7);' +
  'padding:4px 8px;border-radius:6px;line-height:1.4;display:none;';
document.body.appendChild(status);
function setStatus(t) { status.textContent = t; }

// ---------- PAUSE BUTTON ----------
const pauseBtn = document.createElement('button');
pauseBtn.id = 'pause-btn';
pauseBtn.textContent = '❚❚';
pauseBtn.setAttribute('aria-label', 'Pause');
document.body.appendChild(pauseBtn);

// ---------- PAUSE OVERLAY ----------
const pauseOverlay = document.createElement('div');
pauseOverlay.id = 'pause-overlay';
pauseOverlay.innerHTML = `
  <div class="pause-card">
    <div class="tape-top"></div>
    <div class="pause-title">PAUSED</div>
    <div class="eq-strip"></div>
    <div class="pause-buttons">
      <button id="btn-resume" class="pause-btn-text pb-resume">RESUME</button>
      <div class="pause-row">
        <button id="btn-restart" class="pause-btn-text pb-restart">RESTART</button>
        <button id="btn-quit" class="pause-btn-text pb-exit">EXIT</button>
      </div>
    </div>
  </div>
`;
document.body.appendChild(pauseOverlay);
const btnResume = document.getElementById('btn-resume');
const btnQuit = document.getElementById('btn-quit');
const btnRestart = document.getElementById('btn-restart');

// ---------- GAME OVER ----------
const gameOver = document.createElement('div');
gameOver.id = 'game-over';
gameOver.innerHTML = `
  <div class="gameover-card">
    <div class="tape-top"></div>
    <div class="gameover-cover" id="go-cover"></div>
    <div class="gameover-song" id="go-song"></div>
    <div class="gameover-title"><img src="images/game-over.gif" class="title-img" alt="GAME OVER"></div>
    <div class="gameover-stats">
      <div class="gameover-stat">
        <div class="results-label">Score</div>
        <div class="gameover-value" id="go-score">0</div>
      </div>
      <div class="gameover-stat">
        <div class="results-label">Most Combo</div>
        <div class="gameover-value combo-value" id="go-combo">0</div>
      </div>
    </div>
    <div class="gameover-buttons">
      <button id="btn-go-play-again" class="gif-btn"><img src="images/play-again.gif" class="btn-gif" alt="Play Again"></button>
      <button id="btn-go-back" class="gif-btn"><img src="images/exit.gif" class="btn-gif" alt="Exit"></button>
    </div>
  </div>
`;
document.body.appendChild(gameOver);
const goScoreEl = document.getElementById('go-score');
const goComboEl = document.getElementById('go-combo');
const goSongEl = document.getElementById('go-song');
const goCoverEl = document.getElementById('go-cover');
const btnGoPlayAgain = document.getElementById('btn-go-play-again');
const btnGoBack = document.getElementById('btn-go-back');

// ---------- CONSTANTS ----------
const APPROACH_TIME = 2000;
const HIT_WINDOWS = { PERFECT: 40, GREAT: 80, GOOD: 130, BAD: 200 };
const MAX_WINDOW = HIT_WINDOWS.BAD;
const KEY_TO_LANE = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const HOLD_GRACE = 100;
const HOLD_TICK_INTERVAL = 100;
const HOLD_TICK_POINTS = 15;
const SPAWN_LEAD = 150;               // ms before the approach starts that a note's element is created

const TIER_STEPS = [50, 100, 200, 480]; // combo needed for tier 1..4 (also the milestone moments)
const COMBO_SHOW_FROM = 10;           // combo counter appears from here

const JUDGE = {
  PERFECT: { name: 'PERFECT', points: 100, color: '#ffcc00', beam: '#ffcc33', kick: 0.35 },
  GREAT:   { name: 'GREAT',   points: 70,  color: '#5dbcf2', beam: '#4da8ff', kick: 0.25 },
  GOOD:    { name: 'GOOD',    points: 40,  color: '#3cb54a', beam: '#66d9a8', kick: 0.15 },
  BAD:     { name: 'BAD',     points: 0,   color: '#e6212a', beam: '#ff5252', kick: 0 },
};
const ACC_WEIGHTS = { PERFECT: 1, GREAT: 0.8, GOOD: 0.5, BAD: 0, MISS: 0 };
const GRADE_RANK = { C: 1, B: 2, A: 3, S: 4, SS: 5 };

// ---------- SCORE SCALE & GRADES ----------
// Every song is scaled so a PERFECT run with no cards = BASE_MAX_SCORE, so long and short songs are equally fair.
// Cards then multiply it (see TIER_BONUS in shop.js), so reaching S (1,000,000) takes roughly 10 S cards plus a clean full combo.
// NOTE: the best possible run (12 SS cards, oshi, every member in the song, perfect) is about 1,475,000; SS needs 1,400,000.
const BASE_MAX_SCORE = 500000;
// a grade needs BOTH its minimum score and its minimum accuracy (checked from the top down)
const GRADE_RULES = [
  { g: 'SS', score: 1400000, acc: 0.93 },
  { g: 'S',  score: 1000000, acc: 0.90 },
  { g: 'A',  score: 750000,  acc: 0.85 },
  { g: 'B',  score: 450000,  acc: 0.75 },
];

const SHAKE_SCALE = reduceMotion ? 0 : 0.5;  // overall shake strength (subtle)
const SHAKE_MAX = 1.6;                        // px cap
const COUNTDOWN_STEP = 800;                   // ms per number on resume
const STORE_PREFIX = 'jeketi.best.';

// ---------- STATE ----------
let mode = 'idle'; // idle | starting | playing | paused | countdown | resuming | gameover
let currentSong = null;
let selectedSong = null;
let currentChart = [];

let queue = [];                       // all notes of the song, sorted by time
let spawnIdx = 0;                     // next note to create an element for
let active = [];                      // notes that currently have an element on screen
let laneQueues = [[], [], [], []];    // per-lane notes, sorted by time
let laneHead = [0, 0, 0, 0];

let score = 0, combo = 0, maxCombo = 0, displayScore = 0;
let stats = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
let judgedCount = 0;
let missCount = 0;
let missLimit = 20;
let scoreMult = 1;                    // card bonus for this run (1 = none)
let scoreNorm = 1;                    // per-song scale (BASE_MAX_SCORE / the song's perfect-run total)
let scoreExact = 0;                   // un-rounded running total, so rounding never drifts
function addScore(points) { scoreExact += points * scoreMult * scoreNorm; score = Math.round(scoreExact); }
// what a flawless run of this chart is worth before scaling: head 100 per note, plus hold ticks and the hold bonus
function perfectRunTotal() {
  let t = 0;
  for (const n of queue) t += n.dur > 0 ? 100 + Math.floor(n.dur / HOLD_TICK_INTERVAL) * HOLD_TICK_POINTS + 50 : 100;
  return t;
}

let useAudio = false, wallStart = 0, wallOffset = 0, pauseStartWall = 0;
let frozenTime = 0;
let playToken = 0;
let introShow = false;                // true during the 3-2-1 before a song: draw the notes without moving them

// interpolated audio clock
let anchorAudio = 0, anchorPerf = 0, lastAudioRaw = -1;
let smoothT = 0, smoothPerf = 0;

let countdownEnd = 0, lastCountdownNum = 0;
let audioCtx = null;
let loopRunning = false;
let lastFrameT = 0;
let lastScorePulse = 0;
let kick = 0;                         // hit-driven pulse for the background glow
let lastBeatOpacity = -1;

// adaptive quality
let songFx = null;                    // per-song gameplay effect (see SONG_FX); replaces the sakura petals while active
let lowFx = false, frameEma = 16.7, perfBad = 0, perfGood = 0;
let lowLock = false, lowFlips = 0;    // after two relapses in one run, low-fx stays on until the run ends (no flip-flopping)
// weak phones (little RAM / few cores) start their first run already in light mode; it can still switch back if the phone copes
const WEAK_DEVICE = COARSE && ((navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));
let weakTried = false;
let shownScoreInt = -1;
let judgeAnim = null, timingAnim = null, bannerAnim = null;   // kept so a new one can cancel the old one without getAnimations() (which forces a style recalculation)
let lastPopScore = 0, lastPopCombo = 0, lastBuzz = 0;
let accFx = 0, accBeat = 0;                                  // ambient effects run at ~30 fps, one per frame (staggered)
const NUM_FMT = new Intl.NumberFormat();                     // same output as toLocaleString(), but built once
function buzz(ms) {                                          // phone vibration is an IPC call: at most once per 80 ms
  if (!navigator.vibrate) return;
  const t = performance.now();
  if (t - lastBuzz < 80) return;
  lastBuzz = t;
  navigator.vibrate(ms);
}
let spikeUntil = 0;                   // after a sudden long frame (phone notification, system pop-up): effects stay light until this time
const SPIKE_FRAME_MS = 50, SPIKE_LIGHT_MS = 2000;
// TWO quality levels:
//   NORMAL = what "light mode" used to be, now always on (no beat glow / beams / shake, few particles, 1x playfield).
//   LITE   = new, even lighter, adaptive (kicks in when the frame rate drops, or right after a long frame):
//            no particles / rings / hit-flash / tier glow, no petals, flat hold bodies, slower ambience, playfield below 1x.
const LITE_DPR = 0.75;                 // playfield resolution in lite mode (normal = 1x)
function fxLight() { return true; }    // kept so every old call site still reads the same: normal IS the old light mode
function fxLite() { return lowFx || performance.now() < spikeUntil; }

// start-up smoothness
const CLOCK_SNAP_MS = 400;             // song clock only JUMPS to the audio when they differ by more than this (was 120: a weak phone's audio start-up often wobbles more than that)
const CLOCK_MAX_SLEW = 0.12;           // below that it catches up gradually: notes never run more than 12% faster / slower than real time
const WARMUP_MS = 2000;                // first seconds of a song: audio start-up jank alone must not flip the quality mode mid-song
let playBeganAt = 0, introFrames = 0;

// add ?debug to the game's address to see a small clock / frame readout in the bottom-left corner (for finding stutter)
const DBG = /[?&]debug\b/.test(location.search);
const dbg = { snaps: 0, maxErr: 0, long: 0, worst: 0, last: 0 };
const dbgEl = document.createElement('div');
dbgEl.style.cssText = 'position:fixed;bottom:8px;left:8px;color:#0f0;font:10px/1.4 monospace;z-index:999;white-space:pre;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:6px;pointer-events:none;display:' + (DBG ? 'block' : 'none') + ';';
document.body.appendChild(dbgEl);
function dbgReset() { dbg.snaps = 0; dbg.maxErr = 0; dbg.long = 0; dbg.worst = 0; dbg.last = 0; }
function dbgTick(dt) {
  if (performance.now() - playBeganAt < 10000) { if (dt > 33) dbg.long++; if (dt > dbg.worst) dbg.worst = dt; }
  const t = performance.now();
  if (t - dbg.last < 400) return;
  dbg.last = t;
  dbgEl.textContent = 'first 10 s of the song\nclock jumps: ' + dbg.snaps + '   worst clock error: ' + Math.round(dbg.maxErr) + ' ms\nslow frames (>33 ms): ' + dbg.long + '   worst: ' + Math.round(dbg.worst) + ' ms\nmode: ' + (lowFx ? 'lite' : 'normal');
}

const hitBarTimers = [null, null, null, null];
const laneFlashTimers = [null, null, null, null];
const pressedLanes = new Set();
const activeTouches = new Map();

// ---------- CLOCK ----------
function resetClock() {
  const raw = music.currentTime * 1000;
  lastAudioRaw = raw;
  anchorAudio = raw;
  anchorPerf = performance.now();
  smoothT = raw;
  smoothPerf = anchorPerf;
}

// Audio currentTime updates in coarse steps on many browsers, which makes notes judder.
// We keep a smooth clock that advances with performance.now() and gently follows the audio.
function getSongTime() {
  if (mode === 'paused' || mode === 'countdown' || mode === 'resuming') return frozenTime;
  if (!useAudio) return performance.now() - wallStart - wallOffset;

  const p = performance.now();
  const raw = music.currentTime * 1000;
  if (raw !== lastAudioRaw) {
    lastAudioRaw = raw;
    anchorAudio = raw;
    anchorPerf = p;
  }
  const est = anchorAudio + (p - anchorPerf);
  if (p !== smoothPerf) {
    const dt = p - smoothPerf;
    let t = smoothT + dt;
    const err = est - t;
    if (DBG && performance.now() - playBeganAt < 10000 && Math.abs(err) > dbg.maxErr) dbg.maxErr = Math.abs(err);
    if (Math.abs(err) > CLOCK_SNAP_MS) { t = est; if (DBG) dbg.snaps++; }
    else {
      const corr = err * 0.1 * Math.min(1, dt / 16.7), lim = dt * CLOCK_MAX_SLEW;
      t += corr > lim ? lim : corr < -lim ? -lim : corr;
    }
    smoothT = t;
    smoothPerf = p;
  }
  return smoothT;
}

function startUpdateLoop() {
  if (loopRunning) return;
  loopRunning = true;
  requestAnimationFrame(update);
}

function measureLane() { layoutField(); if (songFx && songFx.resize) songFx.resize(); }
if ('ResizeObserver' in window) new ResizeObserver(measureLane).observe(playfieldEl);
window.addEventListener('resize', measureLane);

// ---------- SAVED BESTS ----------
function loadBest(id) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + id);
    const o = raw ? JSON.parse(raw) : null;
    if (o && o.run) { o.score = o.run.score; o.combo = o.run.combo; o.acc = o.run.acc; o.grade = o.run.grade; o.fc = !!o.run.fc; }   // older saves mixed bests from different runs
    return o;
  } catch (e) { return null; }
}
function saveBest(id, obj) {
  try { localStorage.setItem(STORE_PREFIX + id, JSON.stringify(obj)); } catch (e) { /* storage blocked */ }
}

// ---------- SONG PREVIEW (song select) ----------
let previewAudio = null, previewTimer = null, previewToken = 0;

function stopPreview() {
  previewToken++;
  clearInterval(previewTimer);
  previewTimer = null;
  if (previewAudio) { try { previewAudio.pause(); } catch (e) { /* ignore */ } }
}

// while the new-player intro (oshi picker + starter pack) is on screen, no preview music
let holdPreview = false;
function setPreviewHold(v) {
  holdPreview = !!v;
  if (!v && mode === 'idle' && selectedSong && menuScreen.style.display !== 'none' && !document.getElementById('pack-overlay')) startPreview(selectedSong);
}

// A song can have a short dedicated preview clip:   previewAudio: 'music/previews/ayo_senyumlah.mp3'
// (about 15 s, mono, 64-96 kbps = roughly 100-200 KB). Without it the preview uses the full song as before.
const previewUrlOf = (song) => song.previewAudio || song.audio;
const absUrl = (u) => new URL(u, document.baseURI).href;

function ensurePreviewAudio() {
  if (!previewAudio) { previewAudio = new Audio(); previewAudio.preload = 'auto'; }
  return previewAudio;
}

// Start downloading a song's preview BEFORE the player gets to the carousel (title screen, oshi picker, starter pack).
// - the preview element is pointed at the file, so Android / desktop browsers already have the start of it buffered
// - a short clip is also fetched completely into the browser cache (iPhones ignore preload, this is what helps them)
const warmedPreviews = new Set();
function warmPreview(song) {
  if (!song || !song.audio || song.preview === false) return;
  const url = previewUrlOf(song);
  if (warmedPreviews.has(url)) return;
  warmedPreviews.add(url);
  try {
    const a = ensurePreviewAudio();
    if (!a.src) a.src = url;
    if (song.previewAudio) fetch(absUrl(url)).then(r => r.arrayBuffer()).catch(() => {});
  } catch (e) { /* ignore */ }
}

// iPhone / Safari only lets an audio element play by itself after it has been played once from a tap.
// Called from the PLAY tap: plays the preview element silently for a moment so later previews are allowed.
let previewUnlocked = false;
function unlockPreview() {
  if (previewUnlocked) return;
  const song = window.SONGS && window.SONGS[0];
  if (!song || !song.audio) return;
  previewUnlocked = true;
  try {
    const a = ensurePreviewAudio();
    const tok = previewToken;
    const url = previewUrlOf(song);
    if (a.src !== absUrl(url)) a.src = url;
    a.muted = true;
    // if a real preview started meanwhile (token changed) leave it playing, only un-mute
    const done = () => { a.muted = false; if (tok === previewToken) { try { a.pause(); } catch (e) { /* ignore */ } } };
    const p = a.play();
    if (p && p.then) p.then(done, () => { a.muted = false; previewUnlocked = false; });
    else done();
  } catch (e) { /* ignore */ }
}

function startPreview(song) {
  stopPreview();
  if (holdPreview) return;
  if (!song || !song.audio || song.preview === false) return;
  const a = ensurePreviewAudio();
  const token = previewToken;
  const isClip = !!song.previewAudio;
  const url = previewUrlOf(song);
  const start = typeof song.previewStart === 'number' ? song.previewStart : (isClip ? 0 : 15);
  const SONG_VOL = song.volume > 0 ? Number(song.volume) : 1;   // per-song loudness (preview base is 0.8, capped at 1, so no gain node needed)
  const TARGET_VOL = Math.min(1, 0.8 * SONG_VOL), FADE_MS = 700;
  let LEN_MS = 14000;

  a.muted = false;
  a.volume = 0;
  if (a.src !== absUrl(url)) a.src = url;

  const seekAndFade = () => {
    if (token !== previewToken) return;
    const d = a.duration;
    try {
      if (isClip) a.currentTime = start;          // a clip plays from its own start: no big jump into the file
      else a.currentTime = (isFinite(d) && start > d - 20) ? Math.max(0, d * 0.3) : start;
    } catch (e) { /* ignore */ }
    if (isClip && isFinite(d)) LEN_MS = Math.min(LEN_MS, Math.max(2000, (d - start) * 1000 - 200));   // fade out before the clip ends
    const t0 = performance.now();
    clearInterval(previewTimer);
    previewTimer = setInterval(() => {
      if (token !== previewToken) return;
      const el = performance.now() - t0;
      let v = Math.min(1, el / FADE_MS) * TARGET_VOL;
      if (el > LEN_MS - FADE_MS) v = Math.max(0, (LEN_MS - el) / FADE_MS) * TARGET_VOL;
      a.volume = Math.max(0, Math.min(1, v));
      if (el >= LEN_MS) stopPreview();
    }, 60);
  };

  if (a.readyState >= 1) seekAndFade();
  else a.addEventListener('loadedmetadata', seekAndFade, { once: true });

  const p = a.play();
  if (p && p.catch) p.catch(() => {
    // blocked by the browser's autoplay rule: try again on the player's next tap instead of staying silent
    const retry = () => { if (token === previewToken) { const q = a.play(); if (q && q.catch) q.catch(() => {}); } };
    window.addEventListener('pointerdown', retry, { once: true, capture: true });
  });
}

// start downloading the first song's preview shortly after the page has loaded (new players spend a while on the
// title screen and the oshi picker, which is free download time)
window.addEventListener('load', () => setTimeout(() => warmPreview(window.SONGS && window.SONGS[0]), 800));

// ---------- SCREENS ----------
function setHudVisible(visible) {
  if (!visible && window.Shop) Shop.hideHud();
  scoreEl.style.display = visible ? '' : 'none';
  lifeEl.classList.toggle('show', visible);
}

function hideTransientHud() {
  countdownEl.classList.remove('show');
  document.body.classList.remove('intro-hud', 'intro-hud-in');
  if (introLoadingEl) introLoadingEl.style.display = 'none';
  timingEl.style.opacity = 0;
  tierBanner.getAnimations().forEach(a => a.cancel());
  judgementEl.getAnimations().forEach(a => a.cancel());
}

function hideAllOverlays() {
  results.classList.remove('show');
  gameOver.classList.remove('show');
  pauseOverlay.classList.remove('show');
  pauseBtn.classList.remove('show');
  setHudVisible(false);
  hideTransientHud();
  clearSongFx();
  if (window.Cards) Cards.hideScreen();
  if (window.Shop) Shop.hide();
}

function showMainMenu() {
  stopPreview();
  hideAllOverlays();
  music.pause();
  music.currentTime = 0;
  mode = 'idle';
  mainMenuScreen.style.display = '';
  menuScreen.style.display = 'none';
  game.style.display = 'none';
}

function showSongSelect() {
  stopPreview();
  hideAllOverlays();
  music.pause();
  music.currentTime = 0;
  mode = 'idle';
  mainMenuScreen.style.display = 'none';
  menuScreen.style.display = '';
  game.style.display = 'none';
  document.querySelectorAll('.song-card.selected').forEach(c => c.classList.remove('selected'));
  selectedSong = null;
  selectedCardEl = null;
  updateCardBests();
  initCarousel();
}

function showGameScreen() {
  mainMenuScreen.style.display = 'none';
  menuScreen.style.display = 'none';
  game.style.display = '';
  setHudVisible(true);
  measureLane();
}

// ---------- MENU ----------
// long titles get a smaller font (tl-1..3, see style.css) so they always fit the card's two title lines
function titleSizeClass(t) {
  const n = String(t).length;
  return n > 38 ? ' tl-3' : n > 32 ? ' tl-2' : n > 24 ? ' tl-1' : '';
}

function buildMenu() {
  setTimeout(() => Store.warmCovers(), 600);
  songGrid.innerHTML = '';
  const songs = Array.isArray(window.SONGS) ? window.SONGS : [];
  selectedSong = null;

  if (songs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'menu-empty';
    empty.textContent = 'No songs available';
    songGrid.appendChild(empty);
    return;
  }

  songs.forEach((song, i) => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.dataset.songId = song.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.style.setProperty('--card-delay', `${-(i * 0.4)}s`);

    const coverUrl = song.cover || '';
    const coverHtml = coverUrl
      ? `<div class="song-cover"><div class="song-cover-fallback">♪</div><img src="${escapeHtml(coverUrl)}" alt="" decoding="async" onerror="this.remove()"></div>`
      : `<div class="song-cover"><div class="song-cover-fallback">♪</div></div>`;

    const dailyBadge = (window.Daily && Daily.isFeatured(song.id)) ? '<div class="daily-badge">★ DAILY +50%</div>' : '';
    card.innerHTML = `
      ${dailyBadge}${coverHtml}
      <div class="song-info">
        <div class="song-card-title${titleSizeClass(song.title || song.id)}">${escapeHtml(song.title || song.id)}</div>
        <div class="song-card-artist">${escapeHtml(song.artist || '')}</div>
      </div>
      <button class="card-play-btn" type="button" aria-label="Play ${escapeHtml(song.title || song.id)}"><svg class="card-play-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.2v13.6a1 1 0 0 0 1.52.85l11-6.8a1 1 0 0 0 0-1.7l-11-6.8A1 1 0 0 0 8.5 5.2z" fill="currentColor"/></svg></button>
    `;

    card._song = song;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-play-btn')) return;
      if (card !== selectedCardEl) selectCard(card, song);
      else playUiClick();
      centerCard(card, true);
    });

    card.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (e.target.closest('.card-play-btn')) return;
        e.preventDefault();
        if (card === selectedCardEl) { beginSong(song); return; }
        selectCard(card, song);
        centerCard(card, true);
      }
    });

    const playBtnInside = card.querySelector('.card-play-btn');
    playBtnInside.addEventListener('click', (e) => {
      e.stopPropagation();
      beginSong(song);
    });

    songGrid.appendChild(card);
  });

  updateCardBests();
}

// best scores are shown in the equipped-cards bar now (shop.js), not on the song cards
function updateCardBests() {
  if (window.Shop && Shop.renderBest) Shop.renderBest();
}

function selectCard(card, song, fast) {
  document.querySelectorAll('.song-card.selected').forEach(c => {
    if (c !== card) c.classList.remove('selected');
  });
  card.classList.add('selected');                       // no forced reflow: the class swap is the only synchronous work
  selectedSong = song;
  selectedCardEl = card;
  // everything heavier is staggered AFTER the frame that shows the new selection, so it never collides with the scroll:
  //   +1 frame  select sound (synth nodes)     +~220 ms  squad bar update (idle time)     +~260 ms  preview audio
  cancelAnimationFrame(selectRaf);
  selectRaf = requestAnimationFrame(() => {
    const t = performance.now();
    if (t - selectSoundAt > 70) { selectSoundAt = t; try { playSongSelectSound(); } catch (e) { /* audio unavailable */ } }
  });
  if (window.Shop && Shop.setSong) Shop.setSong(song);
  stopPreview();
  clearTimeout(previewDelay);
  previewDelay = setTimeout(() => { if (selectedSong === song) startPreview(song); }, fast ? 30 : 260);   // no audio loading mid-scroll
  // the player is dwelling on this song: read its chart ahead and keep its audio on the device
  clearTimeout(storeDelay);
  storeDelay = setTimeout(() => { if (selectedSong === song) { Store.prefetchChart(song); Store.keepAudio(song); } }, 1800);
}
let selectRaf = 0, selectSoundAt = 0;
let previewDelay = 0, storeDelay = 0;

// ---------- SONG CAROUSEL (horizontal, snap-to-center) ----------
let selectedCardEl = null;
let lastPlayedId = null;
let carouselRaf = 0, carouselSettle = null, lastWheelStep = 0;

function carouselCards() {
  return Array.from(songGrid.querySelectorAll('.song-card'));
}

function cardTargetLeft(card) {
  return card.offsetLeft + card.offsetWidth / 2 - songGrid.clientWidth / 2;
}

function centerCard(card, smooth) {
  const left = Math.max(0, cardTargetLeft(card));
  songGrid.scrollTo({ left, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
}

// Sets --f (0 = far, 1 = dead centre) on every card so CSS can scale/fade them continuously,
// and returns the card closest to the middle.
// Card positions are measured once and cached (re-measured only when the grid is resized or rebuilt), so scrolling does
// pure arithmetic: no layout reads, and only the few cards near the middle are touched. Cost no longer grows with song count.
let focusGeo = null, focusActive = [];
const invalidateFocusGeo = () => { focusGeo = null; };
if ('ResizeObserver' in window) new ResizeObserver(() => { invalidateFocusGeo(); if (songGrid.clientWidth) updateCarouselFocus(); }).observe(songGrid);
if ('MutationObserver' in window) new MutationObserver(invalidateFocusGeo).observe(songGrid, { childList: true });
function getFocusGeo() {
  if (focusGeo) return focusGeo;
  if (!songGrid.clientWidth) return null;                              // screen hidden: nothing to measure yet
  const cards = carouselCards();
  focusGeo = { cards, mid: cards.map(c => c.offsetLeft + c.offsetWidth / 2), w: cards.map(c => c.offsetWidth) };
  return focusGeo;
}
function updateCarouselFocus() {
  const g = getFocusGeo();
  if (!g || !g.cards.length) return null;
  const n = g.mid.length, mid = songGrid.scrollLeft + songGrid.clientWidth / 2;
  let lo = 0, hi = n - 1;                                              // nearest card centre (binary search)
  while (lo < hi) { const m = (lo + hi) >> 1; if (g.mid[m] < mid) lo = m + 1; else hi = m; }
  if (lo > 0 && mid - g.mid[lo - 1] <= g.mid[lo] - mid) lo--;
  const next = [];
  for (let i = Math.max(0, lo - 2); i <= Math.min(n - 1, lo + 2); i++) {
    const c = g.cards[i], f = Math.max(0, 1 - Math.abs(g.mid[i] - mid) / (g.w[i] * 1.15)).toFixed(3);
    if (c._f !== f) { c._f = f; c.style.setProperty('--f', f); }
    next.push(c);
  }
  for (const c of focusActive) if (next.indexOf(c) < 0 && c._f !== '0.000') { c._f = '0.000'; c.style.setProperty('--f', '0.000'); }
  focusActive = next;
  return g.cards[lo];
}
// while the carousel is moving, body gets .carousel-scrolling so the endless glow / shimmer animations pause (CSS) and
// background polling waits; everything resumes a moment after it stops
let scrollIdle = 0;
function markScrolling() {
  const cl = document.body.classList;
  if (!cl.contains('carousel-scrolling')) cl.add('carousel-scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => cl.remove('carousel-scrolling'), 240);
}

function settleCarousel() {
  if (wheelBrowsing) return;                              // PC wheel: the song is picked when the wheel stops (finishWheelBrowse)
  const near = updateCarouselFocus();
  if (near && near !== selectedCardEl && near._song) selectCard(near, near._song);
}

function stepCarousel(dir) {
  const cards = carouselCards();
  if (!cards.length) return;
  let i = cards.indexOf(selectedCardEl);
  if (i < 0) i = 0;
  const next = cards[Math.max(0, Math.min(cards.length - 1, i + dir))];
  if (next === selectedCardEl) return;
  selectCard(next, next._song);
  centerCard(next, true);
}

function initCarousel() {
  const cards = carouselCards();
  if (!cards.length) return;
  // wait for layout (the screen was just un-hidden)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (menuScreen.style.display === 'none') return;
    const target = cards.find(c => c.dataset.songId === lastPlayedId) || cards[0];
    centerCard(target, false);
    updateCarouselFocus();
    selectCard(target, target._song, true);
  }));
}

songGrid.addEventListener('pointerdown', markScrolling, { passive: true });
songGrid.addEventListener('scroll', () => {
  markScrolling();
  if (!carouselRaf) carouselRaf = requestAnimationFrame(() => { carouselRaf = 0; updateCarouselFocus(); });
  clearTimeout(carouselSettle);
  carouselSettle = setTimeout(settleCarousel, 110);
}, { passive: true });

// mouse wheel / touchpad.
//  - PC browsers: the carousel glides smoothly under the wheel and songs only "hover" (focus effect) while it moves;
//    the song under the middle is selected (highlight, sound, preview, squad bar) once the wheel has stopped.
//  - touch devices keep the old behaviour: one song per wheel step.
const isPCBrowser = () => !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const WHEEL_SPEED = 1.4;          // carousel pixels per wheel pixel (one mouse-wheel notch is about one song)
const WHEEL_IDLE_MS = 150;        // how long the wheel must be still before the song is selected
let wheelBrowsing = false, wheelTarget = 0, wheelRaf = 0, wheelTimer = 0;

function wheelGlide() {
  wheelRaf = 0;
  const cur = songGrid.scrollLeft, diff = wheelTarget - cur;
  if (Math.abs(diff) < 0.5) { songGrid.scrollLeft = wheelTarget; return; }
  let step = diff * 0.2;
  if (Math.abs(step) < 1) step = Math.sign(diff) * Math.min(1, Math.abs(diff));
  songGrid.scrollLeft = cur + step;
  wheelRaf = requestAnimationFrame(wheelGlide);
}

function beginWheelBrowse() {
  wheelBrowsing = true;
  wheelTarget = songGrid.scrollLeft;
  songGrid.style.scrollSnapType = 'none';                  // snapping would fight the glide
  document.querySelectorAll('.song-card.selected').forEach(c => c.classList.remove('selected'));
  clearTimeout(previewDelay);
  stopPreview();
}

function finishWheelBrowse() {
  wheelTimer = 0;
  if (wheelRaf) { wheelTimer = setTimeout(finishWheelBrowse, 60); return; }   // still gliding: wait for it
  wheelBrowsing = false;
  songGrid.style.scrollSnapType = '';
  const near = updateCarouselFocus();
  if (near && near._song) { selectCard(near, near._song); centerCard(near, true); }
}

songGrid.addEventListener('wheel', (e) => {
  let d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (!d) return;
  e.preventDefault();
  markScrolling();

  if (isPCBrowser()) {
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= songGrid.clientWidth;
    if (!wheelBrowsing) beginWheelBrowse();
    const max = Math.max(0, songGrid.scrollWidth - songGrid.clientWidth);
    wheelTarget = Math.max(0, Math.min(max, wheelTarget + d * WHEEL_SPEED));
    if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelGlide);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(finishWheelBrowse, WHEEL_IDLE_MS);
    return;
  }

  const t = performance.now();
  if (t - lastWheelStep < 160) return;
  lastWheelStep = t;
  stepCarousel(d > 0 ? 1 : -1);
}, { passive: false });

window.addEventListener('resize', () => {
  if (menuScreen.style.display === 'none') return;
  invalidateFocusGeo();
  if (selectedCardEl) centerCard(selectedCardEl, false);
  updateCarouselFocus();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- CHART LOADING ----------
// Charts are loaded once per visit and kept in memory (and on disk through sw.js), so replaying a song or
// coming back to it never downloads it again. A chart edited on the server shows up the next time the game is opened.
const chartCache = new Map();      // url -> Promise<chart array>
function loadChartFile(url) {
  if (chartCache.has(url)) return chartCache.get(url);
  const p = new Promise((resolve, reject) => {
    const prevData = window.CHART_DATA;
    window.CHART_DATA = undefined;

    const s = document.createElement('script');
    s.src = url;
    s.onload = () => {
      const data = window.CHART_DATA;
      window.CHART_DATA = prevData;
      s.remove();                                   // the data is kept in the cache, the tag is not needed any more
      if (!Array.isArray(data)) {
        reject(new Error('Chart did not set window.CHART_DATA. Open ' + url + ' and confirm line 1 is exactly:  window.CHART_DATA = ['));
        return;
      }
      resolve(data);
    };
    s.onerror = () => {
      window.CHART_DATA = prevData;
      s.remove();
      reject(new Error('Could not load ' + url + ' — check the file exists at that path'));
    };
    document.head.appendChild(s);
  });
  chartCache.set(url, p);
  p.catch(() => chartCache.delete(url));            // a failed load can be retried
  return p;
}

async function loadChartFor(song) {
  if (Array.isArray(song.chart)) return song.chart;
  return loadChartFile(song.chart);
}

// ---------- DEVICE STORAGE (works together with sw.js) ----------
// Charts are read ahead and song audio is saved on the device once the player lingers on a song.
// Charts are loaded one at a time (they share window.CHART_DATA), and only while nothing else is going on.
const Store = (() => {
  let chartQueue = Promise.resolve();
  const warmedAudio = new Set();
  function prefetchChart(song) {
    if (!song || Array.isArray(song.chart) || !song.chart || chartCache.has(song.chart)) return;
    chartQueue = chartQueue.then(() => loadChartFile(song.chart).catch(() => {}));
  }
  function keepAudio(song) {
    if (!song || !song.audio || warmedAudio.has(song.audio)) return;
    warmedAudio.add(song.audio);
    try {
      const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (sw) sw.postMessage({ type: 'keep-audio', url: new URL(song.audio, document.baseURI).href });
    } catch (e) { /* no service worker: the browser cache still helps */ }
  }
  // covers: keep decoded images around so the carousel never has to fetch / decode while scrolling
  const coverKeep = [];
  function warmCovers() {
    const songs = Array.isArray(window.SONGS) ? window.SONGS : [];
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 400));
    let i = 0;
    (function next() {
      if (i >= songs.length) return;
      const s = songs[i++];
      if (s && s.cover) {
        const im = new Image();
        im.decoding = 'async';
        im.src = s.cover;
        if (im.decode) im.decode().catch(() => {});
        coverKeep.push(im);
      }
      idle(next);
    })();
  }
  return { prefetchChart, keepAudio, warmCovers };
})();

// ---------- SONG START ----------
// the play button first opens the card lineup (if the player owns cards), then the song starts
function beginSong(song) { askPlay(song); }          // always ask "PLAY THIS SONG?" first
function proceedSong(song) {
  const go = () => {
    if (matchMedia('(pointer: coarse)').matches) { tryFullscreen(); tryLandscapeLock(); }
    startSong(song);
  };
  // PLAY -> YES opens the CENTER pick (shop.js); it calls go() once the player has said YES to their center
  if (window.Shop && Shop.openLineup(song, go)) return;
  go();
}
async function startSong(song) {
  stopPreview();
  currentSong = song;
  lastPlayedId = song.id;
  showGameScreen();
  setStatus(`Loading ${song.title}…`);

  try {
    const chart = await loadChartFor(song);
    currentChart = chart;
    music.src = song.audio;
    startPlayback();
  } catch (err) {
    setStatus('ERROR: ' + err.message);
    alert('Could not load song:\n\n' + err.message);
    currentSong = null;
    currentChart = [];
    showSongSelect();
  }
}

// ---------- COUNT-UP ----------
function animateNumber(el, target, duration = 1000, fmt) {
  const token = el._numTok = (el._numTok || 0) + 1;
  const start = performance.now();
  const format = fmt || (v => Math.round(v).toLocaleString());
  function tick() {
    if (el._numTok !== token) return;
    const t = Math.min(1, (performance.now() - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  el.textContent = format(0);
  tick();
}

// ---------- RESULTS ----------
const results = document.createElement('div');
results.id = 'results';
results.innerHTML = `
  <div class="results-card">
    <div class="tape-top"></div>
    <div class="results-layout">
      <div class="results-left">
        <div class="record-badge" id="final-record">NEW RECORD!</div>
        <div class="rl-mid">
          <div class="results-cover" id="final-cover"></div>
          <div class="results-song" id="final-song"></div>
          <div class="rl-grade-row">
            <div class="grade-stamp" id="final-grade"></div>
            <div class="rl-points" id="final-points"></div>
          </div>
        </div>
      </div>
      <div class="results-right">
        <div class="results-title"><img src="images/finish.gif" class="title-img" alt="FINISH!"></div>
        <div class="results-banner" id="final-banner"></div>
        <div class="results-stats">
          <div class="results-stat">
            <div class="results-label">Total Score</div>
            <div class="results-value" id="final-score">0</div>
          </div>
          <div class="results-stat">
            <div class="results-label">Max Combo</div>
            <div class="results-value combo-value" id="final-combo">0</div>
          </div>
          <div class="results-stat">
            <div class="results-label">Accuracy</div>
            <div class="results-value acc-value" id="final-acc">0%</div>
          </div>
        </div>
        <div class="judge-counts">
          <div class="judge-cell jc-perfect"><div class="judge-name">Perfect</div><div class="judge-num" id="jc-perfect">0</div></div>
          <div class="judge-cell jc-great"><div class="judge-name">Great</div><div class="judge-num" id="jc-great">0</div></div>
          <div class="judge-cell jc-good"><div class="judge-name">Good</div><div class="judge-num" id="jc-good">0</div></div>
          <div class="judge-cell jc-bad"><div class="judge-name">Bad</div><div class="judge-num" id="jc-bad">0</div></div>
          <div class="judge-cell jc-miss"><div class="judge-name">Miss</div><div class="judge-num" id="jc-miss">0</div></div>
        </div>
        <div class="results-buttons">
          <button id="btn-play-again" class="gif-btn"><img src="images/play-again.gif" class="btn-gif" alt="Play Again"></button>
          <button id="btn-back" class="gif-btn"><img src="images/exit.gif" class="btn-gif" alt="Exit"></button>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(results);
const finalScoreEl = document.getElementById('final-score');
const finalComboEl = document.getElementById('final-combo');
const finalAccEl = document.getElementById('final-acc');
const finalSongEl = document.getElementById('final-song');
const finalCoverEl = document.getElementById('final-cover');
const finalGradeEl = document.getElementById('final-grade');
const finalBannerEl = document.getElementById('final-banner');
const finalRecordEl = document.getElementById('final-record');
const finalPointsEl = document.getElementById('final-points');
const judgeNumEls = {
  PERFECT: document.getElementById('jc-perfect'),
  GREAT: document.getElementById('jc-great'),
  GOOD: document.getElementById('jc-good'),
  BAD: document.getElementById('jc-bad'),
  MISS: document.getElementById('jc-miss'),
};
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBack = document.getElementById('btn-back');

let resultTimers = [];
function clearResultTimers() {
  resultTimers.forEach(clearTimeout);
  resultTimers = [];
}
function afterMs(ms, fn) { resultTimers.push(setTimeout(fn, ms)); }

function songLabel() {
  if (!currentSong) return '';
  return currentSong.title + (currentSong.artist ? ' — ' + currentSong.artist : '');
}

function setCoverImage(el, song) {
  if (!el) return;
  el.innerHTML = '';
  if (song && song.cover) {
    const img = document.createElement('img');
    img.src = song.cover;
    img.alt = '';
    img.onerror = () => {
      el.innerHTML = '<div class="results-cover-fallback">♪</div>';
    };
    el.appendChild(img);
  } else {
    el.innerHTML = '<div class="results-cover-fallback">♪</div>';
  }
}

function hideResults() {
  clearResultTimers();
  results.classList.remove('show');
}

function calcAccuracy() {
  if (judgedCount <= 0) return 0;
  let sum = 0;
  for (const k in ACC_WEIGHTS) sum += stats[k] * ACC_WEIGHTS[k];
  return sum / judgedCount;
}

function gradeFor(acc, sc) {
  for (const r of GRADE_RULES) if (acc >= r.acc && sc >= r.score) return r.g;
  return 'C';
}

// Points logo shown next to the grade on the result card. Change the path if your P logo lives somewhere else;
// if the image is missing it falls back to a gold "P" coin.
const POINT_LOGO_SRC = 'images/point.png';
const POINT_LOGO_HTML = '<img class="rl-pt-logo" src="' + POINT_LOGO_SRC + '" alt="" ' +
  'onerror="this.outerHTML=\'<span class=&quot;rl-pt-logo rl-pt-coin&quot;>P</span>\'">';

function showResults() {
  exitHighScoreView();
  mode = 'idle';
  pauseBtn.classList.remove('show');
  setHudVisible(false);
  hideTransientHud();
  setComboHidden();
  document.body.dataset.tier = 0;
  releaseAllInputs();
  petals.clear();
  clearSongFx();
  beatPulse.style.opacity = 0;
  lastBeatOpacity = 0;

  const acc = calcAccuracy();
  const grade = gradeFor(acc, score);
  const fullCombo = stats.MISS === 0 && stats.BAD === 0 && judgedCount > 0;
  const allPerfect = fullCombo && stats.GREAT === 0 && stats.GOOD === 0;
  if (window.Leaderboard) { try { Leaderboard.onResults(currentSong, score, acc); } catch (e) { /* never block the results screen */ } }

  // personal best
  let isRecord = false;
  if (currentSong) {
    const prev = loadBest(currentSong.id);
    isRecord = !prev || score > (prev.score || 0);
    // only the total score counts: a run that does not beat the high score is not stored at all (the old record stays untouched),
    // and a new record replaces the whole saved entry with that one run (no mixing of best combo / accuracy from other runs)
    if (isRecord) {
      const sr = (window.Shop && Shop.getRun) ? Shop.getRun() : null;
      saveBest(currentSong.id, {
        score, combo: maxCombo, acc, grade, fc: fullCombo,
        run: {
          score, combo: maxCombo, acc, grade, fc: fullCombo, ap: allPerfect,
          stats: { PERFECT: stats.PERFECT, GREAT: stats.GREAT, GOOD: stats.GOOD, BAD: stats.BAD, MISS: stats.MISS },
          bonus: sr ? sr.bonus : 0,
          cards: sr && sr.cards ? sr.cards.map(cd => ({ id: cd.id, tier: cd.tier, center: !!cd.center })) : []
        }
      });
    }
  }

  clearResultTimers();
  if (finalSongEl) finalSongEl.textContent = currentSong ? currentSong.title : '';   // title only, no artist
  setCoverImage(finalCoverEl, currentSong);

  finalScoreEl.textContent = '0';
  finalComboEl.textContent = '0';
  finalAccEl.textContent = '0.0%';
  for (const k in judgeNumEls) judgeNumEls[k].textContent = '0';

  finalGradeEl.getAnimations().forEach(a => a.cancel());
  finalGradeEl.textContent = grade;
  finalGradeEl.className = 'grade-stamp g-' + grade;
  finalGradeEl.style.opacity = 0;

  finalBannerEl.getAnimations().forEach(a => a.cancel());
  finalBannerEl.textContent = '';
  finalBannerEl.className = 'results-banner';
  finalBannerEl.style.opacity = 0;

  finalRecordEl.classList.remove('show');
  finalPointsEl.innerHTML = '';
  finalPointsEl.classList.remove('show');

  results.classList.remove('show');
  void results.offsetWidth;
  if (window.Shop) Shop.fillStrips();
  results.classList.add('show');

  afterMs(400, () => {
    animateNumber(finalScoreEl, score, 1000);
    animateNumber(finalComboEl, maxCombo, 900);
    animateNumber(finalAccEl, acc * 100, 900, v => v.toFixed(1) + '%');
    for (const k in judgeNumEls) animateNumber(judgeNumEls[k], stats[k], 700);
  });

  // grade stamp
  afterMs(1450, () => {
    finalGradeEl.style.opacity = 1;
    finalGradeEl.animate([
      { transform: 'scale(3) rotate(-24deg)', opacity: 0 },
      { transform: 'scale(0.9) rotate(-6deg)', opacity: 1, offset: 0.55 },
      { transform: 'scale(1.08) rotate(-9deg)', opacity: 1, offset: 0.78 },
      { transform: 'scale(1) rotate(-8deg)', opacity: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'both' });
    playStampSound(grade);
    if (grade === 'S' || grade === 'SS') triggerScreenFlash();
    shakeScreen(2);
  });

  // FULL COMBO / ALL PERFECT banner
  if (allPerfect || fullCombo) {
    afterMs(1950, () => {
      finalBannerEl.textContent = allPerfect ? '★ ALL PERFECT ★' : 'FULL COMBO';
      finalBannerEl.className = 'results-banner ' + (allPerfect ? 'ap' : 'fc');
      finalBannerEl.style.opacity = 1;
      finalBannerEl.animate([
        { transform: 'scale(0.4)', opacity: 0 },
        { transform: 'scale(1.2)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      playComboSound(480);
    });
  }

  if (isRecord) {
    afterMs(2250, () => {
      finalRecordEl.classList.add('show');
      playRecordSound();
    });
  }

  // JEKETI POINT reward: depends on the grade, with a Full Combo / All Perfect bonus
  let dailyBonus = false;
  if (window.Daily) {                                    // daily missions + featured song
    try {
      dailyBonus = !!(currentSong && Daily.isFeatured(currentSong.id));
      Daily.onRun({ songId: currentSong && currentSong.id, grade, fullCombo, allPerfect, maxCombo, perfects: stats.PERFECT, score });
    } catch (e) { /* never block the results screen */ }
  }
  if (window.Points) {
    let earned = Points.earnFor(grade, fullCombo, allPerfect);
    if (dailyBonus) earned = Math.round(earned * Daily.FEATURED_MULT);          // featured song: +50% Points
    Points.add(earned);
    // no count-up, no pop-in: "(P logo) +xxxx" next to the grade, daily bonus under it
    finalPointsEl.innerHTML =
      '<div class="rl-pt-line">' + POINT_LOGO_HTML + '<span class="rl-pt-amt">+' + earned.toLocaleString('en-US') + '</span></div>' +
      (dailyBonus ? '<div class="rl-pt-daily">\u2605 DAILY +50%</div>' : '');
    afterMs(1450, () => finalPointsEl.classList.add('show'));
  }
}

// ---------- GAME OVER ----------
function showGameOverScreen() {
  pauseBtn.classList.remove('show');
  setHudVisible(false);
  hideTransientHud();
  setComboHidden();
  document.body.dataset.tier = 0;
  petals.clear();
  clearSongFx();
  beatPulse.style.opacity = 0;
  lastBeatOpacity = 0;

  if (goSongEl) goSongEl.textContent = songLabel();
  setCoverImage(goCoverEl, currentSong);

  goScoreEl.textContent = '0';
  goComboEl.textContent = '0';

  gameOver.classList.remove('show');
  void gameOver.offsetWidth;
  if (window.Shop) Shop.fillStrips();
  gameOver.classList.add('show');

  clearResultTimers();
  afterMs(400, () => {
    animateNumber(goScoreEl, score, 1000);
    animateNumber(goComboEl, maxCombo, 900);
  });
}

function hideGameOverScreen() {
  gameOver.classList.remove('show');
}

function triggerGameOver() {
  mode = 'gameover';
  music.pause();
  releaseAllInputs();
  playGameOverSound();
  showGameOverScreen();
}

// ---------- PAUSE / RESUME ----------
function pauseGame() {
  if (mode !== 'playing' && mode !== 'countdown') return;
  if (mode === 'playing') {
    frozenTime = getSongTime();
    pauseStartWall = performance.now();
  }
  mode = 'paused';
  if (window.Shop) Shop.setCheerPaused(true);
  music.pause();
  countdownEl.classList.remove('show');
  if (window.Shop) Shop.fillStrips();
  pauseOverlay.classList.add('show');
  pauseBtn.classList.remove('show');
}

// Resume goes through a short 3-2-1 so the player is never dropped back in mid-note
function resumeGame() {
  if (mode !== 'paused') return;
  mode = 'countdown';
  if (window.Shop) Shop.setCheerPaused(false);
  countdownEnd = performance.now() + COUNTDOWN_STEP * 3;
  lastCountdownNum = 0;
  pauseOverlay.classList.remove('show');
  pauseBtn.classList.add('show');
  countdownEl.classList.add('show');
  startUpdateLoop();
}

function tickCountdown() {
  const rem = countdownEnd - performance.now();
  if (rem <= 0) { endCountdown(); return; }
  const n = Math.ceil(rem / COUNTDOWN_STEP);
  if (n !== lastCountdownNum) {
    lastCountdownNum = n;
    countdownEl.textContent = n;
    countdownEl.animate([
      { transform: 'scale(1.7)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: 0.25 },
      { transform: 'scale(0.9)', opacity: 0.85 },
    ], { duration: COUNTDOWN_STEP - 40, easing: 'ease-out' });
    playCountdownBeep(n);
  }
}

function endCountdown() {
  mode = 'resuming';
  countdownEl.classList.remove('show');
  const go = () => {
    if (mode !== 'resuming') return;
    if (!useAudio) wallOffset += performance.now() - pauseStartWall;
    mode = 'playing';
    lastFrameT = 0;
    resetClock();
    // a hold whose key was let go during the pause breaks now
    for (let i = 0; i < active.length; i++) {
      const n = active[i];
      if (n.holding && !n.judged && !pressedLanes.has(n.lane)) breakHold(n);
    }
  };
  const p = music.play();
  if (p && p.then) p.then(go, go);
  else go();
}

// ---------- INPUT RESET ----------
function releaseAllInputs() {
  pressedLanes.clear();
  activeTouches.clear();
  for (let i = 0; i < 4; i++) setLanePressed(i, false);
}

// ---------- BACK TO SONG SELECT ----------
function backToSongSelect() {
  playToken++;                       // cancel a pending start
  introShow = false;
  countdownEl.classList.remove('show');
  hideResults();
  hideGameOverScreen();
  pauseOverlay.classList.remove('show');
  document.querySelectorAll('.song-card.selected').forEach(c => c.classList.remove('selected'));
  selectedSong = null;
  music.pause();
  music.removeAttribute('src');     // let go of the finished song's audio; the next song sets its own src
  try { music.load(); } catch (e) { /* ignore */ }
  mode = 'idle';
  clearNotes();
  queue = [];
  releaseAllInputs();
  resetRunState();
  scoreEl.textContent = 'Score: 0';
  setComboHidden();
  petals.clear();
  clearSongTheme();
  beatPulse.style.opacity = 0;
  lastBeatOpacity = 0;
  document.body.dataset.tier = 0;
  currentSong = null;
  currentChart = [];
  showSongSelect();
}

// ---------- ORIENTATION / FULLSCREEN ----------
function tryLandscapeLock() {
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* silent — iOS Safari doesn't support this */ }
}

async function tryFullscreen() {
  // inside the scaled launcher frame, fullscreen must be done by the parent page
  if (window.parent !== window) { try { window.parent.postMessage({ jeketi: 'fullscreen' }, '*'); } catch (e) {} return; }
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
  } catch (e) { /* silent */ }
}

// ---------- SOUND ----------
// SFX VOLUME: 1 = as before, 2 = twice as loud, 3 = three times... (songs are not affected, they play through <audio>)
const SFX_VOLUME = 1.5;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // every sound effect connects to audioCtx.destination: point that at one volume knob + a limiter (stops loud peaks from crackling)
    try {
      const realOut = audioCtx.destination;
      const bus = audioCtx.createGain();
      bus.gain.value = SFX_VOLUME;
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
      audioCtx.rawDestination = realOut;
      bus.connect(limiter).connect(realOut);
      Object.defineProperty(audioCtx, 'destination', { value: bus, configurable: true });
    } catch (e) { /* keep the normal output */ }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}

// White-noise buffers are expensive to fill; build each kind once and reuse it
const noiseCache = new Map();
function getNoiseBuffer(seconds, decay) {
  const key = seconds + '|' + decay;
  let buf = noiseCache.get(key);
  if (!buf || buf.sampleRate !== audioCtx.sampleRate) {
    const size = Math.floor(audioCtx.sampleRate * seconds);
    buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * decay));
    }
    noiseCache.set(key, buf);
  }
  return buf;
}

// NOTE-TAP VOLUME: 1 = as before, 0.5 = half as loud (only the sound of hitting a note; other sfx are not affected)
const HIT_VOLUME = 0;
function playHitSound(judgement, comboValue) {
  if (HIT_VOLUME <= 0) return;      // silent anyway: do not build oscillators / noise nodes on every single hit
  ensureAudio();
  const now = audioCtx.currentTime;
  const tier = getTier(comboValue);

  if (judgement === 'BAD') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
    gain.gain.setValueAtTime(0.16 * HIT_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
    return;
  }

  const baseFreq = judgement === 'PERFECT' ? 2400
                 : judgement === 'GREAT'   ? 1800
                 : 1300;
  const freq = baseFreq * (1 + tier * 0.04);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.03);
  gain.gain.setValueAtTime(0.13 * HIT_VOLUME, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.055);

  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(0.02, 0.1);
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.06 * HIT_VOLUME, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
  noise.start(now);
}

function playMissSound() {
  ensureAudio();
  const now = audioCtx.currentTime;

  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(220, now);
  osc1.frequency.exponentialRampToValueAtTime(55, now + 0.45);
  gain1.gain.setValueAtTime(0.17, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc1.connect(gain1).connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.55);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(180, now);
  osc2.frequency.exponentialRampToValueAtTime(45, now + 0.45);
  gain2.gain.setValueAtTime(0.09, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(gain2).connect(audioCtx.destination);
  osc2.start(now);
  osc2.stop(now + 0.55);
}

function playGameOverSound() {
  ensureAudio();
  const now = audioCtx.currentTime;

  const seq = [440, 392, 349.23, 261.63];
  seq.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = now + i * 0.38;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  });

  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(110, now);
  bass.frequency.exponentialRampToValueAtTime(50, now + 1.6);
  bassGain.gain.setValueAtTime(0.22, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  bass.connect(bassGain).connect(audioCtx.destination);
  bass.start(now);
  bass.stop(now + 1.9);

  const chime = audioCtx.createOscillator();
  const chimeGain = audioCtx.createGain();
  chime.type = 'sine';
  chime.frequency.setValueAtTime(660, now + 1.5);
  chime.frequency.exponentialRampToValueAtTime(220, now + 2.5);
  chimeGain.gain.setValueAtTime(0.001, now + 1.5);
  chimeGain.gain.linearRampToValueAtTime(0.1, now + 1.55);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
  chime.connect(chimeGain).connect(audioCtx.destination);
  chime.start(now + 1.5);
  chime.stop(now + 2.9);
}

function playComboSound(comboValue) {
  ensureAudio();
  const now = audioCtx.currentTime;
  const tier = getTier(comboValue);

  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-18, now);
  comp.knee.setValueAtTime(20, now);
  comp.ratio.setValueAtTime(8, now);
  comp.attack.setValueAtTime(0.003, now);
  comp.release.setValueAtTime(0.2, now);
  comp.connect(audioCtx.destination);

  const master = audioCtx.createGain();
  master.gain.value = 1.5;
  master.connect(comp);

  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.7);
  subGain.gain.setValueAtTime(0.6 + tier * 0.08, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  sub.connect(subGain).connect(master);
  sub.start(now);
  sub.stop(now + 0.95);

  const kickOsc = audioCtx.createOscillator();
  const kickGain = audioCtx.createGain();
  kickOsc.type = 'sine';
  kickOsc.frequency.setValueAtTime(180, now);
  kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
  kickGain.gain.setValueAtTime(0.55 + tier * 0.05, now);
  kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  kickOsc.connect(kickGain).connect(master);
  kickOsc.start(now);
  kickOsc.stop(now + 0.32);

  const chords = comboValue >= 200 ? [880, 1100, 1320] :
                 comboValue >= 100 ? [880, 1100] :
                 [880, 1320];
  const chordVol = 0.26 + tier * 0.05;
  chords.forEach(freq => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(chordVol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.75);
  });

  const arp = comboValue >= 200 ? [1760, 2200, 2640] :
              comboValue >= 100 ? [1320, 1760] :
              [1320];
  arp.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t = now + 0.06 + i * 0.05;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.45);
  });

  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(0.15, 0.2);
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.28 + tier * 0.04, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  const nFilter = audioCtx.createBiquadFilter();
  nFilter.type = 'highpass';
  nFilter.frequency.value = 1200;
  noise.connect(nFilter).connect(nGain).connect(master);
  noise.start(now);

  if (tier >= 3) {
    for (let i = 0; i < tier - 1; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = now + 0.28 + i * 0.06;
      osc.type = 'sine';
      osc.frequency.value = 3000 + i * 300;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }
}

// grade stamp: thud + a little fanfare that gets bigger with the grade
function playStampSound(grade) {
  ensureAudio();
  const now = audioCtx.currentTime;

  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(170, now);
  thud.frequency.exponentialRampToValueAtTime(42, now + 0.25);
  thudGain.gain.setValueAtTime(0.5, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  thud.connect(thudGain).connect(audioCtx.destination);
  thud.start(now);
  thud.stop(now + 0.38);

  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(0.15, 0.2);
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.18, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  const nFilter = audioCtx.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.value = 1800;
  noise.connect(nFilter).connect(nGain).connect(audioCtx.destination);
  noise.start(now);

  const notes = grade === 'SS' ? [784, 988, 1175, 1568, 1976]
              : grade === 'S' ? [784, 988, 1175, 1568]
              : grade === 'A' ? [659, 784, 988]
              : grade === 'B' ? [523, 659]
              : [];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t = now + 0.12 + i * 0.075;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

function playRecordSound() {
  ensureAudio();
  const now = audioCtx.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t = now + i * 0.07;
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

function playCountdownBeep(n) {
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = n === 1 ? 988 : 740;
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// ---------- UI CLICK SOUND ----------
function playUiClick() {
  ensureAudio();
  const now = audioCtx.currentTime;

  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(1800, now);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.012);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  osc1.connect(gain1).connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.025);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(900, now + 0.01);
  osc2.frequency.exponentialRampToValueAtTime(600, now + 0.045);
  gain2.gain.setValueAtTime(0.001, now + 0.01);
  gain2.gain.linearRampToValueAtTime(0.18, now + 0.015);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc2.connect(gain2).connect(audioCtx.destination);
  osc2.start(now + 0.01);
  osc2.stop(now + 0.06);

  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(0.008, 0.15);
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.1, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000;
  noise.connect(filter).connect(nGain).connect(audioCtx.destination);
  noise.start(now);
}

function playSongSelectSound() {
  ensureAudio();
  const now = audioCtx.currentTime;

  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(150, now);
  bass.frequency.exponentialRampToValueAtTime(70, now + 0.15);
  bassGain.gain.setValueAtTime(0.2, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  bass.connect(bassGain).connect(audioCtx.destination);
  bass.start(now);
  bass.stop(now + 0.24);

  const whoosh = audioCtx.createOscillator();
  const whooshGain = audioCtx.createGain();
  whoosh.type = 'sawtooth';
  whoosh.frequency.setValueAtTime(180, now);
  whoosh.frequency.exponentialRampToValueAtTime(900, now + 0.1);
  whooshGain.gain.setValueAtTime(0.07, now);
  whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(800, now);
  lp.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
  whoosh.connect(lp).connect(whooshGain).connect(audioCtx.destination);
  whoosh.start(now);
  whoosh.stop(now + 0.13);

  const seq = [523.25, 659.25, 783.99];
  seq.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = now + 0.09 + i * 0.045;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.42);
  });
}

// ---------- CANVAS PLAYFIELD ----------
// Pseudo-3D done by hand: a note's screen position and size come from one cheap formula,
// so there is no CSS 3D transform, no per-note DOM element and no box-shadow repaint.
const S_FAR = 0.34;                        // size of the lanes at the very top, relative to the hit line
const Z_FAR = 1 / S_FAR;
const FIELD = { W: 0, H: 0, dpr: 1, cx: 0, left: 0, top: 0, topY: 0, hitY: 0, yH: 0, lw: 0, recH: 0, noteW: 0, noteH: 0 };
const lanePressedState = [false, false, false, false];
const laneFlashUntil = [0, 0, 0, 0];
const laneHitUntil = [0, 0, 0, 0];
const laneHitColor = ['#ff6ba6', '#ff6ba6', '#ff6ba6', '#ff6ba6'];
const beamA = [0, 0, 0, 0];
const beamColor = ['#ff6ba6', '#ff6ba6', '#ff6ba6', '#ff6ba6'];
const beamG = [null, null, null, null], beamGC = ['', '', '', ''], beamGV = [-1, -1, -1, -1];   // cached beam gradients
let layoutVer = 0;                                                                                // bumps whenever the field is re-laid-out
const fxRings = [];
const fxParts = [];
const fxPops = [];                         // quick "pop" of a note that was just hit
const FX_COL = { perfect: '#ffcc33', great: '#4da8ff', good: '#66d9a8' };
const NOTE_COLS = [
  { top: '#ffd2e6', bot: '#ff6ba6', glow: 'rgba(255,107,166,0.9)', hi: 'rgba(255,255,255,0.85)', lo: 'rgba(140,20,70,0.5)', hex: '#ff6ba6' },
  { top: '#d2eaff', bot: '#4da8ff', glow: 'rgba(77,168,255,0.9)',  hi: 'rgba(255,255,255,0.85)', lo: 'rgba(20,70,160,0.5)', hex: '#4da8ff' },
  { top: '#fff2b0', bot: '#ffcc33', glow: 'rgba(255,204,51,0.9)',  hi: 'rgba(255,255,255,0.9)',  lo: 'rgba(160,100,0,0.5)', hex: '#ffcc33' },
  { top: '#B84A9E', bot: '#4A0A3E', glow: 'rgba(190,60,170,0.95)', hi: 'rgba(255,180,240,0.6)',  lo: 'rgba(40,0,30,0.65)',  hex: '#c040a8' },
];
const NOTE_SPR = [];
// SONG THEME (songs.js:  theme: 'crimson' | 'white'). Recolours petals, lights, hit effects and track. Everything is painted once into sprites / static canvases, nothing extra runs per frame.
const crimsonNote = (top, bot, glow) => ({ top, bot, glow, hi: 'rgba(255,225,230,0.85)', lo: 'rgba(80,0,15,0.55)', hex: bot });
const whiteNote = (top, bot, glow) => ({ top, bot, glow, hi: 'rgba(255,255,255,0.8)', lo: 'rgba(120,135,180,0.4)', hex: bot });
const THEMES = {
  crimson: {
    hex: '#dc143c', lane: '#dc143c',
    atmo: 'radial-gradient(ellipse at 50% 38%,rgba(190,12,48,0.34) 0%,rgba(120,6,32,0.46) 45%,rgba(40,0,10,0.72) 100%)',
    pulse: 'radial-gradient(ellipse at 50% 60%,rgba(255,30,70,0.55),rgba(160,0,30,0) 70%)', flash: 'rgba(255,40,80,0.38)',
    notes: [null,                                                          // 0 = combo under 100: the normal pink note
      crimsonNote('#ff8da1', '#dc143c', 'rgba(220,20,60,0.9)'),            // 100 combo
      crimsonNote('#ff6f88', '#d10a30', 'rgba(230,15,55,0.95)'),           // 200 combo
      crimsonNote('#ff5a78', '#b80026', 'rgba(240,10,50,0.95)')],          // 480 combo
    fx: { perfect: '#ff5a78', great: '#dc143c', good: '#b0122f' },
    petals: ['#ff4d6d', '#dc143c', '#e8284a', '#c1122f', '#ff2a52'],
    track: ['rgba(60,0,14,0)', 'rgba(90,6,26,0.55)', 'rgba(130,10,36,0.78)'],
    edge: 'rgba(255,90,120,0.2)', rail: 'rgba(255,170,185,0.9)', railGlow: 'rgba(220,20,60,0.95)',
    padLine: 'rgba(255,190,200,0.85)', recStroke: 'rgba(220,20,60,0.75)',
    atmoOpacity: [0.55, 0.65, 0.78, 0.9, 1],                               // grows with the combo tier
  },
  // WHITE / heavenly: soft white notes (from 100 combo), white feathers, pale light from above. The lanes keep their normal look.
  // Kept gentle on purpose: the glow only rises slowly with the combo and never gets a hard, bright white.
  white: {
    hex: '#e9efff', lane: '#ff6ba6',
    atmo: 'radial-gradient(ellipse at 50% -8%,rgba(236,242,255,0.30) 0%,rgba(205,218,255,0.12) 42%,rgba(190,205,255,0) 75%),radial-gradient(ellipse at 50% 108%,rgba(225,234,255,0.16) 0%,rgba(225,234,255,0) 55%)',
    pulse: 'radial-gradient(ellipse at 50% 100%,rgba(232,240,255,0.26) 0%,transparent 62%)', flash: 'rgba(232,240,255,0.18)',
    notes: [null,
      whiteNote('#ffffff', '#dfe7fb', 'rgba(225,235,255,0.55)'),           // 100 combo
      whiteNote('#ffffff', '#e6edff', 'rgba(230,238,255,0.72)'),           // 200 combo
      whiteNote('#ffffff', '#eef3ff', 'rgba(238,244,255,0.88)')],          // 480 combo: the brightest, still soft
    fx: { perfect: '#f4f7ff', great: '#dfe7fb', good: '#c9d6f5' },
    petals: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], petalShape: 'feather',   // white feathers at every combo
    // lanes stay exactly like the default look
    track: ['rgba(20,8,40,0)', 'rgba(34,12,60,0.55)', 'rgba(70,18,80,0.78)'],
    edge: 'rgba(255,170,215,0.16)', rail: 'rgba(255,196,228,0.9)', railGlow: 'rgba(255,107,166,0.9)',
    padLine: 'rgba(255,205,230,0.85)', recStroke: 'rgba(255,107,166,0.65)',
    atmoOpacity: [0.5, 0.62, 0.76, 0.9, 1],
  },
};
let TH = null;                                                              // active theme (null = default look)
let COLS_NOW = NOTE_COLS;                                                   // cached, so the draw loop never builds arrays
const noteCols = () => COLS_NOW;
const ACCENT = () => (TH ? TH.hex : '#ff6ba6');
const _rgbCache = {};

function rgbaOf(hex, a) {
  let c = _rgbCache[hex];
  if (!c) {
    const h = hex.replace('#', '');
    const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    c = _rgbCache[hex] = [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const sAt = (y) => (y - FIELD.yH) / (FIELD.hitY - FIELD.yH);          // lane scale at a screen y
const yAt = (s) => FIELD.yH + (FIELD.hitY - FIELD.yH) * s;            // screen y for a lane scale
const laneX = (lane, s) => FIELD.cx + (lane - 1.5) * FIELD.lw * s;     // centre of a lane at a scale
const edgeX = (k, s) => FIELD.cx + (k - 2) * FIELD.lw * s;             // lane border k (0..4) at a scale
function timeToScale(t) {                                               // t: 0 = just appeared, 1 = on the hit line
  if (t > 1.3) t = 1.3;
  return 1 / (Z_FAR - (Z_FAR - 1) * t);
}
function tierVariant() { const t = getTier(combo); return t >= 4 ? 3 : t >= 3 ? 2 : t >= 2 ? 1 : 0; }

// Bottom edge of the equipped-card strip (0 when no cards are shown). The track starts under it, like SuperStar.
function cardStripBottom() {
  const c = document.querySelector('.card-cheer .pos-c') || document.querySelector('.card-cheer .cc-card');
  if (!c) return 0;
  const r = c.getBoundingClientRect();
  return r.height > 0 ? r.bottom - FIELD.top : 0;
}

function layoutField() {
  const W = playfieldEl.clientWidth, H = playfieldEl.clientHeight;
  if (!W || !H) return;
  const F = FIELD;
  // phones render the playfield at a lower resolution (the glow-style notes hardly show it); light mode goes down to 1x
  const dprCap = lowFx ? LITE_DPR : 1, pxCap = lowFx ? 0.55e6 : 1.0e6, dprMin = lowFx ? 0.5 : 1;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  while (W * H * dpr * dpr > pxCap && dpr > dprMin) dpr = Math.max(dprMin, dpr - 0.25);   // never paint a huge bitmap
  layoutVer++;
  const r = playfieldEl.getBoundingClientRect();
  const strip = cardStripBottom();
  const topY = strip > 0 ? Math.min(Math.round(strip + 6), Math.round(H * 0.34)) : 0;
  if (F.lw && W === F.W && H === F.H && dpr === F.dpr && Math.abs(topY - F.topY) < 2) return;   // nothing changed
  F.left = r.left; F.top = r.top; F.topY = topY;
  F.W = W; F.H = H; F.dpr = dpr; F.cx = W / 2;
  // narrow, centred track: ~55% of a phone screen, never wider than 820px
  const fieldW = Math.min(W * 0.58, H * 1.15, 820);
  F.lw = fieldW / 4;
  F.hitY = Math.round(H * 0.78);
  F.yH = (F.topY - F.hitY * S_FAR) / (1 - S_FAR);   // vanishing point, so the lanes are S_FAR wide exactly at topY
  F.recH = F.lw * 0.42;
  F.noteW = F.lw * 0.88;
  F.noteH = F.lw * 0.34;
  for (const cv of [fieldCv, fieldBgCv]) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  buildSprites();
  drawStatic();
  drawField(getSongTime(), 16);
}

function buildSprites() {
  const F = FIELD;
  const COLS = noteCols();
  const pad = Math.ceil(F.lw * 0.14), w = F.noteW, h = F.noteH, k = F.dpr * 1.15;
  COLS.forEach((c, i) => {
    c.h0 = rgbaOf(c.hex, 0.25); c.h1 = rgbaOf(c.hex, 0.7); c.h2 = rgbaOf(c.hex, 0.9); c.hk = rgbaOf(c.hex, 0.95);   // hold-body colours, built once (not per frame)
    const cv = (NOTE_SPR[i] && NOTE_SPR[i].cv) || document.createElement('canvas');
    cv.width = Math.ceil((w + 2 * pad) * k);
    cv.height = Math.ceil((h + 2 * pad) * k);
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w + 2 * pad, h + 2 * pad);
    const rad = h * 0.42;
    g.shadowColor = c.glow; g.shadowBlur = pad * 0.9;       // the glow is painted ONCE here, never per frame
    g.fillStyle = c.bot; rr(g, pad, pad, w, h, rad); g.fill();
    g.shadowBlur = 0;
    const gr = g.createLinearGradient(0, pad, 0, pad + h);
    gr.addColorStop(0, c.top); gr.addColorStop(1, c.bot);
    g.fillStyle = gr; rr(g, pad, pad, w, h, rad); g.fill();
    g.save(); rr(g, pad, pad, w, h, rad); g.clip();
    g.fillStyle = c.lo; g.fillRect(pad, pad + h * 0.86, w, h * 0.14);
    g.restore();
    g.fillStyle = c.hi; g.globalAlpha = 0.9;
    rr(g, pad + h * 0.3, pad + h * 0.1, w - h * 0.6, h * 0.15, h * 0.075); g.fill();
    g.globalAlpha = 1;
    NOTE_SPR[i] = { cv, w: w + 2 * pad, h: h + 2 * pad };
  });
}

function drawStatic() {
  const F = FIELD, c = bgCtx;
  c.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
  c.clearRect(0, 0, F.W, F.H);
  const y0 = F.topY, s0 = sAt(y0), s1 = sAt(F.H);
  c.beginPath();
  c.moveTo(edgeX(0, s0), y0); c.lineTo(edgeX(4, s0), y0);
  c.lineTo(edgeX(4, s1), F.H); c.lineTo(edgeX(0, s1), F.H);
  c.closePath();
  const g = c.createLinearGradient(0, y0, 0, F.H);
  g.addColorStop(0, TH ? TH.track[0] : 'rgba(20,8,40,0)');
  g.addColorStop(0.4, TH ? TH.track[1] : 'rgba(34,12,60,0.55)');
  g.addColorStop(1, TH ? TH.track[2] : 'rgba(70,18,80,0.78)');
  c.fillStyle = g; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = TH ? TH.edge : 'rgba(255,170,215,0.16)';
  for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(edgeX(k, s0), y0); c.lineTo(edgeX(k, s1), F.H); c.stroke(); }
  const rg = c.createLinearGradient(0, y0, 0, y0 + (F.H - y0) * 0.3);
  rg.addColorStop(0, TH ? 'rgba(255,170,185,0)' : 'rgba(255,196,228,0)'); rg.addColorStop(1, TH ? TH.rail : 'rgba(255,196,228,0.9)');
  c.lineWidth = 3; c.strokeStyle = rg;
  c.shadowColor = TH ? TH.railGlow : 'rgba(255,107,166,0.9)'; c.shadowBlur = 12;
  for (const k of [0, 4]) { c.beginPath(); c.moveTo(edgeX(k, s0), y0); c.lineTo(edgeX(k, s1), F.H); c.stroke(); }
  c.shadowBlur = 0;

  // resting tap pads: tint, top line and the receptor outline the notes land on (idle look; pressed lanes are highlighted per frame in drawField)
  const padTop = F.hitY - F.recH / 2, sA = sAt(padTop), sB = sAt(F.H);
  for (let i = 0; i < 4; i++) {
    c.globalAlpha = 0.10; c.fillStyle = TH ? TH.lane : '#ff6ba6';
    c.beginPath();
    c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop);
    c.lineTo(edgeX(i + 1, sB) - 1, F.H); c.lineTo(edgeX(i, sB) + 1, F.H);
    c.closePath(); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = TH ? TH.padLine : 'rgba(255,205,230,0.85)';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop); c.stroke();
    c.strokeStyle = TH ? TH.recStroke : 'rgba(255,107,166,0.65)';
    c.lineWidth = 2.5;
    rr(c, laneX(i, 1) - F.noteW * 0.52, F.hitY - F.recH / 2, F.noteW * 1.04, F.recH, F.recH * 0.4);
    c.stroke();
  }
}

function drawField(now, dt) {
  const F = FIELD;
  if (!F.W) return;
  const c = ctx, wall = performance.now();
  c.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
  c.clearRect(0, 0, F.W, F.H);

  const padTop = F.hitY - F.recH / 2;
  const sA = sAt(padTop), sB = sAt(F.H);

  // light beams + tap pads (the big zone each thumb rests on)
  for (let i = 0; i < 4; i++) {
    const down = lanePressedState[i];
    const target = down ? 0.32 : 0;
    if (beamA[i] > target) beamA[i] = Math.max(target, beamA[i] - dt * 0.004);
    else if (beamA[i] < target) beamA[i] = target;
    if (beamA[i] > 0.02) {
      const yTop = yAt(0.5);
      let gr = beamG[i];                                     // the gradient only changes with colour / layout: build it once, not every frame
      if (!gr || beamGC[i] !== beamColor[i] || beamGV[i] !== layoutVer) {
        gr = c.createLinearGradient(0, F.hitY, 0, yTop);
        gr.addColorStop(0, rgbaOf(beamColor[i], 0.85));
        gr.addColorStop(1, rgbaOf(beamColor[i], 0));
        beamG[i] = gr; beamGC[i] = beamColor[i]; beamGV[i] = layoutVer;
      }
      c.globalAlpha = Math.min(1, beamA[i]);
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(edgeX(i, 1), F.hitY); c.lineTo(edgeX(i + 1, 1), F.hitY);
      c.lineTo(edgeX(i + 1, 0.5), yTop); c.lineTo(edgeX(i, 0.5), yTop);
      c.closePath(); c.fill();
    }
    // The resting pad (10% tint, top line, receptor outline) is painted once on the static canvas (drawStatic).
    // Here only the lanes that are pressed / flashing add a highlight on top, so an idle lane costs nothing per frame.
    let col = TH ? TH.lane : '#ff6ba6', a = 0;
    if (wall < laneHitUntil[i]) { col = laneHitColor[i]; a = 0.5; }
    else if (down) a = 0.38;
    else if (wall < laneFlashUntil[i]) a = 0.22;
    if (a > 0) {
      c.globalAlpha = (a - 0.10) / 0.90; c.fillStyle = col;   // stacks on the 10% base, so the total stays exactly `a`
      c.beginPath();
      c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop);
      c.lineTo(edgeX(i + 1, sB) - 1, F.H); c.lineTo(edgeX(i, sB) + 1, F.H);
      c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    if (down) {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop); c.stroke();
      c.lineWidth = 3;
      rr(c, laneX(i, 1) - F.noteW * 0.52, F.hitY - F.recH / 2, F.noteW * 1.04, F.recH, F.recH * 0.4);
      c.stroke();
    }
  }
  c.globalAlpha = 1;

  // notes
  const v = tierVariant();
  const spr = NOTE_SPR[v];
  if (spr) {
    const colr = noteCols()[v];
    for (let i = 0; i < active.length; i++) {
      const n = active[i];
      if (n.judged) continue;
      const tHead = (now - (n.time - APPROACH_TIME)) / APPROACH_TIME;
      if (tHead < 0) continue;
      const na = (tHead < 0.12 ? tHead / 0.12 : 1) * introNoteK;           // fade in just under the card strip (and during the get-ready intro)
      if (na !== c.globalAlpha) c.globalAlpha = na;                        // only touch the canvas state when it actually changes
      if (n.dur > 0) {
        const tTail = Math.max(0, (now - (n.time + n.dur - APPROACH_TIME)) / APPROACH_TIME);
        const th = n.holding ? Math.min(tHead, 1) : tHead;
        const sH = timeToScale(th), sT = timeToScale(tTail);
        const yH = yAt(sH), yT = yAt(sT);
        if (yH > yT) {
          const cxH = laneX(n.lane, sH), cxT = laneX(n.lane, sT);
          const bwH = F.noteW * 0.78 * sH, bwT = F.noteW * 0.78 * sT;
          if (fxLite()) c.fillStyle = n.holding ? colr.h2 : colr.h1;     // lite: flat body, no gradient built per frame
          else {
            const gr = c.createLinearGradient(0, yT, 0, yH);
            gr.addColorStop(0, colr.h0);
            gr.addColorStop(1, n.holding ? colr.h2 : colr.h1);
            c.fillStyle = gr;
          }
          c.beginPath();
          c.moveTo(cxT - bwT / 2, yT); c.lineTo(cxT + bwT / 2, yT);
          c.lineTo(cxH + bwH / 2, yH); c.lineTo(cxH - bwH / 2, yH);
          c.closePath(); c.fill();
          c.strokeStyle = colr.hk; c.lineWidth = 2;
          c.stroke();
        }
        const w = spr.w * sH, h = spr.h * sH;
        c.drawImage(spr.cv, laneX(n.lane, sH) - w / 2, yH - h / 2, w, h);
      } else {
        const s = timeToScale(tHead), y = yAt(s);
        if (y - 40 > F.H) continue;
        const w = spr.w * s, h = spr.h * s;
        c.drawImage(spr.cv, laneX(n.lane, s) - w / 2, y - h / 2, w, h);
      }
    }
    c.globalAlpha = 1;
  }

  // hit pops
  for (let i = fxPops.length - 1; i >= 0; i--) {
    const p = fxPops[i], age = (wall - p.t0) / 280;
    if (age >= 1) { fxPops[i] = fxPops[fxPops.length - 1]; fxPops.pop(); continue; }
    const sp = NOTE_SPR[p.v];
    if (!sp) continue;
    const k = 1 + 0.8 * age, w = sp.w * k, h = sp.h * k;
    c.globalAlpha = 1 - age;
    c.drawImage(sp.cv, laneX(p.lane, 1) - w / 2, F.hitY - h / 2, w, h);
  }
  c.globalAlpha = 1;

  // rings
  for (let i = fxRings.length - 1; i >= 0; i--) {
    const r = fxRings[i], age = (wall - r.t0) / 500;
    if (age >= 1) { fxRings[i] = fxRings[fxRings.length - 1]; fxRings.pop(); continue; }
    if (age < 0) continue;
    const k = 1 + 1.4 * age;
    const w = F.noteW * 1.04 * k, h = F.recH * k;
    c.globalAlpha = age < 0.4 ? 1 - age * 0.75 : 0.7 * (1 - (age - 0.4) / 0.6);
    c.strokeStyle = r.col; c.lineWidth = 2.5;
    rr(c, laneX(r.lane, 1) - w / 2, F.hitY - h / 2, w, h, h * 0.4);
    c.stroke();
  }
  // particles
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i], age = (wall - p.t0) / 550;
    if (age >= 1) { fxParts[i] = fxParts[fxParts.length - 1]; fxParts.pop(); continue; }
    const e = 1 - (1 - age) * (1 - age);
    c.globalAlpha = 1 - age;
    c.fillStyle = p.col;
    c.beginPath();
    c.arc(p.x + Math.cos(p.a) * p.d * e, p.y + Math.sin(p.a) * p.d * e, p.r * (1 - 0.7 * age), 0, 6.2832);
    c.fill();
  }
  c.globalAlpha = 1;
}

function fxColor(j) { const k = String(j).toLowerCase(); return (TH && TH.fx[k]) || FX_COL[k] || ACCENT(); }

function spawnShockwave(laneIndex, judgement, count) {
  const n = fxLite() ? 0 : 1;
  const col = fxColor(judgement), t = performance.now();
  for (let i = 0; i < n; i++) {
    if (fxRings.length >= 14) fxRings.shift();
    fxRings.push({ lane: laneIndex, col, t0: t + i * 70 });
  }
}

function spawnParticles(laneIndex, judgement, count) {
  const n = fxLite() ? 0 : Math.round(count * 0.4 * (COARSE ? 0.6 : 1));
  const col = fxColor(judgement), t = performance.now();
  const x = laneX(laneIndex, 1), y = FIELD.hitY, sc = Math.max(0.6, FIELD.lw / 110);
  for (let i = 0; i < n && fxParts.length < 48; i++) {
    fxParts.push({
      x, y, col, t0: t,
      a: (Math.PI * 2 * i / n) + Math.random() * 0.4,
      d: (60 + Math.random() * 70) * sc,
      r: 4.5,
    });
  }
}

function flashLane(i) { laneFlashUntil[i] = performance.now() + 160; }

function flashJudgementLine(laneIndex, judgement) {
  const j = String(judgement).toLowerCase();
  laneHitColor[laneIndex] = j === 'miss' ? '#e53935' : fxColor(j);
  laneHitUntil[laneIndex] = performance.now() + 180;
}

function beamHit(laneIndex, judgementName) {
  const j = JUDGE[judgementName];
  beamColor[laneIndex] = TH ? TH.hex : (j ? j.beam : '#ff5252');
  if (fxLight()) return;
  beamA[laneIndex] = judgementName === 'PERFECT' ? 1 : 0.85;
}

function setLanePressed(laneIndex, pressed) { lanePressedState[laneIndex] = pressed; }

function triggerScreenFlash() {
  screenFlash.classList.add('active');
  setTimeout(() => screenFlash.classList.remove('active'), 80);
}

function triggerMissFlash(kind) {
  missFlash.classList.toggle('bad', kind === 'bad');
  missFlash.classList.add('active');
  setTimeout(() => missFlash.classList.remove('active'), kind === 'bad' ? 130 : 180);
}

// Subtle screen shake: small, short, capped, and no forced reflow
let shakeAnim = null;
function shakeScreen(intensity) {
  if (fxLight()) return;                       // light mode: no shaking at all
  const s = Math.min(SHAKE_MAX, intensity * SHAKE_SCALE);
  if (s < 0.2) return;
  if (shakeAnim) shakeAnim.cancel();
  shakeAnim = game.animate([
    { transform: 'translate3d(0, 0, 0)' },
    { transform: `translate3d(${-s}px, ${0.6 * s}px, 0)`, offset: 0.25 },
    { transform: `translate3d(${0.9 * s}px, ${-0.7 * s}px, 0)`, offset: 0.5 },
    { transform: `translate3d(${-0.5 * s}px, ${-0.4 * s}px, 0)`, offset: 0.75 },
    { transform: 'translate3d(0, 0, 0)' },
  ], { duration: 110, easing: 'ease-out' });
}

// ---------- SAKURA PETALS (one small capped canvas) ----------
// A song can swap the petals for a word with   petalText: 'oaoeeee'   in songs.js: same count, same drifting, but the words sway gently instead of spinning.
const petals = (() => {
  const cv = mk('canvas', 'petals');
  const ctx = cv.getContext ? cv.getContext('2d') : null;
  const DEFAULT_COLORS = ['#ffb3d1', '#ffb3d1', '#9fd0ff', '#ffe08a', '#d98cff'];
  let COLORS = DEFAULT_COLORS;
  const TARGETS = COARSE ? [4, 6, 9, 12, 16] : [8, 14, 22, 32, 44];
  const sprites = [];
  const list = [];
  let w = 0, h = 0, dpr = 1, tier = 0, quality = 0.3, dirty = false;

  function makeSprite(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext ? c.getContext('2d') : null;
    if (!g) return c;
    g.translate(16, 16);
    g.fillStyle = color;
    g.globalAlpha = 0.95;
    g.beginPath();
    g.moveTo(0, 13);
    g.bezierCurveTo(-14, 3, -10, -14, 0, -8);
    g.bezierCurveTo(10, -14, 14, 3, 0, 13);
    g.fill();
    g.globalAlpha = 0.5;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(-2, -2, 3, 6, -0.4, 0, Math.PI * 2);
    g.fill();
    return c;
  }
  let textMode = false;
  function makeTextSprite(color, text) {                 // a small word with a soft dark outline so it reads on any background
    const c = document.createElement('canvas');
    const g = c.getContext ? c.getContext('2d') : null;
    const font = '900 30px system-ui, "Segoe UI", Arial, sans-serif';
    if (!g) { c.width = c.height = 32; return c; }
    g.font = font;
    c.width = Math.ceil(g.measureText(text).width) + 14;
    c.height = 44;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 6; g.strokeStyle = 'rgba(40,10,60,0.45)';
    g.strokeText(text, c.width / 2, c.height / 2 + 1);
    g.fillStyle = color; g.globalAlpha = 0.97;
    g.fillText(text, c.width / 2, c.height / 2 + 1);
    return c;
  }
  function makeFeather(color) {                          // a soft white feather: painted once, then reused like the petals
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const g = c.getContext ? c.getContext('2d') : null;
    if (!g) return c;
    g.translate(20, 20);
    g.shadowColor = 'rgba(235,242,255,0.9)'; g.shadowBlur = 5;
    g.fillStyle = color; g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(0, -15);
    g.bezierCurveTo(-10, -10, -10, 4, -1, 14);
    g.lineTo(1, 14);
    g.bezierCurveTo(10, 4, 10, -10, 0, -15);
    g.fill();
    g.shadowBlur = 0; g.globalAlpha = 0.55;
    g.strokeStyle = 'rgba(165,180,215,1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 17); g.stroke();                       // quill
    g.globalAlpha = 0.3; g.lineWidth = 0.8;
    g.beginPath();
    for (let y = -9; y <= 7; y += 4) { g.moveTo(0, y); g.lineTo(-6.5, y + 4.5); g.moveTo(0, y); g.lineTo(6.5, y + 4.5); }      // barbs
    g.stroke();
    return c;
  }
  let shape = null;
  function buildSprites(text) {
    sprites.length = 0;
    textMode = !!text;
    COLORS.forEach(c => sprites.push(text ? makeTextSprite(c, text) : shape === 'feather' ? makeFeather(c) : makeSprite(c)));
  }
  buildSprites(null);

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    dpr = COARSE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn(fromTop, fast) {
    list.push({
      x: Math.random() * w,
      y: fromTop ? -20 - Math.random() * h * 0.3 : Math.random() * h,
      vy: (fast ? 160 : 45) + Math.random() * (fast ? 160 : 55),
      sway: 18 + Math.random() * 30,
      phase: Math.random() * 6.28,
      freq: 0.6 + Math.random() * 0.9,
      rot: Math.random() * 6.28,
      r0: (Math.random() - 0.5) * 0.7,                   // resting tilt of a word
      vr: (Math.random() - 0.5) * 2.4,
      s: 0.45 + Math.random() * 0.5,
      a: 0.35 + Math.random() * 0.4,
      spriteIdx: tier,
      fast: !!fast,
    });
  }

  function target() {
    if (reduceMotion) return 0;
    return Math.round(TARGETS[tier] * quality);
  }

  let curText = null;
  return {
    setTier(t) { tier = t; },
    setText(text) {                                      // null = normal sakura petals
      text = text || null;
      if (text === curText) return;
      curText = text; buildSprites(text);
    },
    setQuality(q) { quality = q; },
    setColors(cols, shp) {                               // null = default sakura; shp 'feather' = feathers. Sprites are rebuilt once, not per frame
      COLORS = cols || DEFAULT_COLORS;
      shape = (cols && shp) || null;
      buildSprites(curText);
    },
    burst(count) {
      if (reduceMotion || fxLight() || songFx) return;   // songs with their own effect (moon...) have no petals
      for (let i = 0; i < count && list.length < 90; i++) spawn(true, true);
    },
    update(dt, t) {
      if (!ctx) return;
      tier = t;
      const sec = dt / 1000;
      const want = target();
      if (want === 0 && !list.length) {                  // lite mode: no petals at all, so no per-frame canvas work either
        if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; }
        return;
      }
      if (list.length < want && Math.random() < 0.25) spawn(true, false);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      dirty = true;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.y += p.vy * sec;
        p.phase += p.freq * sec;
        p.x += Math.sin(p.phase) * p.sway * sec;
        p.rot += p.vr * sec;
        if (p.y > h + 30) {
          if (list.length > want || p.fast) { list.splice(i, 1); continue; }
          p.y = -20; p.x = Math.random() * w; p.spriteIdx = tier;
        }
        const ang = textMode ? p.r0 + Math.sin(p.phase * 1.3) * 0.5 : p.rot;      // petals spin, words just sway
        const cos = Math.cos(ang) * p.s * dpr, sin = Math.sin(ang) * p.s * dpr;
        ctx.globalAlpha = p.a;
        ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
        const sp = sprites[p.spriteIdx];
        ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      list.length = 0;
      if (ctx && dirty) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        dirty = false;
      }
    },
  };
})();

// ---------- PER-SONG EFFECTS ----------
// A song opts in with   fx: 'moon'   in songs.js. The effect replaces the sakura petals for that song only.
// Every effect is { start(), update(dt), clear(), resize() }. To add another one, write it like moonFx and register it in SONG_FX.

// MOON: a huge moon behind the lanes. Calm until WHITE_AT combo -> glows white; RED_AT combo -> glows crimson;
// any combo break fades it back to calm. Sprites are painted once, and the canvas is only redrawn while the glow changes.
const MOON = {
  WHITE_AT: 100, RED_AT: 200,
  SIZE_W: 0.26, SIZE_H: 0.40,        // radius as a share of screen width / height (the smaller one wins)
  CENTER_Y: 0.40,                    // vertical centre of the moon, as a share of screen height
  SOFT: 0.5,                         // surface detail resolution (smaller = blurrier, 1 = sharp)
  BLUR: 0.03,                        // edge blur as a share of the moon radius
  UP_MS: 400, DOWN_MS: 600,          // fade time per glow level going up / back down
};
const moonFx = (() => {
  const cv = document.createElement('canvas');
  cv.id = 'moon-fx';
  game.insertBefore(cv, game.firstChild);                 // inside #game, under the lanes, and it shakes with the stage
  const c = cv.getContext('2d');
  const HALO = 1.4;                                       // sprite size = moon diameter * this (room for the glow)
  // Realistic moon: the surface (dark maria, fine texture, craters, bright ray craters, soft lighting) is painted procedurally once per size,
  // then tinted per glow state. Nothing here runs per frame.
  const T = [0, 0, 0];
  const STATES = [
    { rgb: '190,205,235', ha: 0.1, bloom: '215,225,245', ba: 0.1,          // calm: natural grey-cream moon
      tint(g, o) { o[0] = g * 0.95; o[1] = g * 0.93; o[2] = g * 0.88; } },
    { rgb: '255,250,240', ha: 0.5, bloom: '255,255,255', ba: 0.32,          // 100 combo: brilliant white
      tint(g, o) { const w = Math.min(1, g * 1.18 + 0.04); o[0] = w; o[1] = w; o[2] = Math.min(1, w * 1.03 + 0.02); } },
    { rgb: '255,34,56', ha: 0.5, bloom: '255,70,50', ba: 0.3,               // 200 combo: crimson blood moon
      tint(g, o) { o[0] = Math.min(1, g * 0.95 + 0.14); o[1] = g * g * 0.3; o[2] = g * g * 0.18; } },
  ];
  let spr = [], on = false, W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, vis = 0, L = 0, lastKey = '';
  let surf = null, surfKey = 0;

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hash(ix, iy) { let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; }
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c2 = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy;
  }
  function fbm(x, y, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }

  // grey moon disc of diameter d px: ImageData whose red channel is the brightness and alpha the (antialiased) edge
  function buildSurface(d) {
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = d;
    const x = cvs.getContext('2d', { willReadFrequently: true });
    const img = x.createImageData(d, d), px = img.data, r = d / 2;
    for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
      const dx = (i + 0.5 - r) / r, dy = (j + 0.5 - r) / r, rho2 = dx * dx + dy * dy;
      if (rho2 >= 1.02) continue;
      const rho = Math.sqrt(rho2), nz = Math.sqrt(Math.max(0, 1 - rho2));
      const a = Math.max(0, Math.min(1, (1 - rho) * r + 0.5));
      const mare = fbm(dx * 1.5 + 4.2, dy * 1.5 + 9.1, 4);                 // big dark seas
      const m = Math.max(0, Math.min(1, (mare - 0.40) / 0.36)), ms = m * m * (3 - 2 * m);
      const fine = fbm(dx * 9 + 1.7, dy * 9 + 5.3, 4) - 0.47;              // fine surface grain
      const alb = 0.82 - 0.26 * ms + fine * 0.14 * (1 - 0.5 * ms);
      const ndl = Math.max(0, dx * -0.32 + dy * -0.32 + nz * 0.89);        // light from the upper left, softly
      let gv = Math.min(1, alb * (0.7 + 0.3 * ndl) * (0.8 + 0.2 * Math.sqrt(nz)) * 1.12);
      gv = 0.64 + (gv - 0.64) * 0.72;                                      // hazy: less contrast, as if seen from far away
      const o = (j * d + i) * 4;
      px[o] = px[o + 1] = px[o + 2] = gv * 255; px[o + 3] = a * 255;
    }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';                            // craters only land on the moon
    const rnd = rng(48);
    const crater = (ux, uy, cr) => {                                       // ux, uy, cr in moon radii
      const rho = Math.hypot(ux, uy);
      if (rho > 0.97 || cr * r < 1.2) return;
      const nz = Math.sqrt(1 - rho * rho), rr = cr * r;
      x.save();
      x.translate(r + ux * r, r + uy * r);
      x.rotate(Math.atan2(uy, ux)); x.scale(Math.max(0.25, nz), 1);        // squashed toward the edge, like the real thing
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, rr);
      gr.addColorStop(0, 'rgba(0,0,0,0.09)'); gr.addColorStop(0.62, 'rgba(0,0,0,0.05)');
      gr.addColorStop(0.86, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, rr, 0, 6.2832); x.fill();
      x.restore();
    };
    for (let k = 0; k < 170; k++) {
      const a = rnd() * 6.2832, rad = Math.sqrt(rnd()) * 0.96;
      crater(Math.cos(a) * rad, Math.sin(a) * rad, 0.008 + 0.075 * Math.pow(rnd(), 3.2));
    }
    const rayCrater = (ux, uy, cr, rays, len) => {                         // bright young craters with ejecta rays
      x.save();
      x.translate(r + ux * r, r + uy * r);
      const hr = len * r * 0.5, hg = x.createRadialGradient(0, 0, 0, 0, 0, hr);
      hg.addColorStop(0, 'rgba(255,255,255,0.2)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = hg; x.beginPath(); x.arc(0, 0, hr, 0, 6.2832); x.fill();
      for (let k = 0; k < rays; k++) {
        const a = rnd() * 6.2832, l = len * r * (0.45 + 0.55 * rnd()), w = 0.03 + 0.04 * rnd();
        const lg = x.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
        lg.addColorStop(0, 'rgba(255,255,255,0.12)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = lg; x.beginPath(); x.moveTo(0, 0);
        x.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l); x.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l);
        x.closePath(); x.fill();
      }
      x.restore();
      crater(ux, uy, cr);
    };
    rayCrater(-0.12, 0.62, 0.05, 22, 0.5);
    rayCrater(-0.38, -0.02, 0.035, 12, 0.28);
    return x.getImageData(0, 0, d, d);
  }

  function build() {
    const drawD = 2 * R * HALO;                             // sprite size in CSS px
    const sc = Math.min(dpr, 900 / drawD);                  // never paint a huge sprite
    const size = Math.max(8, Math.ceil(drawD * sc)), m = size / 2, r = R * sc;
    const dd = Math.max(8, Math.ceil(r * 2));
    const sd0 = Math.max(8, Math.ceil(dd * MOON.SOFT));              // paint small, stretch up: soft focus
    if (!surf || surfKey !== sd0) { surf = buildSurface(sd0); surfKey = sd0; }
    spr = STATES.map(s => {
      const k = document.createElement('canvas');
      k.width = k.height = size;
      const g = k.getContext('2d');
      let h = g.createRadialGradient(m, m, r * 0.9, m, m, m);                 // wide glow
      for (const [p, f] of [[0, 1], [0.2, 0.55], [0.45, 0.2], [0.75, 0.05], [1, 0]]) h.addColorStop(p, `rgba(${s.rgb},${s.ha * f})`);   // long, gentle falloff
      g.fillStyle = h; g.fillRect(0, 0, size, size);
      h = g.createRadialGradient(m, m, r * 0.95, m, m, r * 1.18);             // tight bloom hugging the disc
      for (const [p, f] of [[0, 1], [0.4, 0.35], [1, 0]]) h.addColorStop(p, `rgba(${s.bloom},${s.ba * f})`);
      g.fillStyle = h; g.fillRect(0, 0, size, size);
      const out = new ImageData(sd0, sd0), sd = surf.data, od = out.data;       // the tinted surface
      for (let q = 0; q < sd.length; q += 4) {
        if (!sd[q + 3]) continue;
        s.tint(sd[q] / 255, T);
        od[q] = Math.min(255, T[0] * 255); od[q + 1] = Math.min(255, T[1] * 255); od[q + 2] = Math.min(255, T[2] * 255); od[q + 3] = sd[q + 3];
      }
      const dc = document.createElement('canvas'); dc.width = dc.height = sd0;
      dc.getContext('2d').putImageData(out, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      if ('filter' in g) g.filter = `blur(${(r * MOON.BLUR).toFixed(1)}px)`;   // soft edge (browsers without canvas filters just skip it)
      g.drawImage(dc, m - dd / 2, m - dd / 2, dd, dd);
      if ('filter' in g) g.filter = 'none';
      return k;
    });
  }

  function resize(force) {
    if (!on) return;
    const w = game.clientWidth, h = game.clientHeight;
    if (!w || !h) return;
    let d = COARSE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);   // the moon is soft-focus anyway: 1x on phones (about half the memory)
    while (w * h * d * d > 2.5e6 && d > 1) d = Math.max(1, d - 0.25);
    if (!force && w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    R = Math.min(w * MOON.SIZE_W, h * MOON.SIZE_H);
    cx = w / 2; cy = h * MOON.CENTER_Y;
    build();
    lastKey = '';
  }

  function draw() {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    if (vis <= 0.01 || !spr.length) return;
    const dsz = 2 * R * HALO * dpr;
    const x = cx * dpr - dsz / 2, y = cy * dpr - dsz / 2;
    const i = Math.min(1, Math.floor(L)), f = L - i;        // crossfade: lower glow level underneath, next level fading in on top
    c.globalAlpha = vis;
    c.drawImage(spr[i], x, y, dsz, dsz);
    if (f > 0.005) { c.globalAlpha = vis * f; c.drawImage(spr[i + 1], x, y, dsz, dsz); }
    c.globalAlpha = 1;
  }

  return {
    start() {
      on = true; vis = 0; L = 0; lastKey = '';
      cv.style.display = 'block';
      cv.classList.remove('lit');
      resize(true);
    },
    clear() {
      on = false;
      cv.style.display = 'none';
      cv.classList.remove('lit');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
    },
    resize,
    update(dt) {
      if (!on) return;
      if (!W) { resize(true); if (!W) return; }
      const target = combo >= MOON.RED_AT ? 2 : combo >= MOON.WHITE_AT ? 1 : 0;
      if (L !== target) {
        const step = dt / (target > L ? MOON.UP_MS : MOON.DOWN_MS);
        L = target > L ? Math.min(target, L + step) : Math.max(target, L - step);
      }
      if (vis < 1) vis = Math.min(1, vis + dt / 900);
      const key = vis.toFixed(2) + '|' + L.toFixed(2);
      if (key === lastKey) return;                          // nothing changed: no repaint
      lastKey = key;
      draw();
      cv.classList.toggle('lit', L > 0.5);
    },
  };
})();

// SPARKLER: the stage starts dark. 50 combo lights one sparkler, 100 combo lights more and brightens the stage, 200 combo keeps that
// and sends up two big fireworks, one after the other, in the middle; 300 combo sends up two more and then one extra finale
// (each again if the combo is lost and reaches it again).
// A combo break fades everything back to dark. Look: soft, slightly blurred and subtle: a small warm core, a wide amber glow that
// blends into the stage, and thin sparks that fly out, arc down and cool from pale yellow to deep orange (no stick, no spiky rays). Soft sprites + one low-resolution canvas + fixed particle pools keep it light; it draws behind the lanes.
const SPARK = {
  FIRST_AT: 50, MORE_AT: 100, FIREWORK_AT: 200, FIREWORK2_AT: 300,
  DARK: 0.5,                                             // how dark the stage is before any sparkler is lit (0..1)
  SPOTS: [[0.14, 0.64], [0.86, 0.58], [0.22, 0.30], [0.78, 0.26]],   // sparkler tips as a share of width / height (first one lights at 50)
  // fireworks: x, y = burst centre (share of width / height), size = burst radius as a share of height, delay = seconds after 200 combo
  FIREWORKS: [
    { x: 0.5, y: 0.32, size: 0.40, delay: 0,   col: 0 },
    { x: 0.5, y: 0.27, size: 0.48, delay: 1.5, col: 1 },
  ],
  // at 300 combo: two bursts again, then one more big finale
  FIREWORKS2: [
    { x: 0.36, y: 0.30, size: 0.38, delay: 0,   col: 0 },
    { x: 0.64, y: 0.27, size: 0.42, delay: 1.2, col: 1 },
    { x: 0.5,  y: 0.24, size: 0.55, delay: 2.6, col: 2 },
  ],
  UP_MS: 700, DOWN_MS: 500,                              // fade time per light level
};
const FW_COLS = [{ hi: 'rgb(255,242,205)', lo: 'rgb(255,168,72)' }, { hi: 'rgb(255,232,215)', lo: 'rgb(255,140,115)' }, { hi: 'rgb(255,226,185)', lo: 'rgb(255,118,88)' }];

// firework sounds (synthesized, same sound bus as the other effects)
function fireworkSound(kind) {
  try {
    ensureAudio();
    if (kind === 'launch') {                              // rising whistle
      uTone(520, { dur: 0.58, to: 1900, vol: 0.05, lp: 3200 });
      uNoise({ type: 'bandpass', from: 900, to: 3600, dur: 0.5, vol: 0.05, q: 2 });
    } else {                                              // boom + crack + crackle
      uTone(95, { dur: 0.4, to: 38, vol: 0.34 });
      uNoise({ type: 'lowpass', from: 2600, to: 300, dur: 0.24, vol: 0.22, q: 0.7 });
      uNoise({ type: 'highpass', from: 5000, dur: 0.06, vol: 0.1 });
      for (let k = 0; k < 6; k++) uNoise({ at: 0.1 + Math.random() * 0.95, type: 'highpass', from: 4500 + Math.random() * 3500, dur: 0.03, vol: 0.04 + Math.random() * 0.05 });
    }
  } catch (e) { /* audio unavailable */ }
}

const sparklerFx = (() => {
  const cv = document.createElement('canvas');
  cv.id = 'sparkler-fx';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;z-index:0;';
  game.insertBefore(cv, game.firstChild);
  const c = cv.getContext('2d');
  const K = COARSE ? 0.32 : 0.4;                          // low backing resolution: much cheaper, and the stretched-up canvas gives the soft look                         // backing resolution: the glow is soft anyway
  const MAXP = COARSE ? 60 : 100, MAXF = COARSE ? 130 : 200;
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

  function sprite(size, stops) {
    const k = document.createElement('canvas');
    k.width = k.height = size;
    const g = k.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return k;
  }
  const GLOW = sprite(128, [[0, 'rgba(255,215,150,0.55)'], [0.3, 'rgba(255,170,80,0.2)'], [1, 'rgba(255,120,40,0)']]);   // firework flash
  const SGLOW = sprite(128, [[0, 'rgba(255,196,120,0.34)'], [0.25, 'rgba(255,150,70,0.17)'], [0.6, 'rgba(230,100,45,0.06)'], [1, 'rgba(200,80,30,0)']]);   // sparkler light: wide, amber, fades out softly
  const CORE = sprite(64, [[0, 'rgba(255,244,222,0.85)'], [0.2, 'rgba(255,224,170,0.6)'], [0.5, 'rgba(255,175,95,0.2)'], [1, 'rgba(255,140,60,0)']]);
  const DOT = sprite(32, [[0, 'rgba(255,250,235,1)'], [0.25, 'rgba(255,225,160,0.7)'], [0.6, 'rgba(255,170,70,0.18)'], [1, 'rgba(255,140,40,0)']]);
  // fixed pools: no allocation while playing
  function pool(n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ x: 0, y: 0, vx: 0, vy: 0, l: 0, m: 1, w: 1, g: 0, d: 1, o: 1, st: -1, c: 0 });
    let i = 0;
    return {
      a,
      add(x, y, vx, vy, life, w, grav, drag, op, st, col) {
        let p = null;
        for (let t = 0; t < n; t++) { const q = a[i]; i = (i + 1) % n; if (q.l <= 0) { p = q; break; } }
        if (!p) { p = a[i]; i = (i + 1) % n; }            // pool full: recycle the next one
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.l = p.m = life; p.w = w; p.g = grav; p.d = drag; p.o = op; p.st = st; p.c = col;
      },
      step(sec) {
        let alive = 0;
        for (let k = 0; k < n; k++) {
          const p = a[k];
          if (p.l <= 0) continue;
          p.l -= sec;
          if (p.l <= 0) continue;
          alive++;
          const e = Math.exp(-p.d * sec);
          p.vx *= e; p.vy = p.vy * e + p.g * sec;
          p.x += p.vx * sec; p.y += p.vy * sec;
        }
        return alive;
      },
      reset() { for (let k = 0; k < n; k++) a[k].l = 0; },
    };
  }
  const S = pool(MAXP), FWP = pool(MAXF);

  let on = false, W = 0, H = 0, sc = 1, vis = 0, Lv = 0, fired = [false, false], lastKey = '', tms = 0, drawAcc = 0;
  const fwList = [];
  const act = [0, 0, 0, 0], acc = [0, 0, 0, 0], accS = [0, 0, 0, 0], tipX = [0, 0, 0, 0], tipY = [0, 0, 0, 0];
  const TL = 0.065, TLF = 0.05;                          // streak length per unit of speed

  function resize(force) {
    if (!on) return;
    const w = game.clientWidth, h = game.clientHeight;
    if (!w || !h) return;
    if (!force && w === W && h === H) return;
    W = w; H = h; sc = Math.max(0.7, Math.min(w, h) / 360);
    cv.width = Math.round(w * K); cv.height = Math.round(h * K);
    lastKey = '';
  }

  function burstFw(f) {
    const R = f.spec.size * H, d = 2.1;
    const n = fxLite() ? 12 : 22;
    for (let k = 0; k < n; k++) {
      const a = (6.2832 * k) / n + (Math.random() - 0.5) * 0.12, r = Math.random();
      let v, life, grav, w;
      if (r < 0.25) { v = R * d * (0.4 + 0.12 * Math.random()); life = 1.0 + 0.5 * Math.random(); grav = 40 * sc; w = 1.5 * sc; }            // soft inner ring
      else if (r < 0.65) { v = R * d * (0.8 + 0.25 * Math.random()); life = 1.3 + 0.6 * Math.random(); grav = 50 * sc; w = 2.2 * sc; }    // main shell
      else { v = R * d * (0.7 + 0.2 * Math.random()); life = 1.8 + 0.8 * Math.random(); grav = 150 * sc; w = 1.6 * sc; }                  // drooping glitter
      FWP.add(f.x, f.cy, Math.cos(a) * v, Math.sin(a) * v, life, w, grav, d, 0.9, -1, f.spec.col);
    }
    f.burst = true; f.flash = 1;
    fireworkSound('burst');
  }

  return {
    start() {
      on = true; vis = 0; Lv = 0; fired[0] = fired[1] = false; lastKey = ''; tms = 0;
      act.fill(0); acc.fill(0); accS.fill(0);
      S.reset(); FWP.reset(); fwList.length = 0;
      cv.style.display = 'block';
      resize(true);
    },
    clear() {
      on = false; fwList.length = 0;
      cv.style.display = 'none';
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
    },
    resize,
    update(dt) {
      if (!on) return;
      if (!W) { resize(true); if (!W) return; }
      const sec = dt / 1000;
      tms += dt;

      // light level follows the combo (0 dark, 1 first sparkler, 2 more sparklers); it fades both ways
      const target = combo >= SPARK.MORE_AT ? 2 : combo >= SPARK.FIRST_AT ? 1 : 0;
      if (Lv !== target) {
        const st = dt / (target > Lv ? SPARK.UP_MS : SPARK.DOWN_MS);
        Lv = target > Lv ? Math.min(target, Lv + st) : Math.max(target, Lv - st);
      }
      if (vis < 1) vis = Math.min(1, vis + dt / 900);
      let anyAct = false;
      for (let i = 0; i < 4; i++) {
        const th = i === 0 ? 0 : 1 + (i - 1) * 0.15, span = i === 0 ? 0.6 : 0.45;   // the extra sparklers light up one after another
        act[i] = clamp01((Lv - th) / span);
        if (act[i] > 0.001) anyAct = true;
        tipX[i] = SPARK.SPOTS[i][0] * W + Math.sin(tms / 310 + i * 2.1) * 3 * sc;      // a hand-held sparkler wobbles a little
        tipY[i] = SPARK.SPOTS[i][1] * H + Math.cos(tms / 270 + i) * 3 * sc;
      }

      // fireworks: two in a row at 200 combo, two more plus a finale at 300; a combo break cancels the ones that have not launched yet
      for (let ti = 0; ti < 2; ti++) {
        const at = ti ? SPARK.FIREWORK2_AT : SPARK.FIREWORK_AT, list = ti ? SPARK.FIREWORKS2 : SPARK.FIREWORKS;
        if (combo >= at) {
          if (!fired[ti]) {
            fired[ti] = true;
            for (const spec of list) fwList.push({ tier: ti, spec, x: spec.x * W, y0: H * 0.92, ty: spec.y * H, cy: H * 0.92, wait: spec.delay, t: 0, launched: false, burst: false, flash: 0, acc: 0 });
          }
        } else {
          fired[ti] = false;
          for (let i = fwList.length - 1; i >= 0; i--) if (!fwList[i].launched && fwList[i].tier === ti) fwList.splice(i, 1);
        }
      }

      const light = fxLite();
      // streaks + star sparks from every lit sparkler tip
      const rate = (COARSE ? 18 : 30) * (light ? 0.25 : 0.5), srate = (COARSE ? 3 : 5) * (light ? 0.25 : 0.5);
      for (let i = 0; i < 4; i++) {
        if (act[i] <= 0.001) { acc[i] = 0; accS[i] = 0; continue; }
        acc[i] += rate * act[i] * sec;
        while (acc[i] >= 1) {
          acc[i]--;
          const a = Math.random() * 6.2832, sp = (60 + Math.random() * 170) * sc;
          S.add(tipX[i], tipY[i], Math.cos(a) * sp, Math.sin(a) * sp - 20 * sc, 0.3 + Math.random() * 0.5, (0.6 + Math.random() * 0.5) * sc, 230 * sc, 1.8, 0.8, -1, 0);
        }
        accS[i] += srate * act[i] * sec;
        while (accS[i] >= 1) {
          accS[i]--;
          const a = Math.random() * 6.2832, sp = (20 + Math.random() * 90) * sc;
          S.add(tipX[i], tipY[i], Math.cos(a) * sp, Math.sin(a) * sp - 10 * sc, 0.12 + Math.random() * 0.22, (1.2 + Math.random() * 1.2) * sc, 120 * sc, 2.4, 0.8, 0, 0);
        }
      }

      // fireworks: whistle + short rise, then a big burst
      for (let i = fwList.length - 1; i >= 0; i--) {
        const f = fwList[i];
        f.wait -= sec;
        if (f.wait > 0) continue;
        if (!f.launched) { f.launched = true; fireworkSound('launch'); }
        if (!f.burst) {
          f.t += sec;
          const p = Math.min(1, f.t / 0.6);
          f.cy = f.y0 + (f.ty - f.y0) * (1 - (1 - p) * (1 - p));
          f.acc += 40 * sec;
          while (f.acc >= 1) { f.acc--; S.add(f.x + (Math.random() - 0.5) * 3 * sc, f.cy, (Math.random() - 0.5) * 20 * sc, 30 * sc, 0.25 + Math.random() * 0.2, 1.4 * sc, 80 * sc, 1.5, 0.7, -1, 0); }
          if (p >= 1) burstFw(f);
        } else {
          f.flash -= sec * 2.4;
          if (f.flash <= 0) fwList.splice(i, 1);
        }
      }

      const alive = S.step(sec) + FWP.step(sec);
      const key = vis.toFixed(2) + '|' + Lv.toFixed(2);
      if (!alive && !anyAct && !fwList.length && key === lastKey) return;      // dark and still: nothing to repaint
      drawAcc += dt;
      if (drawAcc < (fxLite() ? 100 : 66)) return;                                                // repaint at ~25 fps: less than half the drawing cost, looks the same for soft glows
      drawAcc = 0;
      lastKey = key;

      // ---- draw ----
      c.setTransform(K, 0, 0, K, 0, 0);
      c.clearRect(0, 0, W, H);
      const D = SPARK.DARK * (1 - 0.36 * Math.min(Lv, 1) - 0.42 * Math.max(0, Lv - 1));
      c.fillStyle = `rgba(16,5,4,${(D * vis).toFixed(3)})`;      // warm dark, not blue-black
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      const boost = 0.6 + 0.4 * clamp01(Lv - 1);                               // the stage gets brighter at the second level
      for (let i = 0; i < 4; i++) {
        if (act[i] <= 0.001) continue;
        const tx = tipX[i], ty = tipY[i], a0 = act[i] * vis;
        const flick = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(tms / 61 + i * 1.7) * Math.sin(tms / 37 + i * 2.9) + 0.5 * Math.sin(tms / 23 + i));   // uneven, like a real flame
        const r = H * (i === 0 ? 0.42 : 0.37);
        c.globalAlpha = a0 * flick * boost;                                    // wide warm light that blends into the stage
        c.drawImage(SGLOW, tx - r, ty - r, 2 * r, 2 * r);
        const cr = 8 * sc * (0.9 + 0.2 * flick);                                // small warm core, no hard edge
        c.globalAlpha = a0 * 0.7;
        c.drawImage(CORE, tx - cr, ty - cr, 2 * cr, 2 * cr);
      }
      // sparks: pale yellow while young, amber, then deep orange as they cool; each has a short fading tail and a soft glowing head
      for (let pass = 0; pass < 3; pass++) {
        c.strokeStyle = pass === 0 ? 'rgb(255,228,175)' : pass === 1 ? 'rgb(255,172,82)' : 'rgb(232,104,46)';
        for (let k = 0; k < MAXP; k++) {
          const p = S.a[k];
          if (p.l <= 0 || p.st >= 0) continue;
          const f = p.l / p.m;
          if ((f > 0.6 ? 0 : f > 0.28 ? 1 : 2) !== pass) continue;
          c.globalAlpha = Math.min(1, f * 2) * p.o * vis * 0.5;
          c.lineWidth = p.w * (0.6 + 0.4 * f);
          c.beginPath(); c.moveTo(p.x - p.vx * TL, p.y - p.vy * TL); c.lineTo(p.x, p.y); c.stroke();
        }
      }
      for (let k = 0; k < MAXP; k++) {
        const p = S.a[k];
        if (p.l <= 0) continue;
        const f = p.l / p.m;
        if (p.st < 0) {                                                         // soft head of a spark
          if (k % 3) continue;                                                  // heads on every other spark only
          const s = 2.6 * sc * (0.6 + 0.4 * f);
          c.globalAlpha = Math.min(1, f * 2) * vis * 0.5;
          c.drawImage(DOT, p.x - s, p.y - s, 2 * s, 2 * s);
        } else {                                                                // tiny fork: a quick bright twinkle
          const s = p.w * (0.5 + 0.5 * f);
          c.globalAlpha = Math.min(1, f * 2) * (0.4 + 0.6 * Math.abs(Math.sin(tms / 16 + k * 2.3))) * vis * 0.5;
          c.drawImage(DOT, p.x - s, p.y - s, 2 * s, 2 * s);
        }
      }
      // fireworks
      for (const f of fwList) {
        if (f.wait > 0) continue;
        if (!f.burst) {
          const s = 6 * sc;
          c.globalAlpha = 0.85 * vis;
          c.drawImage(DOT, f.x - s, f.cy - s, 2 * s, 2 * s);
        } else {
          const r = H * 0.42 * (1 + (1 - f.flash) * 0.3);
          c.globalAlpha = Math.max(0, f.flash) * 0.5 * vis;
          c.drawImage(GLOW, f.x - r, f.cy - r, 2 * r, 2 * r);
        }
      }
      for (let k = 0; k < MAXF; k++) {
        const p = FWP.a[k];
        if (p.l <= 0) continue;
        const f = p.l / p.m, col = FW_COLS[p.c];
        c.strokeStyle = f > 0.45 ? col.hi : col.lo;
        c.globalAlpha = Math.min(1, f * 1.5) * p.o * vis * 0.9;
        c.lineWidth = p.w * (0.6 + 0.4 * f);
        c.beginPath(); c.moveTo(p.x - p.vx * TLF, p.y - p.vy * TLF); c.lineTo(p.x, p.y); c.stroke();
        if (k % 6 === 0) { const s = 3 * sc * (0.5 + 0.5 * f); c.drawImage(DOT, p.x - s, p.y - s, 2 * s, 2 * s); }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    },
  };
})();

const SONG_FX = { moon: moonFx, sparkler: sparklerFx };

function applySongFx(song) {
  clearSongFx();
  songFx = (song && song.fx && SONG_FX[song.fx]) || null;
  if (songFx) { try { songFx.start(); } catch (e) { console.warn('song effect failed to start', e); try { songFx.clear(); } catch (e2) { /* ignore */ } songFx = null; } }
}
function clearSongFx() {
  if (songFx) { try { songFx.clear(); } catch (e) { /* ignore */ } songFx = null; }
  clearSongTheme();
}

// ---------- SONG THEME (crimson) ----------
// One static gradient layer (opacity only, so it costs nothing to animate) + recoloured sprites. No filters, no blend modes, no per-frame work.
const atmo = (() => {
  const el = document.createElement('div');
  el.id = 'theme-atmo';
  el.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;display:none;opacity:0;transition:opacity .6s ease;' +
    'background:radial-gradient(ellipse at 50% 38%,rgba(190,12,48,0.34) 0%,rgba(120,6,32,0.46) 45%,rgba(40,0,10,0.72) 100%);';
  game.insertBefore(el, game.firstChild);
  return el;
})();
let themeTierShown = -1;
function setThemeTier(t) {
  if (!TH || t === themeTierShown) return;
  themeTierShown = t;
  atmo.style.opacity = TH.atmoOpacity[t];
}
function applySongTheme(song) {
  const name = song && song.theme;
  const next = (name && THEMES[name]) || null;
  if (next === TH) { if (TH) { themeTierShown = -1; setThemeTier(0); } return; }
  TH = next;
  COLS_NOW = TH ? NOTE_COLS.map((c, i) => TH.notes[i] || c) : NOTE_COLS;
  for (let i = 0; i < 4; i++) { beamColor[i] = laneHitColor[i] = ACCENT(); }
  petals.setColors(TH ? TH.petals : null, TH ? TH.petalShape : null);
  tierGlow.style.display = TH ? 'none' : '';                 // replaced by the theme atmosphere
  beatPulse.style.background = TH ? TH.pulse : '';
  screenFlash.style.background = TH ? TH.flash : '';
  if (TH) atmo.style.background = TH.atmo;
  atmo.style.display = TH ? 'block' : 'none';
  themeTierShown = -1;
  if (TH) { atmo.style.transition = 'none'; atmo.style.opacity = 0; void atmo.offsetWidth; atmo.style.transition = ''; setThemeTier(0); }
  else atmo.style.opacity = 0;
  if (FIELD.W) { buildSprites(); drawStatic(); }
}
function clearSongTheme() { if (TH) applySongTheme(null); }
// a song effect must never be able to stop the song: if it ever throws, it is switched off for the rest of the run
function songFxUpdate(dt) {
  try { songFx.update(dt); } catch (e) { console.warn('song effect failed', e); clearSongFx(); }
}

function setLowFx(v) {
  lowFx = v;
  perfBad = perfGood = 0;
  petals.setQuality(v ? 0 : 0.3);
  document.body.classList.toggle('lite-fx', v);        // CSS (injected below): hides the hit flash and tier glow
  if (v) {
    beatPulse.style.opacity = 0; lastBeatOpacity = 0;
    fxParts.length = 0; fxRings.length = 0; fxPops.length = 0;
  }
  setStatus(status.textContent.split('\n')[0] + (v ? '\nlite-fx mode' : ''));
  measureLane();                                       // light mode also renders the playfield at 1x resolution (one small hitch at the switch)
}

// normal mode = the old light mode, always on. CSS: hides the beat glow layer, freezes the cheering-card bounce
document.body.classList.add('low-fx');
petals.setQuality(0.3);
beatPulse.style.opacity = 0; lastBeatOpacity = 0;
(function addLiteStyles() {
  const st = document.createElement('style');
  st.textContent = 'body.lite-fx #screen-flash, body.lite-fx #tier-glow { display: none !important; }';
  document.head.appendChild(st);
})();

// Watches the frame rate. If the device struggles, it drops from normal to lite mode on its own.
function trackPerformance(dt) {
  if (dt > SPIKE_FRAME_MS) {              // one very long frame: the phone was busy elsewhere. Go light right away and let it recover
    spikeUntil = performance.now() + SPIKE_LIGHT_MS;
    fxParts.length = 0; fxRings.length = 0;
    beatPulse.style.opacity = 0; lastBeatOpacity = 0;
  } else {
    frameEma += (dt - frameEma) * 0.05;
  }
  if (!lowFx) {
    // below ~48 fps for about one second -> light mode (it used to wait for ~38 fps and 1.5 s)
    if (performance.now() - playBeganAt < WARMUP_MS) perfBad = 0;     // first 2 s: no resize / mode switch while the audio is still starting up
    else if (frameEma > 21) { if (++perfBad > 50) { if (++lowFlips >= 2) lowLock = true; setLowFx(true); } } else perfBad = 0;
  } else if (!lowLock) {
    if (frameEma < 17.5) { if (++perfGood > 600) setLowFx(false); } else perfGood = 0;
  }
}

// ---------- NUMBER POPS ----------
function popScore() {
  const t = performance.now();
  if (t - lastPopScore < 90) return;
  lastPopScore = t;
  scoreEl.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 200, easing: 'ease-out' }
  );
}

function popCombo() {
  if (comboEl.classList.contains('milestone')) return;
  if (comboEl.classList.contains('broke')) return;
  const t = performance.now();
  if (t - lastPopCombo < 90) return;
  lastPopCombo = t;
  comboEl.animate(
    [
      { transform: 'translateX(-50%) scale(1)' },
      { transform: 'translateX(-50%) scale(1.1)', offset: 0.4 },
      { transform: 'translateX(-50%) scale(1)' }
    ],
    { duration: 130, easing: 'ease-out' }
  );
}

function pulseScore() {
  const t = performance.now();
  if (t - lastScorePulse < 150) return;
  lastScorePulse = t;
  scoreEl.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.5 }, { transform: 'scale(1)' }],
    { duration: 150, easing: 'ease-out' }
  );
}

// ---------- COMBO TIERS ----------
function getTier(c) {
  if (c >= TIER_STEPS[3]) return 4;
  if (c >= TIER_STEPS[2]) return 3;
  if (c >= TIER_STEPS[1]) return 2;
  if (c >= TIER_STEPS[0]) return 1;
  return 0;
}

let shownCombo = -1;
function setComboHidden() {
  comboEl.className = 'off';
  shownCombo = -1;
}

function updateComboVisuals() {
  const tier = getTier(combo);
  if (combo >= COMBO_SHOW_FROM) {
    if (shownCombo !== combo) {
      comboNumEl.textContent = combo;
      shownCombo = combo;
    }
    const cls = tier > 0 ? `tier-${tier}` : '';
    // keep the class stable so CSS animations are not restarted
    if (comboEl.className !== cls && !(comboEl.classList.contains('milestone') && cls === comboEl.className.replace(' milestone', ''))) {
      const keep = comboEl.classList.contains('milestone') ? ' milestone' : '';
      comboEl.className = cls + keep;
    }
  } else if (!comboEl.classList.contains('broke')) {
    setComboHidden();
  } else if (combo === 0) {
    // leave the "broken" animation alone
  }
  const ts = '' + tier;                                       // only touch <body> when the tier really changed (it restyles a lot of CSS)
  if (document.body.getAttribute('data-tier') !== ts) document.body.setAttribute('data-tier', ts);
  petals.setTier(tier);
  setThemeTier(tier);
}

function showBrokenCombo(prev) {
  if (prev < 5) return;
  comboNumEl.textContent = prev;
  shownCombo = -1;
  comboEl.className = `tier-${getTier(prev)} broke`;
}

// ---------- HUD ----------
function updateScoreboard() {
  updateComboVisuals();
}

function updateLife() {
  const left = Math.max(0, 1 - missCount / missLimit);
  lifeFill.style.transform = `scaleX(${left})`;
  lifeEl.classList.toggle('low', left <= 0.35);
}

function showJudgement(text, color) {
  judgementEl.textContent = text;
  judgementEl.style.color = color;
  const miss = text === 'MISS' || text === 'BAD';
  if (judgeAnim) judgeAnim.cancel();
  // no tilt, no travel: it appears in place, holds for a beat, fades out
  judgeAnim = judgementEl.animate([
    { transform: 'translateX(-50%) scale(1.12)', opacity: 0 },
    { transform: 'translateX(-50%) scale(1)', opacity: 1, offset: 0.15 },
    { transform: 'translateX(-50%) scale(1)', opacity: 1, offset: 0.6 },
    { transform: 'translateX(-50%) scale(1)', opacity: 0 },
  ], { duration: miss ? 480 : 400, easing: 'ease-out' });
}

// Shows EARLY / LATE for anything that is not PERFECT, so players can see how to improve
function showTiming(name, signedDiff) {
  if (name === 'PERFECT') { timingEl.style.opacity = 0; return; }
  const early = signedDiff < 0;
  timingEl.textContent = early ? 'EARLY' : 'LATE';
  timingEl.style.color = early ? '#7fc4ff' : '#ffab66';
  if (timingAnim) timingAnim.cancel();
  timingAnim = timingEl.animate([
    { transform: 'translateX(-50%)', opacity: 0 },
    { transform: 'translateX(-50%)', opacity: 0.85, offset: 0.15 },
    { transform: 'translateX(-50%)', opacity: 0.85, offset: 0.6 },
    { transform: 'translateX(-50%)', opacity: 0 },
  ], { duration: 400, easing: 'ease-out' });
}

const TIER_NAMES = { 1: 'COOL!', 2: 'SUPER!', 3: 'MANTAP!', 4: 'ANJIR!' };
function showTierBanner(tier, c, isTierUp) {
  tbTitle.textContent = isTierUp ? TIER_NAMES[tier] : `${c} COMBO!`;
  tbSub.textContent = isTierUp ? `${c} COMBO` : '';
  tierBanner.className = 't' + Math.max(1, tier);
  if (bannerAnim) bannerAnim.cancel();
  bannerAnim = tierBanner.animate([
    { transform: 'translateX(-50%)', opacity: 0 },
    { transform: 'translateX(-50%)', opacity: 0.95, offset: 0.12 },
    { transform: 'translateX(-50%)', opacity: 0.95, offset: 0.7 },
    { transform: 'translateX(-50%)', opacity: 0 },
  ], { duration: 900, easing: 'ease-out' });
}

function handleComboIncrement() {
  const stepIdx = TIER_STEPS.indexOf(combo);
  const isTierUp = stepIdx >= 0;
  const isMilestone = isTierUp || (combo >= 300 && combo % 100 === 0);
  if (!isMilestone) return;

  playComboSound(combo);
  comboEl.classList.remove('milestone');
  void comboEl.offsetWidth;
  comboEl.classList.add('milestone');
  setTimeout(() => comboEl.classList.remove('milestone'), 400);

  showTierBanner(isTierUp ? stepIdx + 1 : getTier(combo), combo, isTierUp);
  petals.burst(isTierUp ? 26 : 14);
  kick = Math.min(1, kick + 0.5);
  if (combo >= 100) triggerScreenFlash();
  shakeScreen(1.6 + getTier(combo) * 0.4);
}

// ---------- NOTE TOKEN ----------
// Notes are drawn on the canvas; `n.el` is only a flag meaning "this note is on screen".
const NOTE_TOKEN = { classList: { add() {}, remove() {} } };
function acquireNoteEl(n) { n.h = -1; return NOTE_TOKEN; }

// ---------- NOTES ----------
function clearNotes() {
  for (let i = 0; i < active.length; i++) {
    const n = active[i];
    n.el = null;
  }
  active = [];
  fxPops.length = 0; fxRings.length = 0; fxParts.length = 0;
}

function buildQueue(chart) {
  clearNotes();
  queue = [];
  chart.forEach(c => {
    if (!c) return;
    const time = Number(c.time);
    const lane = Number(c.lane);
    if (!Number.isFinite(time) || !Number.isInteger(lane) || lane < 0 || lane > 3) return;
    const dur = Number(c.duration);
    queue.push({
      time, lane,
      dur: dur > 0 ? dur : 0,
      judged: false, holding: false,
      lastTick: 0, headJ: null,
      el: null, h: -1,
    });
  });
  queue.sort((a, b) => a.time - b.time);
  laneQueues = [[], [], [], []];
  laneHead = [0, 0, 0, 0];
  queue.forEach(n => laneQueues[n.lane].push(n));
  spawnIdx = 0;
}

function removeNoteAnimated(n) {
  n.judged = true;
  if (n.el) {
    n.el = null;
    if (fxPops.length < 12) fxPops.push({ lane: n.lane, t0: performance.now(), v: tierVariant() });
  }
}

function removeNote(n) {
  n.judged = true;
  n.el = null;
}

// ---------- LANE DOWN/UP ----------
function laneDown(lane) {
  if (mode === 'countdown') {            // allow pre-pressing a held key during the countdown
    pressedLanes.add(lane);
    setLanePressed(lane, true);
    return;
  }
  if (mode !== 'playing') return;
  if (pressedLanes.has(lane)) return;

  pressedLanes.add(lane);
  setLanePressed(lane, true);
  beamColor[lane] = ACCENT();

  const now = getSongTime();
  const q = laneQueues[lane];
  let h = laneHead[lane];
  while (h < q.length && (q[h].judged || q[h].holding)) h++;
  laneHead[lane] = h;

  let best = null, bestDiff = Infinity, bestSigned = 0;
  for (let i = h; i < q.length; i++) {
    const n = q[i];
    if (n.judged || n.holding) continue;
    const signed = now - n.time;
    if (signed < -MAX_WINDOW) break;     // sorted: everything after is even later
    const diff = Math.abs(signed);
    if (diff <= MAX_WINDOW && diff < bestDiff) { best = n; bestDiff = diff; bestSigned = signed; }
  }

  if (best) {
    if (best.dur > 0) startHold(best, bestDiff, bestSigned);
    else judgeTap(best, bestSigned);
  } else {
    flashLane(lane);
    try { playEmptyTap(lane); } catch (e) { /* audio unavailable */ }
  }
}

function laneUp(lane) {
  if (pressedLanes.has(lane)) {
    pressedLanes.delete(lane);
    setLanePressed(lane, false);
  }

  if (mode === 'playing') {
    const now = getSongTime();
    for (let i = 0; i < active.length; i++) {
      const n = active[i];
      if (n.judged || !n.holding || n.lane !== lane) continue;
      const endTime = n.time + n.dur;
      if (now < endTime - HOLD_GRACE) breakHold(n);
      else completeHold(n);
    }
  }
}

// ---------- JUDGEMENT ----------
function classify(diffMs) {
  if (diffMs <= HIT_WINDOWS.PERFECT) return JUDGE.PERFECT;
  if (diffMs <= HIT_WINDOWS.GREAT) return JUDGE.GREAT;
  if (diffMs <= HIT_WINDOWS.GOOD) return JUDGE.GOOD;
  return JUDGE.BAD;
}

function judgeTap(n, signedDiff) {
  const lane = n.lane;
  const j = classify(Math.abs(signedDiff));
  const name = j.name;
  const isBad = name === 'BAD';
  const prevCombo = combo;

  stats[name]++;
  judgedCount++;

  if (isBad) {
    combo = 0;
  } else {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  }
  addScore(j.points);

  showJudgement(name, j.color);
  showTiming(name, signedDiff);
  updateScoreboard();
  flashLane(lane);
  flashJudgementLine(lane, isBad ? 'miss' : name);
  beamHit(lane, name);
  playHitSound(name, isBad ? 0 : combo);
  kick = Math.min(0.7, kick + j.kick);

  popScore();
  const isMilestone = !isBad && (TIER_STEPS.indexOf(combo) >= 0 || (combo >= 300 && combo % 100 === 0));
  if (!isMilestone && !isBad) popCombo();

  if (isBad) {
    triggerMissFlash('bad');
    shakeScreen(2.2);
    showBrokenCombo(prevCombo);
    if (navigator.vibrate) navigator.vibrate([40, 25, 40]);
    removeNote(n);
    return;
  }

  const tier = getTier(combo);
  const ringCount = name === 'PERFECT' ? 1 + Math.min(tier, 2) : 1;
  const particleCount = name === 'PERFECT' ? 6 + tier : (name === 'GREAT' ? 4 + Math.floor(tier / 2) : 3);

  if (name === 'PERFECT' && window.Shop) Shop.pulse();
  spawnShockwave(lane, name, ringCount);
  spawnParticles(lane, name, particleCount);

  // (no screen shake on ordinary taps: it was under 1 px and cost an animation per hit; shakes stay for milestones, holds and misses)
  buzz(name === 'PERFECT' ? 15 : 10);

  handleComboIncrement();
  removeNoteAnimated(n);
}

function startHold(n, diffMs, signedDiff) {
  const lane = n.lane;
  const j = classify(diffMs);
  const name = j.name;

  addScore(j.points);
  n.headJ = name;
  n.holding = true;
  n.lastTick = Math.round(getSongTime());
  if (n.el) n.el.classList.add('holding');

  updateScoreboard();
  showJudgement(name, j.color);
  showTiming(name, signedDiff);
  flashLane(lane);
  flashJudgementLine(lane, name === 'BAD' ? 'miss' : name);
  beamHit(lane, name);
  playHitSound(name, combo);
  kick = Math.min(0.7, kick + j.kick);
  spawnShockwave(lane, name === 'BAD' ? 'miss' : name, 1);
  spawnParticles(lane, name === 'BAD' ? 'miss' : name, 3);
  popScore();
  buzz(12);
}

function completeHold(n) {
  const lane = n.lane;
  const endTime = n.time + n.dur;
  const remainingTicks = Math.floor((endTime - (n.lastTick || n.time)) / HOLD_TICK_INTERVAL);
  if (remainingTicks > 0) {
    addScore(remainingTicks * HOLD_TICK_POINTS);
    n.lastTick = endTime;
  }

  addScore(50);
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  stats[n.headJ || 'PERFECT']++;
  judgedCount++;

  showJudgement('HOLD!', '#ff66a3');
  timingEl.style.opacity = 0;
  updateScoreboard();
  flashLane(lane);
  flashJudgementLine(lane, 'perfect');
  beamHit(lane, 'PERFECT');
  playHitSound('PERFECT', combo);
  kick = Math.min(0.7, kick + 0.35);

  popScore();
  const isMilestone = TIER_STEPS.indexOf(combo) >= 0 || (combo >= 300 && combo % 100 === 0);
  if (!isMilestone) popCombo();

  const tier = getTier(combo);
  spawnShockwave(lane, 'perfect', 1 + Math.min(tier, 2));
  spawnParticles(lane, 'perfect', 6 + tier);
  shakeScreen(1.2 + tier * 0.25);

  buzz(20);

  handleComboIncrement();
  removeNoteAnimated(n);
}

function breakCombo(missSoundShake) {
  const brokenCombo = combo;
  combo = 0;
  missCount++;
  stats.MISS++;
  judgedCount++;

  showJudgement('MISS', missSoundShake.color);
  timingEl.style.opacity = 0;
  updateScoreboard();
  updateLife();
  playMissSound();
  triggerMissFlash();
  shakeScreen(missSoundShake.shake);
  showBrokenCombo(brokenCombo);
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
}

function breakHold(n) {
  flashJudgementLine(n.lane, 'miss');
  breakCombo({ color: '#c22303', shake: 2.4 });
  removeNote(n);
  if (missCount >= missLimit) triggerGameOver();
}

function registerMiss(n) {
  flashJudgementLine(n.lane, 'miss');
  breakCombo({ color: '#8a0f1f', shake: 2 });
  removeNote(n);
  if (missCount >= missLimit) triggerGameOver();
}

// ---------- PLAYING ----------
function resetRunState() {
  score = 0; scoreExact = 0; combo = 0; maxCombo = 0; displayScore = 0;
  missCount = 0;
  wallOffset = 0;
  kick = 0;
  stats = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
  judgedCount = 0;
  lastCountdownNum = 0;
  frameEma = 16.7;
  perfBad = perfGood = 0;
  lowLock = false; lowFlips = 0;
  shownScoreInt = -1;
  accFx = accBeat = 0;
  lastFrameT = 0;
  shownCombo = -1;
  beamA.fill(0); lanePressedState.fill(false);
  updateLife();
}

// ---------- GET-READY INTRO ----------
// Before the 3-2-1: (1) the lanes slide in and the notes fade in, (2) the card strip, score and life bar fade in.
// It doubles as loading time: after the 2 seconds the countdown waits (up to INTRO_MAX_WAIT_MS) until the song has
// buffered, so the first seconds of a run do not stutter while the audio is still arriving.
const INTRO_LANES_MS = 1000;                // step 1: lanes + notes
const INTRO_HUD_MS = 1000;                  // step 2: cards, score, life bar
const INTRO_NOTES_AT = 400;                 // notes start fading in this long after the lanes begin
const INTRO_NOTES_MS = 600;
const INTRO_MAX_WAIT_MS = 8000;             // never hold a player longer than this for the audio
const INTRO_NO_PROGRESS_MS = 1500;          // browser buffers nothing until play() (iPhones): stop waiting after this
let introT0 = 0;
let introNoteK = 1;                         // 0..1 multiplier on note opacity (1 = normal play)
let startArm = null;                        // song is playing but the audio clock has not moved yet: notes stay frozen until it does
const START_ARM_MAX_MS = 600;               // never wait longer than this for the audio clock

(function addIntroStyles() {
  const st = document.createElement('style');
  st.textContent =
    'body.intro-hud .card-cheer, body.intro-hud #score, body.intro-hud #life, body.intro-hud #pause-btn { opacity: 0 !important; transition: none !important; }' +
    'body.intro-hud #score, body.intro-hud #life { translate: 0 -14px; }' +
    'body.intro-hud-in .card-cheer, body.intro-hud-in #score, body.intro-hud-in #life, body.intro-hud-in #pause-btn { transition: opacity 700ms ease-out, translate 700ms ease-out !important; }';
  document.head.appendChild(st);
})();

const introLoadingEl = mk('div', 'intro-loading');
introLoadingEl.style.cssText =
  'position:fixed;left:0;right:0;top:46%;text-align:center;z-index:60;pointer-events:none;display:none;' +
  'font:900 28px/1.2 system-ui,sans-serif;letter-spacing:.2em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.7);';
introLoadingEl.textContent = 'LOADING…';

function runIntro(token, done) {
  const alive = () => token === playToken && mode === 'starting';
  introT0 = performance.now();

  // step 1: lanes slide up and fade in (notes follow through introNoteK in the update loop)
  if (playfieldEl.animate) {
    const slide = reduceMotion ? [] : [{ transform: 'translateY(36px)' }, { transform: 'translateY(0)' }];
    playfieldEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out' });
    if (slide.length) for (const cv of [fieldBgCv, fieldCv]) cv.animate(slide, { duration: 800, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  // step 2: cards, score and life bar fade in
  setTimeout(() => {
    if (!alive()) return;
    document.body.classList.add('intro-hud-in');
    document.body.classList.remove('intro-hud');
    setTimeout(() => document.body.classList.remove('intro-hud-in'), 800);
  }, INTRO_LANES_MS);

  // then: hold the countdown until the song is buffered
  setTimeout(() => {
    if (!alive()) return;
    const t0 = performance.now();
    const poll = () => {
      if (!alive()) return;
      const waited = performance.now() - t0;
      let ok = true;
      try {
        ok = music.readyState >= 3;
        if (!ok && waited > INTRO_NO_PROGRESS_MS && !(music.buffered && music.buffered.length)) ok = true;
      } catch (e) { ok = true; }
      if (ok || waited > INTRO_MAX_WAIT_MS) { introLoadingEl.style.display = 'none'; done(); return; }
      if (waited > 300) introLoadingEl.style.display = 'block';
      setTimeout(poll, 150);
    };
    poll();
  }, INTRO_LANES_MS + INTRO_HUD_MS);
}

// 3-2-1 before a song starts. Stops quietly if the player leaves or restarts meanwhile (the token changes).
// The first element.animate() on an element builds its compositor layer. Do that during the countdown, not on the first hit.
function prewarmHud() {
  const still = (el, tf) => { try { el.animate([{ transform: tf }, { transform: tf }], { duration: 40 }); } catch (e) { /* ignore */ } };
  still(judgementEl, 'translateX(-50%)'); still(timingEl, 'translateX(-50%)'); still(tierBanner, 'translateX(-50%)');
  still(scoreEl, 'scale(1)'); still(comboEl, 'translateX(-50%) scale(1)');
}
// If the phone is clearly struggling while the notes only stand still, go lite NOW (before the song), so the playfield
// resize does not hitch in the middle of the first notes.
function autoPickQuality() {
  if (!lowFx && introFrames > 30 && frameEma > 21) setLowFx(true);
}

const START_COUNTDOWN_STEP = 1000;          // ms per number before a song starts (3 numbers = 3 seconds)
function runStartCountdown(token, done) {
  let n = 3;
  const step = () => {
    if (token !== playToken || mode !== 'starting') return;
    if (n <= 0) { countdownEl.classList.remove('show'); done(); return; }
    if (n === 3) prewarmHud();
    if (n === 2) autoPickQuality();
    countdownEl.classList.add('show');
    countdownEl.textContent = n;
    countdownEl.animate([
      { transform: 'scale(1.7)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: 0.25 },
      { transform: 'scale(0.9)', opacity: 0.85 },
    ], { duration: START_COUNTDOWN_STEP - 40, easing: 'ease-out' });
    try { playCountdownBeep(n); } catch (e) { /* audio unavailable */ }
    n--;
    setTimeout(step, START_COUNTDOWN_STEP);
  };
  step();
}

// per-song music loudness (song.volume): >1 boosts through a gain node that bypasses the SFX bus
let musicGain = null;
function canBoostMusic() {                    // a MediaElementSource outputs SILENCE for file:// pages and cross-origin audio without CORS
  try {
    if (location.protocol === 'file:') return false;
    return music.crossOrigin != null || new URL(music.currentSrc || music.src, location.href).origin === location.origin;
  } catch (e) { return false; }
}
function applySongVolume(song) {
  const vol = song && Number(song.volume) > 0 ? Number(song.volume) : 1;
  ensureAudio();
  if (vol > 1 && !musicGain && canBoostMusic()) {
    try {
      const src = audioCtx.createMediaElementSource(music);
      musicGain = audioCtx.createGain();
      const lim = audioCtx.createDynamicsCompressor();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20;
      lim.attack.value = 0.003; lim.release.value = 0.1;
      src.connect(musicGain).connect(lim).connect(audioCtx.rawDestination || audioCtx.destination);
    } catch (e) { musicGain = null; }
  }
  if (musicGain) { musicGain.gain.value = vol; music.volume = 1; }
  else music.volume = Math.min(1, vol);
}

function startPlayback() {
  hideResults();
  hideGameOverScreen();
  pauseOverlay.classList.remove('show');
  hideTransientHud();
  stopPreview();
  applySongVolume(currentSong);
  releaseAllInputs();

  resetRunState();
  scoreMult = 1;
  if (window.Shop) { const run = Shop.beginRun(currentSong); scoreMult = run.mult; }
  missLimit = Math.min(20, Math.max(10, Math.ceil(currentChart.length * 0.05)));
  updateLife();
  buildQueue(currentChart);
  { const total = perfectRunTotal(); scoreNorm = total > 0 ? BASE_MAX_SCORE / total : 1; }
  setComboHidden();
  document.body.dataset.tier = 0;
  petals.clear();
  petals.setTier(0);
  petals.setText(currentSong && currentSong.petalText);
  applySongFx(currentSong);
  applySongTheme(currentSong);
  scoreEl.textContent = 'Score: 0';
  if (WEAK_DEVICE && !weakTried) { weakTried = true; setLowFx(true); }   // weak phone: start light, it may switch back up if it copes
  measureLane();

  introNoteK = reduceMotion ? 1 : 0;
  introFrames = 0; playBeganAt = 0;
  document.body.classList.add('intro-hud');          // cards, score and life bar stay hidden until the intro reaches them
  pauseBtn.classList.add('show');
  setHudVisible(true);
  [80, 400, 1000].forEach(ms => setTimeout(measureLane, ms));   // card strip finishes its entrance: place the track under it

  // Inputs stay off until the audio is really playing, so the clock and the music can never disagree
  mode = 'starting';
  const token = ++playToken;
  music.currentTime = 0;
  wallStart = performance.now();

  const begin = (audioOk) => {
    if (token !== playToken || mode !== 'starting') return;
    introShow = false;
    introT0 = 0; introNoteK = 1;
    playBeganAt = performance.now(); dbgReset();
    useAudio = audioOk;
    if (!audioOk) wallStart = performance.now();
    wallOffset = 0;
    resetClock();
    mode = 'playing';
    lastFrameT = 0;
    startUpdateLoop();
  };

  // play() resolves when the browser STARTS playing, but on many devices (Android, Bluetooth, first play) the audio clock
  // stays at 0 for another 50-300 ms. If the notes already moved in that gap, the clock later snapped back and notes that
  // were already on screen (songs with early notes) visibly jumped. So the notes wait, frozen like in the countdown, until
  // the audio position really starts moving (see the 'starting' branch of update()).
  const arm = (audioOk) => {
    if (token !== playToken || mode !== 'starting') return;
    if (!audioOk) { begin(false); return; }
    startArm = { token, t0: performance.now(), go: begin };
  };

  startArm = null;
  introShow = true;
  startUpdateLoop();
  // get-ready intro (lanes + notes, then cards + score bar) -> wait for the song to buffer -> 3-2-1 -> song and notes start together
  runIntro(token, () => runStartCountdown(token, () => {
    if (token !== playToken || mode !== 'starting') return;
    music.currentTime = 0;
    wallStart = performance.now();
    const p = music.play();
    if (p && p.then) p.then(() => arm(true), () => arm(false));
    else arm(true);
  }));

  setStatus(`▶ ${currentSong.title} | ${currentChart.length} notes | miss limit ${missLimit}`);
}

// ---------- TOUCH INPUT ----------
// Lane from finger position. Uses the SAME perspective as the drawing, so what you see is what you hit,
// and every touch counts: the left thumb owns the left lanes, the right thumb the right lanes.
function findLaneFromPoint(x, y) {
  const F = FIELD;
  if (!F.W) return null;
  let s = (y - F.top - F.yH) / (F.hitY - F.yH);
  if (s < 0.9) s = 0.9; else if (s > 1.6) s = 1.6;
  const k = Math.floor((x - F.left - F.cx) / (F.lw * s) + 2);
  return k < 0 ? 0 : k > 3 ? 3 : k;
}

playfieldEl.addEventListener('touchstart', (e) => {
  if (mode !== 'playing' && mode !== 'countdown') return;
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (activeTouches.has(touch.identifier)) continue;
    const lane = findLaneFromPoint(touch.clientX, touch.clientY);
    if (lane !== null) {
      activeTouches.set(touch.identifier, lane);
      laneDown(lane);
    }
  }
}, { passive: false });

playfieldEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const lane = activeTouches.get(touch.identifier);
    if (lane !== undefined) {
      activeTouches.delete(touch.identifier);
      laneUp(lane);
    }
  }
}, { passive: false });

playfieldEl.addEventListener('touchcancel', (e) => {
  for (const touch of e.changedTouches) {
    const lane = activeTouches.get(touch.identifier);
    if (lane !== undefined) {
      activeTouches.delete(touch.identifier);
      laneUp(lane);
    }
  }
});

game.addEventListener('touchstart', (e) => {
  if (e.target === game || e.target === playfieldEl) e.preventDefault();
}, { passive: false });

// ---------- BUTTONS ----------
playBtn.addEventListener('click', () => {
  tryLandscapeLock();
  try { ensureAudio(); } catch (e) { /* audio unavailable */ }   // unlock sound for the pack opening
  if (window.Packs && Packs.needsStarter()) holdPreview = true;      // no preview music during the oshi picker
  showSongSelect();
  warmPreview(window.SONGS && window.SONGS[0]);                   // no-op if the page-load warm-up already started it
  unlockPreview();                                                // lets iPhones play previews later without a fresh tap
  if (window.Packs) Packs.onFirstPlay();                          // new players get a free Starter Pack
});
backToMainBtn.addEventListener('click', () => showMainMenu());

// the "rotate your phone" screen is tappable: goes fullscreen and locks landscape where the browser allows it
document.getElementById('rotate-hint').addEventListener('click', () => { tryFullscreen(); tryLandscapeLock(); });

btnPlayAgain.addEventListener('click', () => { if (currentSong) startPlayback(); });
btnBack.addEventListener('click', () => { backToSongSelect(); });
btnGoPlayAgain.addEventListener('click', () => { if (currentSong) startPlayback(); });
btnGoBack.addEventListener('click', () => { backToSongSelect(); });
btnResume.addEventListener('click', () => { resumeGame(); });
btnQuit.addEventListener('click', () => { backToSongSelect(); });
btnRestart.addEventListener('click', () => {
  if (!currentSong) return;
  if (window.Shop) Shop.setCheerPaused(false);
  startPlayback();
});
pauseBtn.addEventListener('click', () => { pauseGame(); });

// ---------- UI SOUND PACK ----------
// Every tappable thing gets its own synthesized voice. uTone = one oscillator note, uNoise = a filtered noise burst.
function uTone(freq, o = {}) {
  const t = audioCtx.currentTime + (o.at || 0), dur = o.dur || 0.12;
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol || 0.15, t + (o.attack || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.lp) { const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  node.connect(g).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur + 0.03);
}
function uNoise(o = {}) {
  const t = audioCtx.currentTime + (o.at || 0), dur = o.dur || 0.08;
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = getNoiseBuffer(0.25, 0.35);
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.from || 2000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q || 1;
  g.gain.setValueAtTime(o.vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t, 0, Math.min(dur + 0.02, 0.24));
}
const PENTA = [0, 2, 4, 7, 9];                                   // major pentatonic: member chips sound like a little scale
const noteAt = (i, base = 523.25) => base * Math.pow(2, (PENTA[i % 5] + 12 * Math.floor(i / 5)) / 12);

const UI_SND = {
  start() {   // title PLAY: sparkling rising arpeggio + whoosh + low thump
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => uTone(f, { at: i * 0.05, dur: 0.34, vol: 0.1, type: 'triangle' }));
    uNoise({ from: 600, to: 5200, dur: 0.28, vol: 0.07, q: 0.8 });
    uTone(110, { dur: 0.22, to: 55, vol: 0.2 });
  },
  back() {    // back arrows: two soft notes stepping down
    uTone(659.25, { dur: 0.09, vol: 0.13, type: 'triangle' });
    uTone(440, { at: 0.075, dur: 0.17, vol: 0.13, type: 'triangle' });
  },
  shop() {    // CARD SHOP: shop-door bell / ka-ching
    uTone(1318.5, { dur: 0.35, vol: 0.1, type: 'triangle' }); uTone(2637, { dur: 0.25, vol: 0.035 });
    uTone(1975.5, { at: 0.09, dur: 0.5, vol: 0.1, type: 'triangle' }); uTone(3951, { at: 0.09, dur: 0.3, vol: 0.03 });
    uNoise({ type: 'highpass', from: 5000, dur: 0.03, vol: 0.09 });
  },
  cards() {   // MY CARDS: a deck being riffled and slapped down
    for (let i = 0; i < 4; i++) uNoise({ at: i * 0.035, from: 2600 + i * 500, to: 900, dur: 0.05, vol: 0.1, q: 2 });
    uTone(220, { at: 0.13, dur: 0.09, to: 140, vol: 0.12 });
  },
  playBtn() { // the ▶ on a song card: punchy "ready"
    uTone(392, { dur: 0.15, to: 784, type: 'square', vol: 0.06, lp: 2600 });
    uTone(85, { dur: 0.15, to: 45, vol: 0.26 });
    uNoise({ type: 'highpass', from: 4200, dur: 0.02, vol: 0.08 });
  },
  ask() {     // "PLAY THIS SONG?" pops up: a questioning two-note
    uTone(659.25, { dur: 0.12, vol: 0.12 });
    uTone(987.77, { at: 0.09, dur: 0.3, vol: 0.12 }); uTone(1975.5, { at: 0.09, dur: 0.2, vol: 0.03 });
    uNoise({ from: 1500, to: 4000, dur: 0.08, vol: 0.04 });
  },
  yes() {     // YES: triumphant run + kick + sparkle
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      uTone(f, { at: i * 0.04, dur: 0.3, type: 'sawtooth', vol: 0.05, lp: 3200 });
      uTone(f * 2, { at: i * 0.04, dur: 0.22, vol: 0.04, type: 'triangle' });
    });
    uTone(100, { dur: 0.2, to: 48, vol: 0.28 });
    uNoise({ type: 'highpass', from: 5500, dur: 0.14, vol: 0.06, at: 0.16 });
  },
  no() {      // NO: dull sinking "nope"
    uTone(311, { dur: 0.16, to: 196, type: 'triangle', vol: 0.15 });
    uTone(233, { at: 0.1, dur: 0.24, to: 150, type: 'triangle', vol: 0.13 });
    uTone(90, { dur: 0.12, to: 55, vol: 0.18 });
  },
  pause() {   // pause: tape slowing down
    uTone(900, { dur: 0.26, to: 220, type: 'sawtooth', vol: 0.055, lp: 1800 });
    uNoise({ type: 'lowpass', from: 3000, to: 300, dur: 0.22, vol: 0.1 });
    uTone(180, { dur: 0.05, vol: 0.14 });
  },
  resume() {  // resume: spinning back up
    uTone(260, { dur: 0.2, to: 880, type: 'sawtooth', vol: 0.055, lp: 2600 });
    uNoise({ type: 'lowpass', from: 300, to: 3500, dur: 0.18, vol: 0.08 });
    uTone(1046.5, { at: 0.13, dur: 0.18, vol: 0.12, type: 'triangle' });
  },
  quit() {    // quit: heavy door shutting
    uTone(130, { dur: 0.3, to: 52, vol: 0.28 });
    uNoise({ type: 'lowpass', from: 700, to: 150, dur: 0.2, vol: 0.14 });
    uTone(330, { dur: 0.12, to: 220, type: 'triangle', vol: 0.07 });
  },
  retry() {   // play again: quick rewind-and-go blips
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => uTone(f, { at: i * 0.04, dur: 0.1, type: 'square', vol: 0.045, lp: 3200 }));
    uNoise({ from: 5000, to: 1500, dur: 0.08, vol: 0.05 });
  },
  tab(i = 0) { // team tabs: woodblock, a different pitch per team
    const p = 640 + (i % 6) * 110;
    uTone(p, { dur: 0.08, to: p * 0.7, vol: 0.18, type: 'triangle' });
    uNoise({ type: 'highpass', from: 3500, dur: 0.012, vol: 0.06 });
  },
  chip(i = 0) { // member chips / filters: bubble pop climbing a scale
    const f = noteAt(i, 440);
    uTone(f, { dur: 0.09, to: f * 2, vol: 0.13 });
    uTone(f * 1.5, { at: 0.05, dur: 0.07, to: f * 3, vol: 0.06 });
  },
  close() {   // ✕ / ×: short falling blip
    uTone(740, { dur: 0.1, to: 370, type: 'triangle', vol: 0.13 });
    uNoise({ type: 'highpass', from: 3000, dur: 0.015, vol: 0.05 });
  },
  coin() {    // buy / open a pack: coin clink
    uTone(1568, { dur: 0.08, type: 'square', vol: 0.045, lp: 5000 });
    uTone(2093, { at: 0.07, dur: 0.38, type: 'square', vol: 0.045, lp: 5000 }); uTone(3136, { at: 0.07, dur: 0.2, vol: 0.03 });
  },
  arrowL() { uNoise({ from: 3600, to: 700, dur: 0.1, vol: 0.12, q: 1.4 }); uTone(520, { dur: 0.06, to: 400, type: 'triangle', vol: 0.07 }); },
  arrowR() { uNoise({ from: 700, to: 3600, dur: 0.1, vol: 0.12, q: 1.4 }); uTone(520, { dur: 0.06, to: 650, type: 'triangle', vol: 0.07 }); },
  rustle() {  // ODDS & RULES: paper rustle + tiny ding
    uNoise({ from: 1800, to: 3600, dur: 0.12, vol: 0.1, q: 0.7 }); uNoise({ at: 0.06, from: 3000, to: 1500, dur: 0.08, vol: 0.07, q: 0.7 });
    uTone(1318.5, { at: 0.1, dur: 0.2, vol: 0.07, type: 'triangle' });
  },
  daily() {   // DAILY button: a gift being unwrapped
    [880, 1108.73, 1318.5, 1760].forEach((f, i) => uTone(f, { at: i * 0.045, dur: 0.24, vol: 0.09, type: 'triangle' }));
    uNoise({ type: 'highpass', from: 6000, dur: 0.18, vol: 0.05 });
  },
  checkin() { // CHECK IN: a stamp thump, then a bright chime
    uTone(140, { dur: 0.18, to: 55, vol: 0.28 }); uNoise({ from: 1200, to: 300, dur: 0.07, vol: 0.12 });
    [784, 1046.5, 1318.5].forEach((f, i) => uTone(f, { at: 0.07 + i * 0.06, dur: 0.32, vol: 0.1, type: 'triangle' }));
  },
  rotate() {  // rotate-your-phone hint: gentle three-note chime
    [784, 1046.5, 1568].forEach((f, i) => uTone(f, { at: i * 0.1, dur: 0.32, vol: 0.11, type: 'triangle' }));
  },
};

// everything else that is tappable but not listed above gets a voice picked from its own name, so no two look-alikes sound identical
function uiAuto(el) {
  const s = (el.id || '') + (el.className && el.className.baseVal === undefined ? el.className : '') + (el.getAttribute('aria-label') || '') + (el.textContent || '').slice(0, 24);
  let hsh = 0;
  for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) >>> 0;
  const f = [392, 440, 494, 523.25, 587.33, 659.25, 740, 784][hsh % 8];
  switch ((hsh >> 3) % 5) {
    case 0: uTone(f, { dur: 0.1, to: f * 0.8, type: 'triangle', vol: 0.15 }); break;                         // pluck
    case 1: uTone(f, { dur: 0.09, to: f * 2, vol: 0.13 }); break;                                           // bubble
    case 2: uTone(f * 2, { dur: 0.07, type: 'square', vol: 0.05, lp: 3000 }); break;                        // blip
    case 3: uTone(f * 2, { dur: 0.22, vol: 0.12 }); uTone(f * 4, { dur: 0.14, vol: 0.035 }); break;         // ping
    default: uNoise({ type: 'highpass', from: 4000, dur: 0.015, vol: 0.08 }); uTone(f, { dur: 0.06, vol: 0.12, type: 'triangle' });   // tick
  }
}
function playEmptyTap(lane) {      // tapping a lane with no note: a quiet, lane-pitched "tk"
  ensureAudio();
  const f = [262, 311, 370, 440][lane % 4];
  uTone(f, { dur: 0.05, to: f * 0.75, type: 'triangle', vol: 0.05 });
  uNoise({ type: 'highpass', from: 4500, dur: 0.01, vol: 0.03 });
}

// first matching selector wins; null = that module already plays its own sound for it
const UI_MAP = [
  ['#play-btn', 'start'],
  ['#back-to-main-btn, #cards-back-btn, .sh-back, .dy-back, #btn-back, #btn-go-back', 'back'],
  ['#daily-btn', 'daily'],
  ['.dy-checkin-btn', 'checkin'],
  ['.dy-claim, .dy-bonus-btn', 'coin'],
  ['.dy-go', 'playBtn'],
  ['#shop-btn', 'shop'],
  ['#my-cards-btn', 'cards'],
  ['.card-play-btn', 'playBtn'],
  ['.cp-yes', 'yes'],
  ['.cp-no', 'no'],
  ['#pause-btn', 'pause'],
  ['#btn-resume', 'resume'],
  ['#btn-quit', 'quit'],
  ['#btn-play-again, #btn-go-play-again, #btn-restart', 'retry'],
  ['.cards-tab', 'tab'],
  ['.cards-chip', 'chip'],
  ['.cv-close, .sh-mx', 'close'],
  ['.op-arrow.l', 'arrowL'],
  ['.op-arrow.r', 'arrowR'],
  ['.op-ok', null],                       // shop.js plays the oshi fanfare
  ['.cv-btn.pink, .cv-btn.gold', null],   // cards.js plays deal / coin / merge sounds
  ['.cv-btn', 'chip'],
  ['.sh-odds', 'rustle'],
  ['.sh-btn.alt', 'chip'],
  ['.sh-btn', 'coin'],
  ['.sh-pm, .op-filters button', 'chip'],
  ['#rotate-hint', 'rotate'],
];
function playUiFor(target) {
  ensureAudio();
  for (const [sel, name] of UI_MAP) {
    const el = target.closest(sel);
    if (!el) continue;
    if (!name) return;
    let idx = 0;
    if (name === 'tab' || name === 'chip') idx = Array.prototype.indexOf.call(el.parentNode ? el.parentNode.children : [], el);
    UI_SND[name](Math.max(0, idx));
    return;
  }
  const b = target.closest('button, [role="button"]');
  if (b) uiAuto(b);
}

// ---------- GLOBAL UI CLICK SOUND ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('.song-card') && !e.target.closest('.card-play-btn')) return;   // song cards have their own select sound
  if (e.target.closest('button, [role="button"], #rotate-hint')) {
    try { playUiFor(e.target); } catch (err) { /* audio unavailable */ }
  }
}, true);

// Daily screen "GO": select the featured song's card
window.addEventListener('daily:goto', (e) => {
  const card = Array.prototype.find.call(songGrid.querySelectorAll('.song-card'), c => c.dataset.songId === e.detail.id);
  if (card) { selectCard(card, card._song); centerCard(card, true); }
});

// ---------- "PLAY THIS SONG?" CONFIRMATION ----------
const confirmEl = document.createElement('div');
confirmEl.id = 'confirm-play';
confirmEl.innerHTML = `
  <div class="cp-box" role="dialog" aria-modal="true" aria-labelledby="cp-title">
    <div class="cp-cover"><span>♪</span><img alt=""></div>
    <div class="cp-title" id="cp-title">PLAY THIS SONG?</div>
    <div class="cp-song"></div>
    <div class="cp-artist"></div>
    <div class="cp-btns">
      <button type="button" class="cp-yes">YES</button>
      <button type="button" class="cp-no">NO</button>
    </div>
    <button type="button" class="cp-hs">VIEW HIGH SCORE</button>
  </div>`;
document.body.appendChild(confirmEl);
const cpSong = confirmEl.querySelector('.cp-song'), cpArtist = confirmEl.querySelector('.cp-artist');
const cpImg = confirmEl.querySelector('.cp-cover img'), cpYes = confirmEl.querySelector('.cp-yes'), cpNo = confirmEl.querySelector('.cp-no');
const cpHs = confirmEl.querySelector('.cp-hs');
let confirmSong = null;

function askPlay(song) {
  confirmSong = song;
  cpHs.textContent = 'VIEW HIGH SCORE';
  cpSong.textContent = song.title || song.id || '';
  cpArtist.textContent = song.artist || '';
  cpImg.style.display = 'none';
  cpImg.onload = () => { cpImg.style.display = 'block'; };
  cpImg.onerror = () => { cpImg.style.display = 'none'; };
  cpImg.removeAttribute('src');
  if (song.cover) cpImg.src = song.cover;
  confirmEl.classList.remove('show'); void confirmEl.offsetWidth;
  confirmEl.classList.add('show');
  try { ensureAudio(); UI_SND.ask(); } catch (e) { /* audio unavailable */ }
  setTimeout(() => cpYes.focus({ preventScroll: true }), 40);
}
function closeConfirm() { confirmEl.classList.remove('show'); confirmSong = null; }
function denyPlay() { try { ensureAudio(); UI_SND.no(); } catch (e) { /* ignore */ } closeConfirm(); }
cpYes.addEventListener('click', () => { const s = confirmSong; closeConfirm(); if (s) proceedSong(s); });
cpNo.addEventListener('click', () => closeConfirm());          // the NO sound is played by the global click handler
confirmEl.addEventListener('click', (e) => { if (e.target === confirmEl) denyPlay(); });
cpHs.addEventListener('click', () => {
  if (!confirmSong) return;
  if (!openHighScoreView(confirmSong)) {                 // never played this song yet
    cpHs.textContent = 'NO HIGH SCORE YET';
    setTimeout(() => { if (cpHs.textContent === 'NO HIGH SCORE YET') cpHs.textContent = 'VIEW HIGH SCORE'; }, 1400);
  }
});

// ---------- HIGH SCORE VIEW: the result card of the best run, as a pop-up (click outside the card to close) ----------
let hsView = false, hsSavedTitle = '';
function openHighScoreView(song) {
  const best = song && loadBest(song.id);
  if (!best || !(best.score > 0)) return false;
  const r = best.run || { score: best.score, combo: best.combo, acc: best.acc, grade: best.grade, fc: best.fc, ap: false, stats: null, cards: [], bonus: 0 };
  hsView = true;
  clearResultTimers();
  results.classList.add('hs-view');
  const titleEl = results.querySelector('.results-title');
  if (titleEl) {
    if (!hsSavedTitle) hsSavedTitle = titleEl.innerHTML;
    titleEl.innerHTML = '<span class="hs-title">HIGH SCORE</span>';
  }
  finalSongEl.textContent = song.title || '';
  setCoverImage(finalCoverEl, song);
  [finalScoreEl, finalComboEl, finalAccEl].concat(Object.keys(judgeNumEls).map(k => judgeNumEls[k])).forEach(el => { el._numTok = (el._numTok || 0) + 1; });
  finalScoreEl.textContent = Math.round(r.score || 0).toLocaleString();
  finalComboEl.textContent = Math.round(r.combo || 0).toLocaleString();
  finalAccEl.textContent = ((r.acc || 0) * 100).toFixed(1) + '%';
  for (const k in judgeNumEls) judgeNumEls[k].textContent = r.stats ? String(r.stats[k] || 0) : '–';
  finalGradeEl.getAnimations().forEach(a => a.cancel());
  const g = r.grade || 'C';
  finalGradeEl.textContent = g;
  finalGradeEl.className = 'grade-stamp g-' + g;
  finalGradeEl.style.opacity = 1;
  finalGradeEl.style.transform = 'rotate(-8deg)';
  finalBannerEl.getAnimations().forEach(a => a.cancel());
  finalBannerEl.textContent = r.ap ? '★ ALL PERFECT ★' : (r.fc ? 'FULL COMBO' : '');
  finalBannerEl.className = 'results-banner' + (r.ap ? ' ap' : r.fc ? ' fc' : '');
  finalBannerEl.style.opacity = 1;
  finalRecordEl.classList.remove('show');
  finalPointsEl.innerHTML = '';
  finalPointsEl.classList.remove('show');
  results.classList.remove('show');
  void results.offsetWidth;
  results.classList.add('show');
  return true;
}
function exitHighScoreView() {
  if (!hsView) return;
  hsView = false;
  results.classList.remove('hs-view');
  const titleEl = results.querySelector('.results-title');
  if (titleEl && hsSavedTitle) titleEl.innerHTML = hsSavedTitle;
  finalGradeEl.style.transform = '';
}
function closeHighScoreView() {
  if (!hsView) return;
  exitHighScoreView();
  results.classList.remove('show');
}
results.addEventListener('click', (e) => { if (hsView && e.target === results) closeHighScoreView(); });   // tapping outside the box = NO

// ---------- KEYBOARD ----------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (hsView) {                                        // high score card is open: Esc closes it, nothing else reacts
    if (e.code === 'Escape') { e.preventDefault(); closeHighScoreView(); }
    return;
  }

  if (confirmEl.classList.contains('show')) {          // "PLAY THIS SONG?" is open: Esc = NO, Enter on a button = its own click
    if (e.code === 'Escape') { e.preventDefault(); denyPlay(); }
    return;
  }

  if (e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'playing' || mode === 'countdown') pauseGame();
    else if (mode === 'paused') resumeGame();
    return;
  }

  // song select: arrow keys move through the carousel
  if (mode === 'idle' && menuScreen.style.display !== 'none') {
    if (e.code === 'ArrowRight') { e.preventDefault(); stepCarousel(1); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); stepCarousel(-1); return; }
  }

  const lane = KEY_TO_LANE[e.code];
  if (lane !== undefined && (mode === 'playing' || mode === 'countdown')) {
    e.preventDefault();
    laneDown(lane);
    return;
  }
});

document.addEventListener('keyup', (e) => {
  const lane = KEY_TO_LANE[e.code];
  if (lane !== undefined) {
    laneUp(lane);
    return;
  }
});

// Switching tabs / apps pauses the song instead of letting notes slip past
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPreview();
    if (mode === 'playing' || mode === 'countdown') pauseGame();
  }
});

// ---------- LOOP ----------
function updateBeat(now, dt) {
  if (fxLight()) return;
  let v = kick;
  kick *= Math.exp(-dt / 140);
  if (kick < 0.01) kick = 0;

  const bpm = currentSong && Number(currentSong.bpm);
  if (bpm > 0) {
    const beatLen = 60000 / bpm;
    const off = Number(currentSong.beatOffset) || 0;
    const phase = ((((now - off) % beatLen) + beatLen) % beatLen) / beatLen;
    v += Math.pow(1 - phase, 3) * 0.5;
  }

  const strength = [0.4, 0.55, 0.7, 0.85, 1][getTier(combo)];
  const o = Math.min(1, v * strength);
  if (Math.abs(o - lastBeatOpacity) > 0.02) {
    beatPulse.style.opacity = o.toFixed(2);
    lastBeatOpacity = o;
  }
}

function update(ts) {
  if (mode === 'idle' || mode === 'gameover') {
    loopRunning = false;
    return;
  }
  requestAnimationFrame(update);

  const dt = lastFrameT ? Math.min(ts - lastFrameT, 100) : 16.7;
  lastFrameT = ts;

  if (mode === 'countdown') { tickCountdown(); drawField(frozenTime, dt); if (songFx) songFxUpdate(dt); return; }
  if (mode === 'starting' && introShow) {   // 3-2-1 before the song: the first notes are on the track, standing still at song time 0
    if (introT0) {                          // get-ready intro: notes fade in during the second half of the lane entrance
      const k = Math.min(1, Math.max(0, (performance.now() - introT0 - INTRO_NOTES_AT) / INTRO_NOTES_MS));
      introNoteK = 1 - Math.pow(1 - k, 3);
    }
    if (introT0 && performance.now() - introT0 > INTRO_LANES_MS + INTRO_HUD_MS) { frameEma += (dt - frameEma) * 0.05; introFrames++; }   // frame rate while the notes stand still (loading + countdown)
    while (spawnIdx < queue.length && queue[spawnIdx].time - APPROACH_TIME - SPAWN_LEAD <= 0) {
      const n = queue[spawnIdx++];
      if (n.judged) continue;
      n.el = acquireNoteEl(n);
      active.push(n);
    }
    drawField(0, dt);
    if (songFx) songFxUpdate(dt);
    if (startArm) {                         // audio started: hand over to the playing clock as soon as the audio position really moves
      if (startArm.token !== playToken) startArm = null;
      else if (music.currentTime > 0 || performance.now() - startArm.t0 > START_ARM_MAX_MS) { const go = startArm.go; startArm = null; go(true); }
    }
    return;
  }
  if (mode !== 'playing') return;      // starting / paused / resuming: nothing moves

  trackPerformance(dt);
  if (DBG) dbgTick(dt);
  const now = getSongTime();

  // 1) create elements for notes that are about to come into view
  while (spawnIdx < queue.length && queue[spawnIdx].time - APPROACH_TIME - SPAWN_LEAD <= now) {
    const n = queue[spawnIdx++];
    if (n.judged) continue;
    if (!n.holding && now - n.time > MAX_WINDOW) {   // fell way behind (e.g. a long frame): count it as missed
      registerMiss(n);
      if (mode !== 'playing') return;
      continue;
    }
    n.el = acquireNoteEl(n);
    active.push(n);
  }

  // 2) only the notes on screen are processed
  for (let i = active.length - 1; i >= 0; i--) {
    const n = active[i];
    if (n.judged) { active.splice(i, 1); continue; }

    if (!n.holding && now - n.time > MAX_WINDOW) {
      registerMiss(n);
      active.splice(i, 1);
      if (mode !== 'playing') return;
      continue;
    }

    if (n.holding) {
      const tickDelta = now - n.lastTick;
      if (tickDelta >= HOLD_TICK_INTERVAL) {
        const ticks = Math.floor(tickDelta / HOLD_TICK_INTERVAL);
        addScore(ticks * HOLD_TICK_POINTS);
        n.lastTick += ticks * HOLD_TICK_INTERVAL;
        pulseScore();
      }
      if (now >= n.time + n.dur) {
        completeHold(n);
        active.splice(i, 1);
        continue;
      }
    }

  }

  // 3) HUD: score counts up smoothly instead of jumping
  if (displayScore !== score) {
    const diff = score - displayScore;
    displayScore = Math.abs(diff) < 1 ? score : displayScore + diff * 0.3;
    const r = Math.round(displayScore);
    if (r !== shownScoreInt) { shownScoreInt = r; scoreEl.textContent = 'Score: ' + NUM_FMT.format(r); }   // no text/layout work when the shown number did not change
  }

  // 3b) draw the whole playfield in one go
  drawField(now, dt);

  // 4) ambience: purely decorative, so it runs at ~30 fps (~20 in light mode) and only ONE of the two jobs per frame,
  //    which keeps every frame about the same cost (no judder) and frees time for the notes and input. (~12 fps in lite mode)
  accFx += dt; accBeat += dt;
  const ambT = fxLite() ? 80 : 48;
  if (accFx >= ambT) {
    const d = accFx; accFx = 0;
    if (songFx) songFxUpdate(d);                        // songs with their own effect (moon...) skip the sakura petals
    else petals.update(d, getTier(combo));
  } else if (accBeat >= ambT) {
    const d = accBeat; accBeat = 0;
    updateBeat(now, d);
  }
}

// ---------- SONG ENDED ----------
music.addEventListener('ended', () => {
  if (mode === 'playing') {
    displayScore = score;
    showResults();
  }
});

// ---------- INIT ----------
buildMenu();
showMainMenu();

// ---------- PHONE PLAY MODE ----------
// While a song is on screen the launcher gives the game a smaller virtual screen (bigger lanes / notes for thumbs).
(function watchPlayMode() {
  let last = null;
  function sync() {
    const playing = game.style.display !== 'none';
    if (playing === last) return;
    last = playing;
    document.documentElement.classList.toggle('play-phone', playing);
    if (window.parent !== window) { try { window.parent.postMessage({ jeketi: 'play', on: playing }, '*'); } catch (e) {} }
  }
  new MutationObserver(sync).observe(game, { attributes: true, attributeFilter: ['style'] });
  sync();
})();