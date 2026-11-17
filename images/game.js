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
    <div class="eq-strip"></div>
    <div class="gameover-buttons">
      <button id="btn-go-play-again" class="gif-btn"><img src="images/play.webp" class="btn-gif" alt="Play Again"></button>
      <button id="btn-go-back" class="gif-btn"><img src="images/back.webp" class="btn-gif" alt="Songs"></button>
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
const GRADE_RANK = { C: 1, B: 2, A: 3, S: 4 };

// ---------- SCORE SCALE & GRADES ----------
// Every song is scaled so a PERFECT run with no cards = BASE_MAX_SCORE, so long and short songs are equally fair.
// Cards then multiply it (see TIER_BONUS in shop.js), so reaching S (1,000,000) takes roughly 10 S cards plus a clean full combo.
const BASE_MAX_SCORE = 500000;
// a grade needs BOTH its minimum score and its minimum accuracy (checked from the top down)
const GRADE_RULES = [
  { g: 'S', score: 1000000, acc: 0.92 },
  { g: 'A', score: 450000,  acc: 0.80 },
  { g: 'B', score: 225000,  acc: 0.65 },
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
let lowFx = false, frameEma = 16.7, perfBad = 0, perfGood = 0;

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
    if (Math.abs(err) > 120) t = est;
    else t += err * 0.1 * Math.min(1, dt / 16.7);
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

function measureLane() { layoutField(); }
if ('ResizeObserver' in window) new ResizeObserver(measureLane).observe(playfieldEl);
window.addEventListener('resize', measureLane);

// ---------- SAVED BESTS ----------
function loadBest(id) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
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

function startPreview(song) {
  stopPreview();
  if (holdPreview) return;
  if (!song || !song.audio || song.preview === false) return;
  if (!previewAudio) { previewAudio = new Audio(); previewAudio.preload = 'auto'; }
  const token = previewToken;
  const start = typeof song.previewStart === 'number' ? song.previewStart : 15;
  const TARGET_VOL = 0.55, FADE_MS = 700, LEN_MS = 14000;

  previewAudio.volume = 0;
  const abs = new URL(song.audio, document.baseURI).href;
  if (previewAudio.src !== abs) previewAudio.src = song.audio;

  const seekAndFade = () => {
    if (token !== previewToken) return;
    try {
      const d = previewAudio.duration;
      previewAudio.currentTime = (isFinite(d) && start > d - 20) ? Math.max(0, d * 0.3) : start;
    } catch (e) { /* ignore */ }
    const t0 = performance.now();
    clearInterval(previewTimer);
    previewTimer = setInterval(() => {
      if (token !== previewToken) return;
      const el = performance.now() - t0;
      let v = Math.min(1, el / FADE_MS) * TARGET_VOL;
      if (el > LEN_MS - FADE_MS) v = Math.max(0, (LEN_MS - el) / FADE_MS) * TARGET_VOL;
      previewAudio.volume = Math.max(0, Math.min(1, v));
      if (el >= LEN_MS) stopPreview();
    }, 60);
  };

  if (previewAudio.readyState >= 1) seekAndFade();
  else previewAudio.addEventListener('loadedmetadata', seekAndFade, { once: true });

  const p = previewAudio.play();
  if (p && p.catch) p.catch(() => {});
}

// ---------- SCREENS ----------
function setHudVisible(visible) {
  if (!visible && window.Shop) Shop.hideHud();
  scoreEl.style.display = visible ? '' : 'none';
  lifeEl.classList.toggle('show', visible);
}

function hideTransientHud() {
  countdownEl.classList.remove('show');
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
        <div class="song-card-title">${escapeHtml(song.title || song.id)}</div>
        <div class="song-card-artist">${escapeHtml(song.artist || '')}</div>
        <div class="song-best"></div>
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

function updateCardBests() {
  songGrid.querySelectorAll('.song-card').forEach(card => {
    const el = card.querySelector('.song-best');
    if (!el) return;
    const best = loadBest(card.dataset.songId);
    el.textContent = best ? `BEST  ${best.grade || ''}  ·  ${Number(best.score || 0).toLocaleString()}` : '';
  });
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

// mouse wheel: step one song at a time instead of scrolling vertically
songGrid.addEventListener('wheel', (e) => {
  const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (!d) return;
  e.preventDefault();
  markScrolling();
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
  if (window.Shop && Shop.openLineup(song)) return;
  if (matchMedia('(pointer: coarse)').matches) { tryFullscreen(); tryLandscapeLock(); }
  startSong(song);
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
    <div class="eq-strip"></div>
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
  mode = 'idle';
  pauseBtn.classList.remove('show');
  setHudVisible(false);
  hideTransientHud();
  setComboHidden();
  document.body.dataset.tier = 0;
  releaseAllInputs();
  petals.clear();
  beatPulse.style.opacity = 0;
  lastBeatOpacity = 0;

  const acc = calcAccuracy();
  const grade = gradeFor(acc, score);
  const fullCombo = stats.MISS === 0 && stats.BAD === 0 && judgedCount > 0;
  const allPerfect = fullCombo && stats.GREAT === 0 && stats.GOOD === 0;

  // personal best
  let isRecord = false;
  if (currentSong) {
    const prev = loadBest(currentSong.id);
    isRecord = !prev || score > (prev.score || 0);
    const bestGrade = prev && GRADE_RANK[prev.grade] > GRADE_RANK[grade] ? prev.grade : grade;
    saveBest(currentSong.id, {
      score: Math.max(score, prev ? prev.score || 0 : 0),
      combo: Math.max(maxCombo, prev ? prev.combo || 0 : 0),
      acc: Math.max(acc, prev ? prev.acc || 0 : 0),
      grade: bestGrade,
      fc: !!((prev && prev.fc) || fullCombo),
    });
  }

  clearResultTimers();
  if (finalSongEl) finalSongEl.textContent = songLabel();
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
    if (grade === 'S') triggerScreenFlash();
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
const HIT_VOLUME = 0.5;
function playHitSound(judgement, comboValue) {
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

  const notes = grade === 'S' ? [784, 988, 1175, 1568]
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
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  while (W * H * dpr * dpr > 1.7e6 && dpr > 1) dpr = Math.max(1, dpr - 0.25);   // never paint a huge bitmap
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
  const pad = Math.ceil(F.lw * 0.14), w = F.noteW, h = F.noteH, k = F.dpr * 1.15;
  NOTE_COLS.forEach((c, i) => {
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
  g.addColorStop(0, 'rgba(20,8,40,0)');
  g.addColorStop(0.4, 'rgba(34,12,60,0.55)');
  g.addColorStop(1, 'rgba(70,18,80,0.78)');
  c.fillStyle = g; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,170,215,0.16)';
  for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(edgeX(k, s0), y0); c.lineTo(edgeX(k, s1), F.H); c.stroke(); }
  const rg = c.createLinearGradient(0, y0, 0, y0 + (F.H - y0) * 0.3);
  rg.addColorStop(0, 'rgba(255,196,228,0)'); rg.addColorStop(1, 'rgba(255,196,228,0.9)');
  c.lineWidth = 3; c.strokeStyle = rg;
  c.shadowColor = 'rgba(255,107,166,0.9)'; c.shadowBlur = 12;
  for (const k of [0, 4]) { c.beginPath(); c.moveTo(edgeX(k, s0), y0); c.lineTo(edgeX(k, s1), F.H); c.stroke(); }
  c.shadowBlur = 0;
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
      const gr = c.createLinearGradient(0, F.hitY, 0, yTop);
      gr.addColorStop(0, rgbaOf(beamColor[i], 0.85));
      gr.addColorStop(1, rgbaOf(beamColor[i], 0));
      c.globalAlpha = Math.min(1, beamA[i]);
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(edgeX(i, 1), F.hitY); c.lineTo(edgeX(i + 1, 1), F.hitY);
      c.lineTo(edgeX(i + 1, 0.5), yTop); c.lineTo(edgeX(i, 0.5), yTop);
      c.closePath(); c.fill();
    }
    let col = '#ff6ba6', a = 0.10;
    if (wall < laneHitUntil[i]) { col = laneHitColor[i]; a = 0.5; }
    else if (down) a = 0.38;
    else if (wall < laneFlashUntil[i]) a = 0.22;
    c.globalAlpha = a; c.fillStyle = col;
    c.beginPath();
    c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop);
    c.lineTo(edgeX(i + 1, sB) - 1, F.H); c.lineTo(edgeX(i, sB) + 1, F.H);
    c.closePath(); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = down ? '#ffffff' : 'rgba(255,205,230,0.85)';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(edgeX(i, sA) + 1, padTop); c.lineTo(edgeX(i + 1, sA) - 1, padTop); c.stroke();
    // receptor outline that the notes land on
    c.strokeStyle = down ? '#ffffff' : 'rgba(255,107,166,0.65)';
    c.lineWidth = 2.5;
    rr(c, laneX(i, 1) - F.noteW * 0.52, F.hitY - F.recH / 2, F.noteW * 1.04, F.recH, F.recH * 0.4);
    c.stroke();
  }
  c.globalAlpha = 1;

  // notes
  const v = tierVariant();
  const spr = NOTE_SPR[v];
  if (spr) {
    const colr = NOTE_COLS[v];
    for (let i = 0; i < active.length; i++) {
      const n = active[i];
      if (n.judged) continue;
      const tHead = (now - (n.time - APPROACH_TIME)) / APPROACH_TIME;
      if (tHead < 0) continue;
      c.globalAlpha = tHead < 0.12 ? tHead / 0.12 : 1;      // fade in just under the card strip
      if (n.dur > 0) {
        const tTail = Math.max(0, (now - (n.time + n.dur - APPROACH_TIME)) / APPROACH_TIME);
        const th = n.holding ? Math.min(tHead, 1) : tHead;
        const sH = timeToScale(th), sT = timeToScale(tTail);
        const yH = yAt(sH), yT = yAt(sT);
        if (yH > yT) {
          const cxH = laneX(n.lane, sH), cxT = laneX(n.lane, sT);
          const bwH = F.noteW * 0.78 * sH, bwT = F.noteW * 0.78 * sT;
          const gr = c.createLinearGradient(0, yT, 0, yH);
          gr.addColorStop(0, rgbaOf(colr.hex, 0.25));
          gr.addColorStop(1, rgbaOf(colr.hex, n.holding ? 0.9 : 0.7));
          c.fillStyle = gr;
          c.beginPath();
          c.moveTo(cxT - bwT / 2, yT); c.lineTo(cxT + bwT / 2, yT);
          c.lineTo(cxH + bwH / 2, yH); c.lineTo(cxH - bwH / 2, yH);
          c.closePath(); c.fill();
          c.strokeStyle = rgbaOf(colr.hex, 0.95); c.lineWidth = 2;
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

function fxColor(j) { return FX_COL[String(j).toLowerCase()] || '#ff6ba6'; }

function spawnShockwave(laneIndex, judgement, count) {
  const n = lowFx ? 1 : Math.min(count, 3);
  const col = fxColor(judgement), t = performance.now();
  for (let i = 0; i < n; i++) {
    if (fxRings.length >= 14) fxRings.shift();
    fxRings.push({ lane: laneIndex, col, t0: t + i * 70 });
  }
}

function spawnParticles(laneIndex, judgement, count) {
  const n = Math.round(count * (lowFx ? 0.4 : 1) * (COARSE ? 0.6 : 1));
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
  beamColor[laneIndex] = j ? j.beam : '#ff5252';
  if (lowFx) return;
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
const petals = (() => {
  const cv = mk('canvas', 'petals');
  const ctx = cv.getContext ? cv.getContext('2d') : null;
  const COLORS = ['#ffb3d1', '#ffb3d1', '#9fd0ff', '#ffe08a', '#d98cff'];
  const TARGETS = COARSE ? [4, 6, 9, 12, 16] : [8, 14, 22, 32, 44];
  const sprites = [];
  const list = [];
  let w = 0, h = 0, dpr = 1, tier = 0, quality = 1, dirty = false;

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
  COLORS.forEach(c => sprites.push(makeSprite(c)));

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

  return {
    setTier(t) { tier = t; },
    setQuality(low) { quality = low ? 0.3 : 1; },
    burst(count) {
      if (reduceMotion || lowFx) return;
      for (let i = 0; i < count && list.length < 90; i++) spawn(true, true);
    },
    update(dt, t) {
      if (!ctx) return;
      tier = t;
      const sec = dt / 1000;
      const want = target();
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
        const cos = Math.cos(p.rot) * p.s * dpr, sin = Math.sin(p.rot) * p.s * dpr;
        ctx.globalAlpha = p.a;
        ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
        ctx.drawImage(sprites[p.spriteIdx], -16, -16);
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

function setLowFx(v) {
  lowFx = v;
  perfBad = perfGood = 0;
  petals.setQuality(v);
  if (v) { beatPulse.style.opacity = 0; lastBeatOpacity = 0; }
  setStatus(status.textContent.split('\n')[0] + (v ? '\nlow-fx mode' : ''));
}

// Watches the frame rate. If the device struggles, effects get lighter on their own.
function trackPerformance(dt) {
  frameEma += (dt - frameEma) * 0.05;
  if (!lowFx) {
    if (frameEma > 26) { if (++perfBad > 90) setLowFx(true); } else perfBad = 0;
  } else {
    if (frameEma < 19) { if (++perfGood > 400) setLowFx(false); } else perfGood = 0;
  }
}

// ---------- NUMBER POPS ----------
function popScore() {
  scoreEl.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 200, easing: 'ease-out' }
  );
}

function popCombo() {
  if (comboEl.classList.contains('milestone')) return;
  if (comboEl.classList.contains('broke')) return;
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
  document.body.dataset.tier = tier;
  petals.setTier(tier);
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
  judgementEl.getAnimations().forEach(a => a.cancel());
  // no tilt, no travel: it appears in place, holds for a beat, fades out
  judgementEl.animate([
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
  timingEl.getAnimations().forEach(a => a.cancel());
  timingEl.animate([
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
  tierBanner.getAnimations().forEach(a => a.cancel());
  tierBanner.animate([
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
  beamColor[lane] = '#ff6ba6';

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

  const shakeBase = name === 'PERFECT' ? 1.5 : name === 'GREAT' ? 1 : 0.5;
  shakeScreen(shakeBase + tier * 0.25);

  if (navigator.vibrate) navigator.vibrate(name === 'PERFECT' ? 15 : 10);

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
  shakeScreen(0.8);
  popScore();
  if (navigator.vibrate) navigator.vibrate(12);
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

  if (navigator.vibrate) navigator.vibrate(20);

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
  lastFrameT = 0;
  shownCombo = -1;
  beamA.fill(0); lanePressedState.fill(false);
  updateLife();
}

function startPlayback() {
  hideResults();
  hideGameOverScreen();
  pauseOverlay.classList.remove('show');
  hideTransientHud();
  stopPreview();
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
  scoreEl.textContent = 'Score: 0';
  measureLane();

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
    useAudio = audioOk;
    if (!audioOk) wallStart = performance.now();
    wallOffset = 0;
    resetClock();
    mode = 'playing';
    lastFrameT = 0;
    startUpdateLoop();
  };

  const p = music.play();
  if (p && p.then) p.then(() => begin(true), () => begin(false));
  else begin(true);

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
  </div>`;
document.body.appendChild(confirmEl);
const cpSong = confirmEl.querySelector('.cp-song'), cpArtist = confirmEl.querySelector('.cp-artist');
const cpImg = confirmEl.querySelector('.cp-cover img'), cpYes = confirmEl.querySelector('.cp-yes'), cpNo = confirmEl.querySelector('.cp-no');
let confirmSong = null;

function askPlay(song) {
  confirmSong = song;
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
confirmEl.addEventListener('click', (e) => { if (e.target === confirmEl) denyPlay(); });   // tapping outside the box = NO

// ---------- KEYBOARD ----------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

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
  if (lowFx) return;
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

  if (mode === 'countdown') { tickCountdown(); drawField(frozenTime, dt); return; }
  if (mode !== 'playing') return;      // starting / paused / resuming: nothing moves

  trackPerformance(dt);
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
    scoreEl.textContent = `Score: ${Math.round(displayScore).toLocaleString()}`;
  }

  // 3b) draw the whole playfield in one go
  drawField(now, dt);

  // 4) ambience
  updateBeat(now, dt);
  petals.update(dt, getTier(combo));
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