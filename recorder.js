// ============================================================
//  Note Recorder — JKT48 Rhythm
// ============================================================

// ---------- ELEMENTS ----------
const music = document.getElementById('music');
const fileInput = document.getElementById('audio-file');
const titleInput = document.getElementById('song-title');
const artistInput = document.getElementById('song-artist');
const filenameInput = document.getElementById('song-filename');

const recBtn = document.getElementById('rec-btn');
const recSaveBtn = document.getElementById('rec-save');
const recUndoBtn = document.getElementById('rec-undo');
const recCancelBtn = document.getElementById('rec-cancel');
const newRecBtn = document.getElementById('new-recording');
const downloadBtn = document.getElementById('download-chart');
const copyManifestBtn = document.getElementById('copy-manifest');

const setupScreen = document.getElementById('setup-screen');
const recordingScreen = document.getElementById('recording-screen');
const exportScreen = document.getElementById('export-screen');
const playfield = document.getElementById('playfield');

const recStatus = document.getElementById('rec-status');
const recCount = document.getElementById('rec-count');
const manifestOutput = document.getElementById('manifest-output');
const exportInfo = document.getElementById('export-info');
const chartFilenameEl = document.getElementById('chart-filename');
const chartIdEl = document.getElementById('chart-id');
const audioNameEl = document.getElementById('audio-name');
const moveChartEl = document.getElementById('move-chart');
const moveAudioEl = document.getElementById('move-audio');

const laneEls = [
  document.querySelector('.lane[data-lane="0"]'),
  document.querySelector('.lane[data-lane="1"]'),
  document.querySelector('.lane[data-lane="2"]'),
  document.querySelector('.lane[data-lane="3"]'),
];

// ---------- CONSTANTS ----------
const APPROACH_TIME = 2000;          // ms for a hold bar to fill the lane
const HOLD_THRESHOLD = 150;          // ms — shorter presses become taps
const BUTTON_CENTER_FROM_BOTTOM = 40 + 30;
const MIN_NOTE_GAP = 40;             // ms — dedupe window on the same lane
const LEAD_IN_SECONDS = 3;           // count-in before the music starts
const KEY_TO_LANE = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };

// ---------- STATE ----------
let mode = 'idle';                   // 'idle' | 'preparing' | 'recording'
let recordedChart = [];
let activePresses = {};              // sourceKey -> { startTime, lane, visualEl }
const laneOwners = new Map();        // lane -> sourceKey  (one press per lane)
const activePointers = new Map();    // pointerId -> lane

let audioBlobUrl = null;
let wallStart = 0;
let useAudio = false;

let laneBag = [];
let lastSpaceLane = -1;

let loopRunning = false;
let lastHudUpdate = 0;
let cachedLaneHeight = 0;

let countdownOverlay = null;
let countdownTimer = null;
let countdownResolve = null;

// ---------- HELPERS ----------
function getRecTime() {
  return useAudio ? music.currentTime * 1000 : performance.now() - wallStart;
}

function formatTime(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function songIdFrom(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function jsString(str) {
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ---------- FILE INPUT ----------
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
  audioBlobUrl = URL.createObjectURL(file);
  music.src = audioBlobUrl;
  music.load();

  if (!filenameInput.value) filenameInput.value = file.name;
  if (!titleInput.value) {
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    titleInput.value = base.replace(/\b\w/g, c => c.toUpperCase());
  }

  recBtn.disabled = false;
});

music.addEventListener('error', () => {
  if (!music.src) return;
  alert('Could not load that audio file. Please pick a valid .mp3 / .ogg.');
});

// ---------- SHUFFLE BAG (random recording lanes) ----------
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextSpaceLane() {
  if (laneBag.length === 0) {
    laneBag = shuffleInPlace([0, 1, 2, 3]);
    if (laneBag[0] === lastSpaceLane && laneBag.length > 1) {
      const swap = 1 + Math.floor(Math.random() * (laneBag.length - 1));
      [laneBag[0], laneBag[swap]] = [laneBag[swap], laneBag[0]];
    }
  }
  const lane = laneBag.shift();
  lastSpaceLane = lane;
  return lane;
}

function nextFreeSpaceLane() {
  for (let i = 0; i < 8; i++) {
    const lane = nextSpaceLane();
    if (!laneOwners.has(lane)) return lane;
  }
  return null; // all lanes busy — ignore this press
}

// ---------- NOTE FACTORY ----------
function makeNote() {
  const el = document.createElement('div');
  el.className = 'note';
  for (const cls of ['layer layer-pink', 'layer layer-blue', 'layer layer-gold']) {
    const layer = document.createElement('div');
    layer.className = cls;
    el.appendChild(layer);
  }
  return el;
}

// ---------- LANE VISUALS ----------
function flashLane(i) {
  const el = laneEls[i];
  if (!el) return;
  el.classList.add('key-flash');
  setTimeout(() => el.classList.remove('key-flash'), 160);
}

function setLanePressed(laneIndex, pressed) {
  const lane = laneEls[laneIndex];
  if (!lane) return;
  lane.classList.toggle('lane-pressed', pressed);
  const line = lane.querySelector('.judgement-line');
  if (line) line.classList.toggle('pressed', pressed);
}

function clearLaneState() {
  laneOwners.clear();
  activePointers.clear();
  laneEls.forEach((_, i) => setLanePressed(i, false));
}

function clearActivePresses() {
  for (const key of Object.keys(activePresses)) {
    activePresses[key].visualEl.remove();
  }
  activePresses = {};
  clearLaneState();
}

// ---------- COUNT-IN ----------
function runCountdown(seconds) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'display:flex',
      'align-items:center', 'justify-content:center',
      'font:700 22vh/1 system-ui,-apple-system,sans-serif',
      'color:#fff', 'z-index:9999', 'pointer-events:none',
      'text-shadow:0 0 40px rgba(0,0,0,.85),0 4px 12px rgba(0,0,0,.6)'
    ].join(';');
    document.body.appendChild(overlay);

    countdownOverlay = overlay;
    countdownResolve = () => resolve(false);

    let n = seconds;
    overlay.textContent = String(n);

    countdownTimer = setInterval(() => {
      n--;
      if (n > 0) {
        overlay.textContent = String(n);
        return;
      }
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownResolve = null;
      countdownOverlay = null;

      overlay.textContent = 'GO!';
      setTimeout(() => overlay.remove(), 450);
      resolve(true);
    }, 1000);
  });
}

function cancelCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (countdownOverlay) { countdownOverlay.remove(); countdownOverlay = null; }
  if (countdownResolve) { const r = countdownResolve; countdownResolve = null; r(); }
}

// ---------- RECORDING ----------
async function startRecording() {
  if (mode !== 'idle') return;

  const title = titleInput.value.trim();
  const filename = filenameInput.value.trim();
  if (!audioBlobUrl) { alert('Choose an audio file first.'); return; }
  if (!title) { alert('Enter a song title.'); return; }
  if (!filename) { alert('Enter an audio filename (the mp3 you put in music/).'); return; }

  mode = 'preparing';

  recordedChart = [];
  activePresses = {};
  clearLaneState();
  laneBag = [];
  lastSpaceLane = -1;
  cachedLaneHeight = 0;

  setupScreen.style.display = 'none';
  exportScreen.style.display = 'none';
  recordingScreen.style.display = '';

  recStatus.textContent = '⏳ Loading audio…';
  recCount.textContent = '0 notes';

  // Prime the audio element so playback starts instantly and reliably.
  useAudio = true;
  try {
    music.pause();
    music.currentTime = 0;
    await music.play();
    music.pause();
    music.currentTime = 0;
  } catch (err) {
    useAudio = false; // no audio — fall back to the wall clock
  }

  if (mode !== 'preparing') return; // cancelled while loading

  recStatus.textContent = '🎙 Get ready…';
  const ok = await runCountdown(LEAD_IN_SECONDS);
  if (!ok || mode !== 'preparing') return; // cancelled during count-in

  mode = 'recording';
  wallStart = performance.now();

  if (useAudio) {
    music.play().catch(() => {
      useAudio = false;
      wallStart = performance.now();
    });
  }

  recStatus.textContent = '🎙 RECORDING...';
  updateRecCount();
  startLoop();
}

function startLoop() {
  if (loopRunning) return;
  loopRunning = true;
  lastHudUpdate = 0;
  requestAnimationFrame(recUpdate);
}

function recUpdate() {
  if (mode !== 'recording') {
    loopRunning = false;
    return;
  }

  const now = getRecTime();

  if (!cachedLaneHeight) cachedLaneHeight = laneEls[0].clientHeight || 1;
  const hitY = Math.max(1, cachedLaneHeight - BUTTON_CENTER_FROM_BOTTOM);

  for (const press of Object.values(activePresses)) {
    const h = Math.max(2, Math.min((now - press.startTime) / APPROACH_TIME * hitY, hitY));
    press.visualEl.style.height = h + 'px';
  }

  if (now - lastHudUpdate > 100) {
    lastHudUpdate = now;
    updateRecCount();
  }

  requestAnimationFrame(recUpdate);
}

function updateRecCount() {
  const n = recordedChart.length;
  let holds = 0;
  for (const note of recordedChart) if (note.duration) holds++;

  let text = `${n} note${n === 1 ? '' : 's'}`;
  if (holds) text += ` · ${holds} hold${holds === 1 ? '' : 's'}`;
  if (mode === 'recording') text += ` · ${formatTime(getRecTime())}`;

  recCount.textContent = text;
}

// ---------- LANE DOWN / UP ----------
function laneDown(lane, sourceKey) {
  if (mode !== 'recording') return;
  if (laneOwners.has(lane)) return;         // that lane is already held

  const t = getRecTime();
  if (!Number.isFinite(t) || t < 0) return;

  laneOwners.set(lane, sourceKey);
  setLanePressed(lane, true);
  flashLane(lane);

  const el = makeNote();
  el.classList.add('hold');
  el.style.bottom = BUTTON_CENTER_FROM_BOTTOM + 'px';
  el.style.top = 'auto';
  el.style.height = '0px';
  laneEls[lane].appendChild(el);

  activePresses[sourceKey] = { startTime: t, lane, visualEl: el };
}

function laneUp(lane, sourceKey) {
  if (laneOwners.get(lane) !== sourceKey) return; // not ours
  laneOwners.delete(lane);
  setLanePressed(lane, false);
  finalizePress(sourceKey);
}

function finalizePress(sourceKey) {
  const press = activePresses[sourceKey];
  if (!press) return;
  delete activePresses[sourceKey];

  const duration = Math.max(0, getRecTime() - press.startTime);
  press.visualEl.remove();

  const note = { time: Math.max(0, Math.round(press.startTime)), lane: press.lane };
  if (duration >= HOLD_THRESHOLD) note.duration = Math.round(duration);

  recordedChart.push(note);
  updateRecCount();
}

// ---------- SPACE (random lane) ----------
function spaceDown() {
  if (mode !== 'recording') return;
  if (activePresses['Space']) return;

  const lane = nextFreeSpaceLane();
  if (lane === null) return;

  laneDown(lane, 'Space');
}

function spaceUp() {
  const press = activePresses['Space'];
  if (!press) return;
  laneUp(press.lane, 'Space');
}

// ---------- UNDO ----------
function undoLastNote() {
  if (mode !== 'recording' || !recordedChart.length) return;
  recordedChart.pop();
  updateRecCount();
}

// ---------- STOP / SAVE ----------
function stopRecording() {
  if (mode !== 'recording') return;

  // Close out anything still held down.
  Object.keys(activePresses).forEach(key => finalizePress(key));

  mode = 'idle';
  music.pause();
  clearLaneState();

  // Sort first, then drop accidental double-triggers on the same lane.
  recordedChart.sort((a, b) => a.time - b.time || a.lane - b.lane);

  const cleaned = [];
  const lastByLane = new Map();
  for (const note of recordedChart) {
    const prev = lastByLane.get(note.lane);
    if (prev && note.time - prev.time < MIN_NOTE_GAP) {
      // Keep the hold if one of the two was a hold.
      if (note.duration && !prev.duration) {
        prev.time = note.time;
        prev.duration = note.duration;
      }
      continue;
    }
    cleaned.push(note);
    lastByLane.set(note.lane, note);
  }
  recordedChart = cleaned;

  if (recordedChart.length === 0) {
    alert('No notes recorded — try again!');
    cancelRecording(true);
    return;
  }

  showExport();
}

function cancelRecording(skipConfirm) {
  if (mode === 'preparing' || mode === 'recording') {
    if (!skipConfirm && recordedChart.length &&
        !confirm('Discard this recording?')) return;
  }

  cancelCountdown();
  mode = 'idle';

  clearActivePresses();
  recordedChart = [];

  music.pause();
  music.currentTime = 0;

  recordingScreen.style.display = 'none';
  exportScreen.style.display = 'none';
  setupScreen.style.display = '';
  recBtn.disabled = !audioBlobUrl;
}

// ---------- EXPORT ----------
function showExport() {
  const title = titleInput.value.trim();
  const artist = artistInput.value.trim() || 'Unknown';
  const filename = filenameInput.value.trim();
  const songId = songIdFrom(filename);

  recordingScreen.style.display = 'none';
  exportScreen.style.display = '';

  let holds = 0;
  for (const n of recordedChart) if (n.duration) holds++;

  exportInfo.textContent = `${recordedChart.length} notes (${holds} holds) · ${title}`;
  chartFilenameEl.textContent = songId + '.js';
  chartIdEl.textContent = songId;
  audioNameEl.textContent = filename;
  moveChartEl.textContent = songId + '.js';
  moveAudioEl.textContent = filename;

  manifestOutput.textContent =
`  {
    id: ${jsString(songId)},
    title: ${jsString(title)},
    artist: ${jsString(artist)},
    audio: ${jsString('music/' + filename)},
    chart: ${jsString('charts/' + songId + '.js')}
  }`;
}

function downloadChart() {
  const filename = filenameInput.value.trim();
  const songId = songIdFrom(filename);
  const content = 'window.CHART_DATA = ' + JSON.stringify(recordedChart, null, 2) + ';\n';

  const blob = new Blob([content], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = songId + '.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyManifest() {
  const text = manifestOutput.textContent;

  const done = () => {
    copyManifestBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyManifestBtn.textContent = '📋 Copy to clipboard'; }, 1500);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else {
    fallback();
  }

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    done();
  }
}

function newRecording() {
  cancelCountdown();
  music.pause();
  music.currentTime = 0;

  recordedChart = [];
  clearActivePresses();

  exportScreen.style.display = 'none';
  setupScreen.style.display = '';
  recBtn.disabled = !audioBlobUrl;
  // Title / artist / filename are kept so the user can tweak them
}

// ---------- BUTTONS ----------
recBtn.addEventListener('click', () => startRecording());
recSaveBtn.addEventListener('click', () => stopRecording());
recUndoBtn.addEventListener('click', () => undoLastNote());
recCancelBtn.addEventListener('click', () => cancelRecording(false));
downloadBtn.addEventListener('click', () => downloadChart());
copyManifestBtn.addEventListener('click', () => copyManifest());
newRecBtn.addEventListener('click', () => newRecording());

// ---------- KEYBOARD ----------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (mode !== 'recording') return;

  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault();
    stopRecording();
    return;
  }

  if (e.code === 'Escape') {
    e.preventDefault();
    cancelRecording(false);
    return;
  }

  if (e.code === 'Backspace' || e.code === 'Delete') {
    e.preventDefault();
    undoLastNote();
    return;
  }

  const lane = KEY_TO_LANE[e.code];
  if (lane !== undefined) {
    e.preventDefault();
    laneDown(lane, e.code);
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    spaceDown();
  }
});

document.addEventListener('keyup', (e) => {
  if (mode !== 'recording') return;

  const lane = KEY_TO_LANE[e.code];
  if (lane !== undefined) {
    laneUp(lane, e.code);
    return;
  }

  if (e.code === 'Space') spaceUp();
});

// ---------- POINTER INPUT (mouse / touch / pen) ----------
playfield.style.touchAction = 'none';
playfield.addEventListener('contextmenu', (e) => e.preventDefault());

function findLaneFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || typeof el.closest !== 'function') return null;
  const lane = el.closest('.lane');
  if (!lane) return null;
  const idx = Number(lane.dataset.lane);
  return Number.isNaN(idx) ? null : idx;
}

playfield.addEventListener('pointerdown', (e) => {
  if (mode !== 'recording') return;
  if (e.button !== undefined && e.button > 0) return; // ignore right/middle click
  if (activePointers.has(e.pointerId)) return;

  const lane = findLaneFromPoint(e.clientX, e.clientY);
  if (lane === null) return;

  e.preventDefault();
  activePointers.set(e.pointerId, lane);

  try { playfield.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

  laneDown(lane, 'p' + e.pointerId);
});

function releasePointer(e) {
  const lane = activePointers.get(e.pointerId);
  if (lane === undefined) return;
  activePointers.delete(e.pointerId);
  laneUp(lane, 'p' + e.pointerId);
}

playfield.addEventListener('pointerup', releasePointer);
playfield.addEventListener('pointercancel', releasePointer);

// ---------- MISC ----------
// Auto-stop if the song finishes while recording.
music.addEventListener('ended', () => {
  if (mode === 'recording') stopRecording();
});

window.addEventListener('resize', () => { cachedLaneHeight = 0; });

// Release stuck keys if the tab loses focus mid-recording.
window.addEventListener('blur', () => {
  if (mode !== 'recording') return;
  Object.keys(activePresses).forEach(key => finalizePress(key));
  clearLaneState();
});