// ============================================================
//  Chart Editor & Recorder — JKT48 Rhythm
// ============================================================

// ==== PURE:START  (no DOM here — this block is unit-tested)
const LANES = 4;
const LANE_NAMES = ['D', 'F', 'J', 'K'];
const HOLD_THRESHOLD = 150;   // ms — shorter presses are taps; resizing a hold below this makes it a tap
const MIN_NOTE_GAP = 40;      // ms — same-lane notes closer than this are merged on export
const CLOSE_GAP = 60;         // ms — same-lane notes closer than this get a warning
const DENSE_NPS = 12;         // notes inside any 1-second window above this get a warning

function formatTime(ms, decimals) {
  const t = Math.max(0, ms);
  if (decimals) {
    const tenths = Math.floor(t / 100);
    const m = Math.floor(tenths / 600);
    const s = (tenths % 600) / 10;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return m + ':' + String(s).padStart(2, '0');
}

function songIdFrom(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function jsString(str) {
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// Splits "fiony, christy olla" into ['fiony','christy','olla'] (lowercase, no blanks/duplicates).
function parseMemberList(text) {
  const out = [];
  for (const part of String(text || '').split(/[\s,;]+/)) {
    const m = part.trim().toLowerCase();
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

// The songs.js entry, formatted exactly like the ones already in songs.js.
// team: '' / 'none' -> null.  only: [] -> line left out.  cover: '' -> images/<songId>.webp
function buildSongEntry(o) {
  const team = o.team && o.team !== 'none' ? jsString(o.team) : 'null';
  const only = o.only && o.only.length ? o.only : [];
  const coverFile = (o.cover || '').trim() || (o.songId + '.webp');
  const lines = [
    '    id: ' + jsString(o.songId),
    '    title: ' + jsString(o.title),
    '    artist: ' + jsString(o.artist),
    '    team: ' + team
  ];
  if (only.length) lines.push('    only: [' + only.map(jsString).join(', ') + ']');
  lines.push('    audio: ' + jsString('music/' + o.filename));
  lines.push('    chart: ' + jsString('charts/' + o.base + '.js'));
  lines.push('    cover: ' + jsString('images/' + coverFile.replace(/^images\//, '')));
  return '  {\n' + lines.join(',\n') + '\n  }';
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random lanes without immediate repeats. isBusy(lane) can veto a lane.
function createLaneBag() {
  let bag = [];
  let last = -1;
  return function next(isBusy) {
    for (let tries = 0; tries < 8; tries++) {
      if (bag.length === 0) {
        bag = shuffleInPlace([0, 1, 2, 3]);
        if (bag[0] === last) {
          const swap = 1 + Math.floor(Math.random() * (bag.length - 1));
          [bag[0], bag[swap]] = [bag[swap], bag[0]];
        }
      }
      const lane = bag.shift();
      last = lane;
      if (!isBusy || !isBusy(lane)) return lane;
    }
    return null;
  };
}

function normalizeNotes(data) {
  const notes = [];
  let skipped = 0;
  for (const n of data) {
    if (!n || typeof n !== 'object') { skipped++; continue; }
    const time = Number(n.time);
    const lane = Number(n.lane);
    if (!Number.isFinite(time) || !Number.isInteger(lane) || lane < 0 || lane >= LANES) { skipped++; continue; }
    const note = { time: Math.max(0, Math.round(time)), lane };
    const d = Number(n.duration);
    if (Number.isFinite(d) && d > 0) note.duration = Math.round(d);
    notes.push(note);
  }
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  return { notes, skipped };
}

// Reads a chart file such as:  window.CHART_DATA = [ {...}, ... ];
function parseChartText(text) {
  let src = String(text).replace(/^\uFEFF/, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const start = src.indexOf('[');
  const end = src.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('No note list ([ ... ]) found in that file.');
  const body = src.slice(start, end + 1);

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    const fixed = body
      .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*)'/g, '"$1"')
      .replace(/,\s*([}\]])/g, '$1');
    try {
      data = JSON.parse(fixed);
    } catch (e2) {
      throw new Error('Could not read the note list — is it a valid chart file?');
    }
  }
  if (!Array.isArray(data)) throw new Error('That file does not contain a list of notes.');
  return normalizeNotes(data);
}

// Sorted, de-duplicated, id-free copy ready to write to disk.
function cleanForExport(notes) {
  const sorted = notes
    .map(n => ({
      time: Math.max(0, Math.round(n.time)),
      lane: n.lane | 0,
      duration: n.duration > 0 ? Math.round(n.duration) : 0
    }))
    .filter(n => n.lane >= 0 && n.lane < LANES)
    .sort((a, b) => a.time - b.time || a.lane - b.lane);

  const kept = [];
  const lastByLane = new Map();
  let removed = 0;
  for (const n of sorted) {
    const prev = lastByLane.get(n.lane);
    if (prev && n.time - prev.time < MIN_NOTE_GAP) {
      removed++;
      if (n.duration > 0) prev.duration = Math.max(prev.duration, n.time + n.duration - prev.time);
      continue;
    }
    kept.push(n);
    lastByLane.set(n.lane, n);
  }
  const chart = kept.map(n => {
    const out = { time: n.time, lane: n.lane };
    if (n.duration > 0) out.duration = n.duration;
    return out;
  });
  return { chart, removed };
}

function analyzeChart(notes, songMs) {
  const sorted = notes.slice().sort((a, b) => a.time - b.time || a.lane - b.lane);
  const stats = { total: sorted.length, taps: 0, holds: 0, lane: [0, 0, 0, 0], lengthMs: 0, avgNps: 0, peakNps: 0, peakAt: 0 };
  const warnings = [];
  const bad = new Set();

  const laneLast = [null, null, null, null];
  const laneEnd = [-Infinity, -Infinity, -Infinity, -Infinity];
  const laneBlocker = [null, null, null, null];
  let first = Infinity;
  let end = 0;

  for (const n of sorted) {
    const dur = n.duration > 0 ? n.duration : 0;
    if (dur) stats.holds++; else stats.taps++;
    stats.lane[n.lane]++;
    first = Math.min(first, n.time);
    end = Math.max(end, n.time + dur);

    const lane = n.lane;
    if (n.time < laneEnd[lane]) {
      warnings.push({ type: 'overlap', time: n.time, id: n.id, msg: LANE_NAMES[lane] + ': starts inside a hold' });
      bad.add(n.id);
      if (laneBlocker[lane]) bad.add(laneBlocker[lane].id);
    } else if (laneLast[lane] && n.time - laneLast[lane].time < CLOSE_GAP) {
      warnings.push({ type: 'close', time: n.time, id: n.id, msg: LANE_NAMES[lane] + ': only ' + (n.time - laneLast[lane].time) + ' ms after the previous note' });
      bad.add(n.id);
      bad.add(laneLast[lane].id);
    }
    laneLast[lane] = n;
    if (n.time + dur > laneEnd[lane]) { laneEnd[lane] = n.time + dur; laneBlocker[lane] = n; }

    if (songMs && n.time > songMs + 300) {
      warnings.push({ type: 'late', time: n.time, id: n.id, msg: 'After the end of the song' });
      bad.add(n.id);
    }
  }

  let i = 0;
  let lastDense = -1e9;
  for (let j = 0; j < sorted.length; j++) {
    while (sorted[j].time - sorted[i].time >= 1000) i++;
    const count = j - i + 1;
    if (count > stats.peakNps) { stats.peakNps = count; stats.peakAt = sorted[i].time; }
    if (count > DENSE_NPS && sorted[j].time - lastDense > 2000) {
      warnings.push({ type: 'dense', time: sorted[i].time, id: sorted[j].id, msg: count + ' notes within 1 second' });
      lastDense = sorted[j].time;
    }
  }

  stats.lengthMs = sorted.length ? end : 0;
  if (sorted.length && end > first) stats.avgNps = Math.round(sorted.length / ((end - first) / 1000) * 10) / 10;
  warnings.sort((a, b) => a.time - b.time);
  return { stats, warnings: warnings.slice(0, 500), bad };
}

// One value per windowMs, 0..1 (square-root scaled so quiet parts are still visible).
function computePeaks(channels, sampleRate, windowMs) {
  const win = Math.max(1, Math.floor(sampleRate * windowMs / 1000));
  const len = channels[0].length;
  const count = Math.ceil(len / win);
  const peaks = new Float32Array(count);
  for (const ch of channels) {
    for (let i = 0; i < count; i++) {
      const s = i * win;
      const e = Math.min(len, s + win);
      let m = 0;
      for (let k = s; k < e; k += 4) {
        const v = Math.abs(ch[k]);
        if (v > m) m = v;
      }
      if (m > peaks[i]) peaks[i] = m;
    }
  }
  let max = 0;
  for (let i = 0; i < count; i++) if (peaks[i] > max) max = peaks[i];
  if (max > 0) for (let i = 0; i < count; i++) peaks[i] = Math.sqrt(peaks[i] / max);
  return peaks;
}
// ==== PURE:END


// ---------- ELEMENTS ----------
const $ = id => document.getElementById(id);

const music = $('music');
const fileInput = $('audio-file');
const chartInput = $('chart-file');
const chartStatus = $('chart-status');
const titleInput = $('song-title');
const artistInput = $('song-artist');
const filenameInput = $('song-filename');
const teamInput = $('song-team');
const onlyInput = $('song-only');
const coverInput = $('song-cover');
const recBtn = $('rec-btn');
const editBtn = $('edit-btn');
const restoreBanner = $('restore-banner');
const restoreText = $('restore-text');

const setupScreen = $('setup-screen');
const editorScreen = $('editor-screen');
const exportScreen = $('export-screen');

const canvas = $('ed-canvas');
const stage = $('ed-stage');
const overview = $('ed-overview');
const toastEl = $('ed-toast');
const g = canvas.getContext('2d');
const og = overview.getContext('2d');

const el = {
  title: $('ed-title'), undo: $('ed-undo'), redo: $('ed-redo'), rec: $('ed-rec'),
  toolSelect: $('tool-select'), toolDraw: $('tool-draw'),
  speed: $('ed-speed'), zoom: $('ed-zoom'),
  optSnap: $('opt-snap'), optCountIn: $('opt-countin'), optHit: $('opt-hitsound'), optWave: $('opt-waveform'), optInvert: $('opt-invert'),
  play: $('ed-play'), time: $('ed-time'), total: $('ed-total'),
  selInfo: $('sel-info'), inTime: $('in-time'), inLane: $('in-lane'), inDur: $('in-dur'),
  inShift: $('in-shift'), inOffset: $('in-recoffset'),
  stats: $('ed-stats'), warn: $('ed-warn'),
};

// ---------- CONSTANTS / SETTINGS ----------
const SETTINGS_KEY = 'jktRecorder.settings.v1';
const AUTOSAVE_KEY = 'jktRecorder.autosave.v1';
const KEY_TO_LANE = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const LANE_COLORS = ['#ff6fa8', '#ffb454', '#5fd0ff', '#a98bff'];
const PEAK_MS = 10;
const MAX_UNDO = 200;
const COUNT_IN_SECONDS = 3;

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
}
const opts = Object.assign(
  { hitSound: true, waveform: true, invert: false, countIn: true, snap: true, offset: 0, zoom: 0.35 },
  loadJSON(SETTINGS_KEY)
);
function saveOpts() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(opts)); } catch (e) { /* ignore */ }
}

// ---------- STATE ----------
let mode = 'setup';                 // 'setup' | 'editor' | 'export'

// setup
let audioBlobUrl = null;
let audioFile = null;
let pendingChart = null;            // notes waiting to be opened in the editor
let chartFileName = '';

// chart
let notes = [];                     // { id, time, lane, duration? }
let nextId = 1;
let selection = new Set();
let past = [];
let future = [];
let dirty = false;
let clipboard = [];
let lastCoalesce = { key: '', at: 0 };

// view
let tool = 'select';
let recArmed = false;
let playing = false;
let viewTime = 0;                   // ms at the hit line
let pxPerMs = opts.zoom;
let rate = 1;
let songMs = 0;
let peaks = null;
let peakToken = 0;
let analysis = { stats: null, warnings: [], bad: new Set() };
let badIds = analysis.bad;

// canvas geometry
let cw = 1, ch = 1, dpr = 1;
let laneW = 90, fieldW = 360, fieldX = 0, hitY = 0;

// interaction
let drag = null;
let hover = null;
let rafId = 0;
let needsRender = true;
const flashAt = [0, 0, 0, 0];

// live recording
const livePresses = new Map();      // sourceKey -> { lane, start }
const laneOwners = new Map();       // lane -> sourceKey
const pointerLanes = new Map();     // pointerId -> lane
const nextRandomLane = createLaneBag();
let recSession = null;

// timing
let lastAudioMs = -1;
let lastAudioPerf = 0;
let soundCursor = 0;
let audioCtx = null;

// Exact playback: the song is played from the SAME decoded samples the waveform is drawn from (AudioBufferSourceNode),
// so seeking is sample-accurate and the music, the waveform and the hit clicks all share one clock (audioCtx).
// The <audio> element is only the fallback if the file could not be decoded.
let audioBuf = null;                 // decoded song
let srcNode = null;                  // the node that is playing right now
let srcStartCtx = 0;                 // audioCtx time at which the node starts playing
let srcStartOff = 0;                 // song position (ms) the node starts from
let bufPlaying = false;              // true while the exact engine is the one playing

// count-in
let countdownOverlay = null;
let countdownTimer = null;
let countdownResolve = null;
let countdownActive = false;

let analysisTimer = 0;
let autosaveTimer = 0;
let toastTimer = 0;

// ---------- SMALL HELPERS ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const timeToY = t => hitY - (t - viewTime) * pxPerMs;
const yToTime = y => viewTime + (hitY - y) / pxPerMs;
const laneToX = l => fieldX + l * laneW;
const xToLane = x => Math.floor((x - fieldX) / laneW);

// ---------- SNAP (magnet to other notes' start/end times and the playhead) ----------
const SNAP_PX = 9;                  // pull distance in screen pixels
let notesVersion = 0;
let snapCache = { ver: -1, arr: [] };

function buildSnapTargets(exclude) {
  const arr = [];
  for (const n of notes) {
    if (exclude && exclude.has(n)) continue;
    arr.push(n.time);
    if (n.duration > 0) arr.push(n.time + n.duration);
  }
  arr.sort((a, b) => a - b);
  return arr;
}

function allSnapTargets() {
  if (snapCache.ver !== notesVersion) snapCache = { ver: notesVersion, arr: buildSnapTargets(null) };
  return snapCache.arr;
}

function nearestTarget(arr, t, maxD) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < t) lo = mid + 1; else hi = mid;
  }
  let best = null;
  let bd = maxD;
  for (const i of [lo - 1, lo]) {
    if (i < 0 || i >= arr.length) continue;
    const d = Math.abs(arr[i] - t);
    if (d <= bd) { bd = d; best = arr[i]; }
  }
  return best;
}

// Returns the time to snap to, or null if nothing is close enough.
function snapTime(t, targets) {
  const thr = SNAP_PX / pxPerMs;
  let best = nearestTarget(targets, t, thr);
  if (!playing) {
    const d = Math.abs(viewTime - t);
    if (d <= thr && (best === null || d < Math.abs(best - t))) best = Math.round(viewTime);
  }
  return best;
}

// Duration of a note being drawn by dragging upward, with the end snapped if enabled.
function drawDuration(d, y, altKey) {
  const raw = (d.startY - y) / pxPerMs;
  let dur = raw;
  let snapT = null;
  if (raw >= HOLD_THRESHOLD && opts.snap && !altKey) {
    const s = snapTime(d.startTime + raw, allSnapTargets());
    if (s !== null && s - d.startTime >= HOLD_THRESHOLD) { dur = s - d.startTime; snapT = s; }
  }
  return { dur: dur >= HOLD_THRESHOLD ? Math.round(dur) : 0, snapT };
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function getSongMs() {
  if (audioBuf && audioBuf.duration > 0) return audioBuf.duration * 1000;
  const d = music.duration;
  if (Number.isFinite(d) && d > 0) return d * 1000;
  let m = 0;
  for (const n of notes) m = Math.max(m, n.time + (n.duration > 0 ? n.duration : 0));
  return m + 5000;
}

function curTime() { return playing ? playTime() : viewTime; }

// audioCtx time of the sound that is reaching the speakers right now (output latency is taken out, so the playhead is what you HEAR)
function heardCtxTime() {
  const c = audioCtx;
  const base = c.currentTime;
  const ol = c.outputLatency;
  const lat = Math.min((Number.isFinite(ol) && ol > 0) ? ol : (c.baseLatency || 0), 0.3);
  if (c.getOutputTimestamp) {                                   // smoother than currentTime, which only moves in small steps
    try {
      const ts = c.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
        const t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
        if (Math.abs(t - (base - lat)) < 0.25) return t;
      }
    } catch (e) { /* ignore */ }
  }
  return base - lat;
}

function stopBuf() {
  const n = srcNode;
  srcNode = null;
  bufPlaying = false;
  if (!n) return;
  n.onended = null;
  try { n.stop(); } catch (e) { /* ignore */ }
  try { n.disconnect(); } catch (e) { /* ignore */ }
}

// (re)starts the song from `ms`. Seeking while playing simply calls this again, there is no element seek to drift.
function startBuf(ms) {
  stopBuf();
  const ctx = ensureAudioCtx();
  if (!ctx || !audioBuf) return false;
  const node = ctx.createBufferSource();
  node.buffer = audioBuf;
  node.playbackRate.value = rate;
  node.connect(ctx.destination);
  const when = ctx.currentTime + 0.03;                          // a tiny lead so the start lands exactly on the timeline
  const off = Math.max(0, Math.min(ms / 1000, audioBuf.duration - 0.001));
  node.onended = () => {                                        // the song reached its end
    if (node !== srcNode) return;
    srcNode = null;
    if (playing) pausePlayback();
  };
  node.start(when, off);
  srcNode = node;
  srcStartCtx = when;
  srcStartOff = off * 1000;
  bufPlaying = true;
  return true;
}

function playTime() {
  if (bufPlaying) {
    if (!srcNode) return songMs;
    const p = srcStartOff + Math.max(0, heardCtxTime() - srcStartCtx) * 1000 * rate;
    return Math.min(p, songMs);
  }
  const a = music.currentTime * 1000;
  const now = performance.now();
  if (a !== lastAudioMs) { lastAudioMs = a; lastAudioPerf = now; }
  return a + Math.min((now - lastAudioPerf) * rate, 60);
}

function showScreen(name) {
  mode = name;
  setupScreen.style.display = name === 'setup' ? '' : 'none';
  editorScreen.style.display = name === 'editor' ? '' : 'none';
  exportScreen.style.display = name === 'export' ? '' : 'none';
  if (name === 'editor') { resizeCanvas(); requestRender(); }
}

// ============================================================
//  SETUP SCREEN
// ============================================================
function updateSetupButtons() {
  const ready = !!audioBlobUrl;
  recBtn.disabled = !ready;
  editBtn.disabled = !ready;
}

function loadAudioFile(file) {
  if (!file) return;
  audioFile = file;
  stopBuf();
  audioBuf = null;
  if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
  audioBlobUrl = URL.createObjectURL(file);
  music.src = audioBlobUrl;
  music.load();

  if (!filenameInput.value) filenameInput.value = file.name;
  if (!titleInput.value) {
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    titleInput.value = base.replace(/\b\w/g, c => c.toUpperCase());
  }
  viewTime = 0;
  updateSetupButtons();
  analyzeWaveform(file);
}

async function loadChartFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseChartText(text);
    pendingChart = parsed.notes;
    chartFileName = file.name;
    dirty = false;
    const holds = parsed.notes.filter(n => n.duration > 0).length;
    chartStatus.textContent = '✓ ' + file.name + ' — ' + parsed.notes.length + ' notes (' + holds + ' holds)' +
      (parsed.skipped ? ' · ' + parsed.skipped + ' invalid entries skipped' : '');
  } catch (err) {
    pendingChart = null;
    chartFileName = '';
    chartStatus.textContent = '⚠ ' + err.message;
  }
}

function handleDroppedFile(file) {
  if (/\.(js|json|txt)$/i.test(file.name)) loadChartFile(file);
  else if ((file.type && file.type.startsWith('audio')) || /\.(mp3|ogg|wav|m4a|flac|aac|opus)$/i.test(file.name)) loadAudioFile(file);
}

fileInput.addEventListener('change', e => loadAudioFile(e.target.files[0]));
chartInput.addEventListener('change', e => loadChartFile(e.target.files[0]));

document.addEventListener('dragover', e => { if (mode === 'setup') e.preventDefault(); });
document.addEventListener('drop', e => {
  if (mode !== 'setup') return;
  e.preventDefault();
  for (const f of e.dataTransfer.files) handleDroppedFile(f);
});

music.addEventListener('error', () => {
  if (!music.src) return;
  alert('Could not load that audio file. Please pick a valid .mp3 / .ogg.');
});
music.addEventListener('loadedmetadata', () => { songMs = getSongMs(); requestRender(); });
music.addEventListener('ended', () => { if (playing) pausePlayback(); });

recBtn.addEventListener('click', () => {
  openEditor();
  setRec(true);
  startPlayback();
});
editBtn.addEventListener('click', () => openEditor());

// ---------- autosave / restore ----------
function stripIds(list) {
  return list.map(n => (n.duration > 0 ? { time: n.time, lane: n.lane, duration: n.duration } : { time: n.time, lane: n.lane }));
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveAutosave, 800);
}

function saveAutosave() {
  if (!dirty) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
      title: titleInput.value, artist: artistInput.value, filename: filenameInput.value,
      team: teamInput.value, only: onlyInput.value, cover: coverInput.value,
      chartFileName, notes: stripIds(notes), savedAt: Date.now()
    }));
  } catch (e) { /* storage full or blocked — ignore */ }
}

function clearAutosave() {
  clearTimeout(autosaveTimer);
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
}

function checkAutosave() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); } catch (e) { /* ignore */ }
  if (!saved || !Array.isArray(saved.notes) || !saved.notes.length) return;

  const when = new Date(saved.savedAt || Date.now()).toLocaleString();
  restoreText.textContent = '🕘 Unsaved work found (' + saved.notes.length + ' notes' +
    (saved.title ? ' · ' + saved.title : '') + ', ' + when + '). Restore it, then choose the audio file again.';
  restoreBanner.style.display = 'block';

  $('restore-btn').onclick = () => {
    const parsed = normalizeNotes(saved.notes);
    pendingChart = parsed.notes;
    chartFileName = saved.chartFileName || '';
    if (saved.title && !titleInput.value) titleInput.value = saved.title;
    if (saved.artist) artistInput.value = saved.artist;
    if (saved.filename && !filenameInput.value) filenameInput.value = saved.filename;
    if (saved.team) teamInput.value = saved.team;
    if (saved.only) onlyInput.value = saved.only;
    if (saved.cover) coverInput.value = saved.cover;
    dirty = true;
    chartStatus.textContent = '✓ Restored ' + parsed.notes.length + ' notes from your last session — now choose the audio file.';
    restoreBanner.style.display = 'none';
  };
  $('restore-discard').onclick = () => {
    clearAutosave();
    restoreBanner.style.display = 'none';
  };
}

window.addEventListener('beforeunload', e => {
  if (dirty && notes.length) { saveAutosave(); e.preventDefault(); e.returnValue = ''; }
});

// ---------- waveform ----------
async function analyzeWaveform(file) {
  peaks = null;
  const token = ++peakToken;
  try {
    const ac = ensureAudioCtx();
    if (!ac) return;
    const buf = await file.arrayBuffer();
    const audio = await new Promise((resolve, reject) => ac.decodeAudioData(buf, resolve, reject));
    if (token !== peakToken) return;
    audioBuf = audio;                                          // kept: playback uses these exact samples
    songMs = getSongMs();
    const channels = [];
    for (let i = 0; i < audio.numberOfChannels; i++) channels.push(audio.getChannelData(i));
    peaks = computePeaks(channels, audio.sampleRate, PEAK_MS);
    requestRender();
  } catch (e) {
    peaks = null;
  }
}

// ============================================================
//  OPEN EDITOR
// ============================================================
function openEditor() {
  if (!audioBlobUrl) { alert('Choose an audio file first.'); return; }

  notes = (pendingChart || []).map(n => {
    const o = { id: nextId++, time: n.time, lane: n.lane };
    if (n.duration > 0) o.duration = n.duration;
    return o;
  });
  selection = new Set();
  past = [];
  future = [];
  livePresses.clear();
  laneOwners.clear();
  viewTime = 0;
  songMs = getSongMs();
  playing = false;
  recArmed = false;
  syncControls();
  showScreen('editor');
  updateSelectionUI();
  updateUndoButtons();
  updateTitle();
  runAnalysis();
  requestRender();
}

function leaveEditor() {
  if (playing || countdownActive) pausePlayback();
  pendingChart = stripIds(notes);
  saveAutosave();
  showScreen('setup');
  updateSetupButtons();
  chartStatus.textContent = '✓ Editing ' + notes.length + ' notes' + (chartFileName ? ' (' + chartFileName + ')' : '') +
    ' — click OPEN EDITOR to continue.';
}

function updateTitle() {
  el.title.textContent = (titleInput.value.trim() || 'Untitled') + (dirty ? '  •' : '');
  el.title.title = dirty ? 'Unsaved changes' : '';
}

function syncControls() {
  el.optSnap.checked = !!opts.snap;
  el.optCountIn.checked = !!opts.countIn;
  el.optHit.checked = !!opts.hitSound;
  el.optWave.checked = !!opts.waveform;
  el.optInvert.checked = !!opts.invert;
  el.inOffset.value = opts.offset;
  el.zoom.value = pxPerMs;
  el.speed.value = String(rate);
  setTool(tool);
  setRec(false);
  el.play.textContent = '▶';
}

// ============================================================
//  HISTORY (undo / redo)
// ============================================================
function snap() { return JSON.stringify(notes); }

function pushUndo(snapshot) {
  past.push(snapshot);
  if (past.length > MAX_UNDO) past.shift();
  future = [];
}

function restore(snapshot) {
  notes = JSON.parse(snapshot);
  let maxId = 0;
  for (const n of notes) maxId = Math.max(maxId, n.id);
  nextId = Math.max(nextId, maxId + 1);
  const ids = new Set(notes.map(n => n.id));
  selection = new Set([...selection].filter(id => ids.has(id)));
}

function sortNotes() {
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
}

// Every edit goes through here: snapshot → change → sort → refresh.
// coalesceKey merges rapid repeats (e.g. holding an arrow key) into one undo step.
function applyChange(fn, coalesceKey) {
  const now = performance.now();
  const merge = coalesceKey && lastCoalesce.key === coalesceKey && now - lastCoalesce.at < 700;
  if (!merge) pushUndo(snap());
  lastCoalesce = { key: coalesceKey || '', at: now };
  fn();
  sortNotes();
  afterChange();
}

function afterChange() {
  dirty = true;
  notesVersion++;
  songMs = getSongMs();
  updateSelectionUI();
  updateUndoButtons();
  updateTitle();
  scheduleAnalysis();
  scheduleAutosave();
  requestRender();
}

function undo() {
  if (!past.length) return;
  future.push(snap());
  restore(past.pop());
  lastCoalesce = { key: '', at: 0 };
  afterChange();
}

function redo() {
  if (!future.length) return;
  past.push(snap());
  restore(future.pop());
  lastCoalesce = { key: '', at: 0 };
  afterChange();
}

function updateUndoButtons() {
  el.undo.disabled = !past.length;
  el.redo.disabled = !future.length;
}

// ============================================================
//  EDIT OPERATIONS
// ============================================================
function selectedNotes() { return notes.filter(n => selection.has(n.id)); }

function addNoteUndoable(time, lane, dur, select) {
  time = Math.max(0, Math.round(time));
  if (notes.some(n => n.lane === lane && Math.abs(n.time - time) < MIN_NOTE_GAP)) return null;
  let created = null;
  applyChange(() => {
    created = { id: nextId++, time, lane };
    if (dur >= HOLD_THRESHOLD) created.duration = Math.round(dur);
    notes.push(created);
    if (select) selection = new Set([created.id]);
  });
  if (opts.hitSound && audioCtx) click(audioCtx.currentTime);
  return created;
}

function deleteIds(ids) {
  const set = new Set(ids);
  applyChange(() => {
    notes = notes.filter(n => !set.has(n.id));
    selection = new Set([...selection].filter(id => !set.has(id)));
  });
}

function deleteSelection() {
  if (!selection.size) return;
  const count = selection.size;
  deleteIds([...selection]);
  toast('Deleted ' + count + ' note' + (count === 1 ? '' : 's'));
}

function selectAll() {
  selection = new Set(notes.map(n => n.id));
  updateSelectionUI();
  requestRender();
}

// Select every note that is in front of the playhead (start time at or after the needle).
function selectAhead() {
  const t = curTime();
  const ahead = notes.filter(n => n.time >= t);
  if (!ahead.length) { toast('No notes ahead of the playhead'); return; }
  selection = new Set(ahead.map(n => n.id));
  updateSelectionUI();
  requestRender();
  toast('Selected ' + ahead.length + ' note' + (ahead.length === 1 ? '' : 's') + ' ahead');
}

function mirrorSelection() {
  if (!selection.size) return;
  applyChange(() => { for (const n of selectedNotes()) n.lane = LANES - 1 - n.lane; });
}

function shuffleSelection() {
  if (!selection.size) return;
  applyChange(() => {
    const bag = createLaneBag();
    const list = selectedNotes().sort((a, b) => a.time - b.time);
    for (const n of list) n.lane = bag(null);
  });
}

function selectionToTap() {
  const holds = selectedNotes().filter(n => n.duration > 0);
  if (!holds.length) { toast('No holds selected'); return; }
  applyChange(() => { for (const n of holds) delete n.duration; });
}

function nudge(dt, dl) {
  const list = selectedNotes();
  if (!list.length) return;
  let minT = Infinity, minL = Infinity, maxL = -Infinity;
  for (const n of list) { minT = Math.min(minT, n.time); minL = Math.min(minL, n.lane); maxL = Math.max(maxL, n.lane); }
  dt = Math.max(dt, -minT);
  dl = clamp(dl, -minL, LANES - 1 - maxL);
  if (!dt && !dl) return;
  applyChange(() => {
    for (const n of list) { n.time += dt; n.lane += dl; }
  }, 'nudge');
}

function shiftTimes() {
  const ms = Math.round(Number(el.inShift.value) || 0);
  if (!ms) return;
  const list = selection.size ? selectedNotes() : notes;
  if (!list.length) return;
  applyChange(() => { for (const n of list) n.time = Math.max(0, n.time + ms); });
  toast('Shifted ' + list.length + ' notes by ' + (ms > 0 ? '+' : '') + ms + ' ms');
}

function copySelection() {
  const list = selectedNotes().sort((a, b) => a.time - b.time);
  if (!list.length) return false;
  const base = list[0].time;
  clipboard = list.map(n => ({ dt: n.time - base, lane: n.lane, duration: n.duration > 0 ? n.duration : 0 }));
  toast('Copied ' + list.length + ' notes');
  return true;
}

function cutSelection() {
  if (copySelection()) deleteIds([...selection]);
}

function pasteClipboard() {
  if (!clipboard.length) return;
  const base = Math.round(curTime());
  const created = [];
  applyChange(() => {
    for (const c of clipboard) {
      const n = { id: nextId++, time: base + c.dt, lane: c.lane };
      if (c.duration > 0) n.duration = c.duration;
      notes.push(n);
      created.push(n.id);
    }
    selection = new Set(created);
  });
  toast('Pasted ' + created.length + ' notes at the playhead');
}

function editSingle(fn) {
  const list = selectedNotes();
  if (list.length !== 1) return;
  applyChange(() => fn(list[0]));
}

el.inTime.addEventListener('change', () => editSingle(n => { n.time = Math.max(0, Math.round(Number(el.inTime.value) || 0)); }));
el.inLane.addEventListener('change', () => editSingle(n => { n.lane = clamp(Number(el.inLane.value) | 0, 0, LANES - 1); }));
el.inDur.addEventListener('change', () => editSingle(n => {
  const d = Math.round(Number(el.inDur.value) || 0);
  if (d > 0) n.duration = d; else delete n.duration;
}));

function updateSelectionUI() {
  const n = selection.size;
  el.selInfo.textContent = n ? n + ' selected' : 'none';
  const single = n === 1 ? selectedNotes()[0] : null;
  el.inTime.disabled = el.inLane.disabled = el.inDur.disabled = !single;
  if (single) {
    el.inTime.value = single.time;
    el.inLane.value = String(single.lane);
    el.inDur.value = single.duration > 0 ? single.duration : 0;
  } else {
    el.inTime.value = '';
    el.inDur.value = '';
  }
  $('btn-delete').disabled = !n;
  $('btn-mirror').disabled = !n;
  $('btn-shuffle').disabled = !n;
  $('btn-tap').disabled = !n;
}

// ============================================================
//  ANALYSIS (stats + warnings)
// ============================================================
function scheduleAnalysis() {
  clearTimeout(analysisTimer);
  analysisTimer = setTimeout(runAnalysis, 150);
}

function runAnalysis() {
  analysis = analyzeChart(notes, songMs);
  badIds = analysis.bad;
  renderStats();
  renderWarnings();
  requestRender();
}

function renderStats() {
  const s = analysis.stats;
  if (!s) { el.stats.textContent = ''; return; }
  const row = (a, b) => '<div><span>' + a + '</span><b>' + b + '</b></div>';
  el.stats.innerHTML =
    row('Notes', s.total + ' (' + s.holds + ' holds)') +
    row('Chart length', formatTime(s.lengthMs)) +
    row('Average', s.avgNps + ' notes/s') +
    row('Peak', s.peakNps + ' notes/s' + (s.peakNps ? ' @ ' + formatTime(s.peakAt) : '')) +
    row('Lanes', LANE_NAMES.map((l, i) => l + ' ' + s.lane[i]).join(' · '));
}

function renderWarnings() {
  const list = analysis.warnings;
  el.warn.innerHTML = '';
  if (!list.length) {
    el.warn.textContent = notes.length ? '✓ No problems found' : 'Nothing to check yet';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const w of list.slice(0, 80)) {
    const b = document.createElement('button');
    b.className = 'ed-warn-item';
    b.dataset.time = String(w.time);
    b.dataset.id = String(w.id);
    b.textContent = formatTime(w.time, true) + ' — ' + w.msg;
    frag.appendChild(b);
  }
  if (list.length > 80) {
    const more = document.createElement('div');
    more.className = 'ed-hint';
    more.textContent = '+ ' + (list.length - 80) + ' more';
    frag.appendChild(more);
  }
  el.warn.appendChild(frag);
}

el.warn.addEventListener('click', e => {
  const b = e.target.closest('.ed-warn-item');
  if (!b) return;
  seek(Number(b.dataset.time));
  const id = Number(b.dataset.id);
  if (notes.some(n => n.id === id)) selection = new Set([id]);
  updateSelectionUI();
  requestRender();
});

// ============================================================
//  PLAYBACK
// ============================================================
function ensureAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function click(when) {
  if (!audioCtx) return;
  const t = Math.max(when, audioCtx.currentTime);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 1500;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

function scheduleSounds() {
  if (!opts.hitSound || !audioCtx) { soundCursor = viewTime; return; }
  if (bufPlaying && srcNode) {
    // every click is placed on the same audio-clock timeline as the music, so it lands exactly on its note
    const graph = srcStartOff + Math.max(0, audioCtx.currentTime - srcStartCtx) * 1000 * rate;
    const horizon = graph + 120 * rate;
    for (const n of notes) {
      if (n.time >= soundCursor && n.time < horizon) click(srcStartCtx + (n.time - srcStartOff) / 1000 / rate);
    }
    soundCursor = horizon;
    return;
  }
  const horizon = viewTime + 90 * rate;
  for (const n of notes) {
    if (n.time >= soundCursor && n.time < horizon) {
      click(audioCtx.currentTime + (n.time - viewTime) / 1000 / rate);
    }
  }
  soundCursor = horizon;
}

function runCountdown(seconds) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
      'font:700 22vh/1 system-ui,-apple-system,sans-serif', 'color:#fff', 'z-index:9999', 'pointer-events:none',
      'text-shadow:0 0 40px rgba(0,0,0,.85),0 4px 12px rgba(0,0,0,.6)'
    ].join(';');
    document.body.appendChild(overlay);

    countdownOverlay = overlay;
    countdownResolve = () => resolve(false);
    let n = seconds;
    overlay.textContent = String(n);

    countdownTimer = setInterval(() => {
      n--;
      if (n > 0) { overlay.textContent = String(n); return; }
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
  countdownActive = false;
}

async function startPlayback() {
  if (playing || countdownActive || mode !== 'editor') return;
  ensureAudioCtx();

  if (viewTime >= songMs - 50) viewTime = 0;

  if (recArmed && opts.countIn) {
    countdownActive = true;
    el.play.textContent = '⏸';
    const ok = await runCountdown(COUNT_IN_SECONDS);
    countdownActive = false;
    if (!ok || mode !== 'editor') { el.play.textContent = '▶'; return; }
  }

  const ctx = ensureAudioCtx();
  if (audioBuf && ctx) {
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
    if (startBuf(viewTime)) music.pause();
  }
  if (!bufPlaying) {                                            // fallback: the file could not be decoded (or is still decoding)
    music.currentTime = viewTime / 1000;
    music.playbackRate = rate;
    try {
      await music.play();
    } catch (err) {
      toast('Could not play the audio file');
      el.play.textContent = '▶';
      return;
    }
  }
  lastAudioMs = -1;
  playing = true;
  soundCursor = viewTime;
  if (recArmed) beginRecSession();
  el.play.textContent = '⏸';
  requestRender();
}

function pausePlayback() {
  if (countdownActive) { cancelCountdown(); el.play.textContent = '▶'; return; }
  if (!playing) return;
  viewTime = Math.min(playTime(), songMs);
  finalizeLivePresses();
  stopBuf();
  music.pause();
  playing = false;
  endRecSession();
  el.play.textContent = '▶';
  requestRender();
}

function togglePlay() {
  if (playing || countdownActive) pausePlayback(); else startPlayback();
}

function seek(ms) {
  ms = clamp(ms, 0, songMs);
  viewTime = ms;
  if (playing) {
    if (bufPlaying) startBuf(ms);                               // exact: restarts from the sample, nothing to drift
    else { music.currentTime = ms / 1000; lastAudioMs = -1; }
    soundCursor = ms;
  }
  requestRender();
}

el.speed.addEventListener('change', () => {
  const newRate = Number(el.speed.value) || 1;
  if (bufPlaying && srcNode && audioCtx) {                      // re-anchor the timeline so the position does not jump
    const now = audioCtx.currentTime;
    if (now > srcStartCtx) { srcStartOff += (now - srcStartCtx) * 1000 * rate; srcStartCtx = now; }
    srcNode.playbackRate.value = newRate;
  }
  rate = newRate;
  music.playbackRate = rate;
  try { music.preservesPitch = true; } catch (e) { /* ignore */ }
});

// ============================================================
//  RECORDING (live, on top of the chart)
// ============================================================
function setRec(on) {
  recArmed = !!on;
  el.rec.classList.toggle('armed', recArmed);
  if (playing) {
    if (recArmed) beginRecSession();
    else { finalizeLivePresses(); endRecSession(); }
  }
  if (mode === 'editor' && on) toast('REC armed — D F J K / Space record notes while playing');
  requestRender();
}

function beginRecSession() { recSession = { snap: snap(), pushed: false }; }
function endRecSession() { recSession = null; }

function addRecorded(time, lane, dur) {
  time = Math.max(0, Math.round(time + (Number(opts.offset) || 0)));
  if (notes.some(n => n.lane === lane && Math.abs(n.time - time) < MIN_NOTE_GAP)) return;
  const n = { id: nextId++, time, lane };
  if (dur >= HOLD_THRESHOLD) n.duration = Math.round(dur);

  if (recSession) {
    if (!recSession.pushed) { pushUndo(recSession.snap); recSession.pushed = true; }
    notes.push(n);
    sortNotes();
    afterChange();
  } else {
    applyChange(() => { notes.push(n); });
  }
}

function laneDown(lane, key) {
  if (!recArmed || mode !== 'editor') return;
  if (laneOwners.has(lane)) return;
  ensureAudioCtx();
  flashAt[lane] = performance.now();

  if (!playing) {
    // Paused: drop a tap right at the playhead.
    addNoteUndoable(viewTime, lane, 0, true);
    requestRender();
    return;
  }
  const t = playTime();
  laneOwners.set(lane, key);
  livePresses.set(key, { lane, start: t });
  if (opts.hitSound && audioCtx) click(audioCtx.currentTime);
  requestRender();
}

function laneUp(lane, key) {
  if (laneOwners.get(lane) !== key) return;
  laneOwners.delete(lane);
  const press = livePresses.get(key);
  livePresses.delete(key);
  if (!press) return;
  const dur = playing ? playTime() - press.start : 0;
  addRecorded(press.start, lane, dur);
  requestRender();
}

function finalizeLivePresses() {
  for (const [key, press] of [...livePresses.entries()]) laneUp(press.lane, key);
  livePresses.clear();
  laneOwners.clear();
  pointerLanes.clear();
}

function spaceDown() {
  if (livePresses.has('Space')) return;
  const lane = nextRandomLane(l => laneOwners.has(l));
  if (lane === null) return;
  laneDown(lane, 'Space');
}

function spaceUp() {
  const press = livePresses.get('Space');
  if (press) laneUp(press.lane, 'Space');
}

// ============================================================
//  CANVAS: LAYOUT + DRAWING
// ============================================================
function resizeCanvas() {
  const r = stage.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  cw = Math.max(1, Math.floor(r.width));
  ch = Math.max(1, Math.floor(r.height));
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);

  laneW = clamp(Math.floor((cw - 90) / 4), 44, 110);
  fieldW = laneW * LANES;
  fieldX = Math.max(60, Math.floor((cw - fieldW) / 2));
  hitY = ch - Math.min(110, Math.floor(ch * 0.2));

  const o = overview.getBoundingClientRect();
  overview.width = Math.max(1, Math.floor(o.width * dpr));
  overview.height = Math.max(1, Math.floor(o.height * dpr));
  requestRender();
}

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => { if (mode === 'editor') resizeCanvas(); }).observe(stage);
}
window.addEventListener('resize', () => { if (mode === 'editor') resizeCanvas(); });

function requestRender() {
  needsRender = true;
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function frame() {
  rafId = 0;
  if (mode !== 'editor') return;

  if (playing) {
    viewTime = playTime();
    if (viewTime >= songMs && (music.ended || (bufPlaying && !srcNode))) { pausePlayback(); }
    else scheduleSounds();
    needsRender = true;
  }
  if (needsRender) {
    needsRender = false;
    draw();
    drawOverview();
    el.time.textContent = formatTime(viewTime, true);
    el.total.textContent = formatTime(songMs);
  }
  const now = performance.now();
  const flashing = flashAt.some(t => now - t < 200);
  if (playing || flashing) requestRender();
}

function roundRect(c, x, y, w, h, r) {
  if (h <= 0 || w <= 0) { c.beginPath(); return; }
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function draw() {
  const c = g;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#0d0b14';
  c.fillRect(0, 0, cw, ch);

  for (let i = 0; i < LANES; i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.06)';
    c.fillRect(laneToX(i), 0, laneW, ch);
  }

  if (opts.waveform && peaks) drawWaveform(c);
  drawGrid(c);

  // already-played area (below the hit line)
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(fieldX, hitY, fieldW, ch - hitY);

  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 1;
  for (let i = 0; i <= LANES; i++) {
    const x = Math.round(laneToX(i)) + 0.5;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ch); c.stroke();
  }

  drawNotes(c);
  drawLivePresses(c);
  drawHitLine(c);
  drawOverlays(c);

  if (!notes.length && !livePresses.size) {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '14px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Empty chart — press R, then ▶ to record,', fieldX + fieldW / 2, hitY - 90);
    c.fillText('or pick the Draw tool (B) and click in a lane', fieldX + fieldW / 2, hitY - 68);
  }
}

function drawWaveform(c) {
  c.fillStyle = 'rgba(110,190,255,0.22)';
  const step = 2;
  for (let y = 0; y < ch; y += step) {
    const tHi = yToTime(y);
    const tLo = yToTime(y + step);
    if (tHi < 0) continue;
    const i0 = Math.max(0, Math.floor(tLo / PEAK_MS));
    const i1 = Math.floor(tHi / PEAK_MS);
    if (i0 >= peaks.length) continue;
    let m = 0;
    for (let i = i0; i <= i1 && i < peaks.length; i++) if (peaks[i] > m) m = peaks[i];
    const w = m * fieldW * 0.96;
    c.fillRect(fieldX + (fieldW - w) / 2, y, w, step);
  }
}

function drawGrid(c) {
  const steps = [100, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];
  const step = steps.find(s => s * pxPerMs >= 52) || 60000;
  const tTop = yToTime(0);
  const tBot = yToTime(ch);
  const start = Math.max(0, Math.floor(tBot / step) * step);
  c.font = '11px system-ui, sans-serif';
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  for (let t = start; t <= tTop; t += step) {
    const y = Math.round(timeToY(t)) + 0.5;
    const major = t % (step * 4) === 0;
    c.strokeStyle = major ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(fieldX, y); c.lineTo(fieldX + fieldW, y); c.stroke();
    c.fillStyle = major ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
    c.fillText(formatTime(t, step < 1000), fieldX - 8, y);
  }
}

function drawNote(c, time, lane, dur, o) {
  const x = laneToX(lane);
  const y = timeToY(time);
  const nw = laneW - 14;
  const nh = 22;
  if (o.ghost) c.globalAlpha = 0.55;

  if (dur > 0) {
    const yEnd = timeToY(time + dur);
    const bx = x + 18;
    const bw = laneW - 36;
    c.fillStyle = o.live ? 'rgba(255,64,96,0.45)' : o.sel ? 'rgba(255,225,77,0.42)' : 'rgba(255,111,168,0.40)';
    roundRect(c, bx, yEnd, bw, y - yEnd, 6);
    c.fill();
    c.fillStyle = o.sel ? '#ffe14d' : 'rgba(255,255,255,0.9)';
    c.fillRect(bx - 3, yEnd - 3, bw + 6, 6);
  }

  const grad = c.createLinearGradient(0, y - nh / 2, 0, y + nh / 2);
  grad.addColorStop(0, o.live ? '#ff7a8f' : '#ffa6cc');
  grad.addColorStop(1, o.live ? '#e0203f' : '#ff4f9a');
  c.fillStyle = grad;
  roundRect(c, x + 7, y - nh / 2, nw, nh, 8);
  c.fill();
  c.lineWidth = o.sel || o.bad ? 3 : 1.5;
  c.strokeStyle = o.bad ? '#ff3b3b' : o.sel ? '#ffe14d' : 'rgba(255,255,255,0.9)';
  c.stroke();
  c.globalAlpha = 1;
}

function drawNotes(c) {
  const tTop = yToTime(-40);
  const tBot = yToTime(ch + 40);
  for (const n of notes) {
    const dur = n.duration > 0 ? n.duration : 0;
    if (n.time > tTop || n.time + dur < tBot) continue;
    drawNote(c, n.time, n.lane, dur, { sel: selection.has(n.id), bad: badIds.has(n.id) });
  }
}

function drawLivePresses(c) {
  if (!livePresses.size) return;
  const now = playing ? viewTime : 0;
  for (const press of livePresses.values()) {
    drawNote(c, press.start, press.lane, Math.max(0, now - press.start), { live: true });
  }
}

function drawHitLine(c) {
  const now = performance.now();
  c.strokeStyle = recArmed ? '#ff4060' : 'rgba(255,255,255,0.85)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(fieldX - 12, hitY);
  c.lineTo(fieldX + fieldW + 12, hitY);
  c.stroke();

  c.font = '700 13px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i < LANES; i++) {
    const cx = laneToX(i) + laneW / 2;
    const lit = laneOwners.has(i) || now - flashAt[i] < 160;
    c.beginPath();
    c.arc(cx, hitY + 34, 15, 0, Math.PI * 2);
    c.fillStyle = lit ? LANE_COLORS[i] : 'rgba(20,16,30,0.9)';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = LANE_COLORS[i];
    c.stroke();
    c.fillStyle = lit ? '#120d1c' : '#fff';
    c.fillText(LANE_NAMES[i], cx, hitY + 34);
  }
}

function drawSnapGuide(c, t) {
  if (t === null || t === undefined) return;
  const y = Math.round(timeToY(t)) + 0.5;
  c.strokeStyle = '#4de0ff';
  c.lineWidth = 1.5;
  c.setLineDash([6, 4]);
  c.beginPath();
  c.moveTo(fieldX - 12, y);
  c.lineTo(fieldX + fieldW + 12, y);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#4de0ff';
  c.font = '700 10px system-ui, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'bottom';
  c.fillText('SNAP', fieldX + fieldW + 16, y - 2);
}

function drawOverlays(c) {
  if (drag && (drag.kind === 'move' || drag.kind === 'resize')) drawSnapGuide(c, drag.snapT);
  if (drag && drag.kind === 'box') {
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    c.fillStyle = 'rgba(255,225,77,0.12)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w, h);
  } else if (drag && drag.kind === 'draw') {
    const r = drawDuration(drag, drag.curY, drag.alt);
    drawNote(c, drag.startTime, drag.lane, r.dur, { ghost: true });
    drawSnapGuide(c, drag.snapT);
    drawSnapGuide(c, r.snapT);
  } else if (!drag && tool === 'draw' && hover && !(recArmed && playing)) {
    const lane = xToLane(hover.x);
    if (lane >= 0 && lane < LANES && !hitTest(hover.x, hover.y)) {
      let t = Math.max(0, yToTime(hover.y));
      if (opts.snap && !hover.alt) {
        const s = snapTime(Math.round(t), allSnapTargets());
        if (s !== null) { t = s; drawSnapGuide(c, s); }
      }
      drawNote(c, t, lane, 0, { ghost: true });
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.font = '11px system-ui, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(formatTime(t, true) + '  (' + Math.round(t) + ' ms)', laneToX(lane) + laneW + 8, hover.y);
    }
  }
}

function drawOverview() {
  const c = og;
  const w = overview.width;
  const h = overview.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#1b1626';
  c.fillRect(0, 0, w, h);
  if (!songMs) return;

  const rowH = h / LANES;
  for (const n of notes) {
    const x = (n.time / songMs) * w;
    const wd = Math.max(1.5 * dpr, ((n.duration > 0 ? n.duration : 0) / songMs) * w);
    c.fillStyle = LANE_COLORS[n.lane];
    c.fillRect(x, n.lane * rowH + 1, wd, rowH - 2);
  }
  const px = clamp(viewTime / songMs, 0, 1) * w;
  c.fillStyle = '#fff';
  c.fillRect(px - 1, 0, 2 * dpr, h);
}

// ============================================================
//  POINTER INTERACTION (canvas)
// ============================================================
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// part: 'head' | 'end' | 'body'
function hitTest(x, y) {
  const lane = xToLane(x);
  if (lane < 0 || lane >= LANES) return null;
  let endHit = null;
  let bodyHit = null;
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (n.lane !== lane) continue;
    const yStart = timeToY(n.time);
    if (Math.abs(y - yStart) <= 13) return { note: n, part: 'head' };
    if (n.duration > 0) {
      const yEnd = timeToY(n.time + n.duration);
      if (!endHit && Math.abs(y - yEnd) <= 8) endHit = { note: n, part: 'end' };
      else if (!bodyHit && y < yStart && y > yEnd) bodyHit = { note: n, part: 'body' };
    }
  }
  return endHit || bodyHit;
}

function updateCursor(p) {
  const hit = hitTest(p.x, p.y);
  let cur = tool === 'draw' ? 'crosshair' : 'default';
  if (hit) cur = hit.part === 'end' ? 'ns-resize' : 'grab';
  if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
}

function onPointerDown(e) {
  if (mode !== 'editor') return;
  const p = canvasPos(e);
  ensureAudioCtx();

  if (e.button === 2) {
    const hit = hitTest(p.x, p.y);
    if (hit) {
      if (selection.has(hit.note.id)) deleteSelection();
      else deleteIds([hit.note.id]);
    }
    return;
  }
  if (e.button > 0) return;

  const lane = xToLane(p.x);
  const inField = lane >= 0 && lane < LANES;

  // touch / mouse tapping while recording
  if (recArmed && playing) {
    if (inField) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointerLanes.set(e.pointerId, lane);
      laneDown(lane, 'p' + e.pointerId);
    }
    return;
  }

  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  const hit = hitTest(p.x, p.y);

  if (hit) {
    const n = hit.note;
    if (additive) {
      if (selection.has(n.id)) { selection.delete(n.id); updateSelectionUI(); requestRender(); return; }
      selection.add(n.id);
    } else if (!selection.has(n.id)) {
      selection = new Set([n.id]);
    }
    updateSelectionUI();

    const resizing = hit.part === 'end' && n.duration > 0;
    const orig = new Map();
    for (const s of resizing ? [n] : selectedNotes()) orig.set(s, { time: s.time, lane: s.lane, duration: s.duration });
    drag = {
      kind: resizing ? 'resize' : 'move', pointerId: e.pointerId, anchor: n, additive,
      startX: p.x, startY: p.y, moved: false, snapshot: snap(), orig,
      targets: buildSnapTargets(orig), snapT: null
    };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    canvas.style.cursor = resizing ? 'ns-resize' : 'grabbing';
    requestRender();
    return;
  }

  if (tool === 'draw' && inField) {
    let startTime = Math.max(0, Math.round(yToTime(p.y)));
    let snapT = null;
    if (opts.snap && !e.altKey) {
      const s = snapTime(startTime, allSnapTargets());
      if (s !== null) { startTime = s; snapT = s; }
    }
    drag = {
      kind: 'draw', pointerId: e.pointerId, lane,
      startTime, startY: p.y, curY: p.y, alt: e.altKey, snapT
    };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    requestRender();
    return;
  }

  // empty space → rubber-band selection
  if (!additive && selection.size) { selection = new Set(); updateSelectionUI(); }
  drag = {
    kind: 'box', pointerId: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y,
    base: new Set(additive ? selection : [])
  };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  requestRender();
}

function onPointerMove(e) {
  const p = canvasPos(e);
  p.alt = e.altKey;
  hover = p;
  if (!drag) {
    updateCursor(p);
    if (tool === 'draw') requestRender();
    return;
  }
  if (e.pointerId !== drag.pointerId) return;

  if (drag.kind === 'move') {
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    let dt = Math.round(-dy / pxPerMs);
    let dl = Math.round(dx / laneW);

    // snap: pull the start (or end) of any dragged note onto a neighbour's time
    drag.snapT = null;
    if (opts.snap && !e.altKey) {
      let best = null;
      for (const o of drag.orig.values()) {
        const cands = [o.time + dt];
        if (o.duration > 0) cands.push(o.time + dt + o.duration);
        for (const c of cands) {
          const t = snapTime(c, drag.targets);
          if (t !== null && (best === null || Math.abs(t - c) < Math.abs(best.t - best.c))) best = { t, c };
        }
      }
      if (best) { dt += best.t - best.c; drag.snapT = best.t; }
    }

    let minT = Infinity, minL = Infinity, maxL = -Infinity;
    for (const o of drag.orig.values()) { minT = Math.min(minT, o.time); minL = Math.min(minL, o.lane); maxL = Math.max(maxL, o.lane); }
    dt = Math.max(dt, -minT);
    dl = clamp(dl, -minL, LANES - 1 - maxL);
    for (const [n, o] of drag.orig) { n.time = o.time + dt; n.lane = o.lane + dl; }
  } else if (drag.kind === 'resize') {
    const dy = p.y - drag.startY;
    if (!drag.moved && Math.abs(dy) < 3) return;
    drag.moved = true;
    const o = drag.orig.get(drag.anchor);
    let end = o.time + o.duration + (-dy / pxPerMs);
    drag.snapT = null;
    if (opts.snap && !e.altKey) {
      const s = snapTime(end, drag.targets);
      if (s !== null) { end = s; drag.snapT = s; }
    }
    const d = Math.round(end - o.time);
    if (d >= HOLD_THRESHOLD) drag.anchor.duration = d; else delete drag.anchor.duration;
  } else if (drag.kind === 'draw') {
    drag.curY = p.y;
    drag.alt = e.altKey;
  } else if (drag.kind === 'box') {
    drag.x1 = p.x;
    drag.y1 = p.y;
    const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1);
    const y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1);
    const sel = new Set(drag.base);
    for (const n of notes) {
      const lx = laneToX(n.lane);
      if (lx + laneW - 7 < x0 || lx + 7 > x1) continue;
      const ys = timeToY(n.time);
      const ye = n.duration > 0 ? timeToY(n.time + n.duration) : ys;
      if (ys + 11 < y0 || ye - 11 > y1) continue;
      sel.add(n.id);
    }
    selection = sel;
    updateSelectionUI();
  }
  requestRender();
}

function onPointerUp(e) {
  if (pointerLanes.has(e.pointerId)) {
    const lane = pointerLanes.get(e.pointerId);
    pointerLanes.delete(e.pointerId);
    laneUp(lane, 'p' + e.pointerId);
    return;
  }
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  const p = canvasPos(e);

  if (d.kind === 'move' || d.kind === 'resize') {
    if (d.moved) {
      pushUndo(d.snapshot);
      lastCoalesce = { key: '', at: 0 };
      sortNotes();
      afterChange();
    } else if (!d.additive && d.kind === 'move' && selection.size > 1) {
      selection = new Set([d.anchor.id]);
      updateSelectionUI();
    }
  } else if (d.kind === 'draw') {
    const made = addNoteUndoable(d.startTime, d.lane, drawDuration(d, p.y, e.altKey).dur, true);
    if (!made) toast('There is already a note there');
  }
  updateCursor(p);
  requestRender();
}

function cancelDrag() {
  if (!drag) return false;
  if (drag.snapshot && drag.moved) { restore(drag.snapshot); afterChange(); }
  drag = null;
  requestRender();
  return true;
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('pointerleave', () => { hover = null; requestRender(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('dblclick', e => {
  if (mode !== 'editor' || tool !== 'select') return;
  const p = canvasPos(e);
  const lane = xToLane(p.x);
  if (lane < 0 || lane >= LANES || hitTest(p.x, p.y)) return;
  const made = addNoteUndoable(yToTime(p.y), lane, 0, true);
  if (!made) toast('There is already a note there');
});

canvas.addEventListener('wheel', e => {
  if (mode !== 'editor') return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    setZoom(pxPerMs * Math.exp(-e.deltaY * 0.0015));
    return;
  }
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16;
  const dir = opts.invert ? -1 : 1;
  seek(curTime() + dir * d / pxPerMs);
}, { passive: false });

// ---------- overview bar ----------
let overviewDragging = false;
function seekFromOverview(e) {
  const r = overview.getBoundingClientRect();
  seek(clamp((e.clientX - r.left) / r.width, 0, 1) * songMs);
}
overview.addEventListener('pointerdown', e => {
  overviewDragging = true;
  try { overview.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  seekFromOverview(e);
});
overview.addEventListener('pointermove', e => { if (overviewDragging) seekFromOverview(e); });
overview.addEventListener('pointerup', () => { overviewDragging = false; });
overview.addEventListener('pointercancel', () => { overviewDragging = false; });

// ============================================================
//  TOOLBAR
// ============================================================
function setTool(t) {
  tool = t;
  el.toolSelect.classList.toggle('active', t === 'select');
  el.toolDraw.classList.toggle('active', t === 'draw');
  canvas.style.cursor = t === 'draw' ? 'crosshair' : 'default';
  requestRender();
}

function setZoom(v) {
  pxPerMs = clamp(v, 0.05, 1.6);
  el.zoom.value = pxPerMs;
  opts.zoom = pxPerMs;
  saveOpts();
  requestRender();
}

$('ed-back').addEventListener('click', leaveEditor);
el.toolSelect.addEventListener('click', () => setTool('select'));
el.toolDraw.addEventListener('click', () => setTool('draw'));
el.undo.addEventListener('click', undo);
el.redo.addEventListener('click', redo);
el.rec.addEventListener('click', () => setRec(!recArmed));
el.play.addEventListener('click', togglePlay);
el.zoom.addEventListener('input', () => setZoom(Number(el.zoom.value)));
$('tool-ahead').addEventListener('click', selectAhead);
$('btn-delete').addEventListener('click', deleteSelection);
$('btn-mirror').addEventListener('click', mirrorSelection);
$('btn-shuffle').addEventListener('click', shuffleSelection);
$('btn-tap').addEventListener('click', selectionToTap);
$('btn-shift').addEventListener('click', shiftTimes);
$('ed-export').addEventListener('click', showExport);
$('ed-side-toggle').addEventListener('click', () => editorScreen.classList.toggle('side-open'));

el.optSnap.addEventListener('change', () => { opts.snap = el.optSnap.checked; saveOpts(); });
el.optCountIn.addEventListener('change', () => { opts.countIn = el.optCountIn.checked; saveOpts(); });
el.optHit.addEventListener('change', () => { opts.hitSound = el.optHit.checked; saveOpts(); });
el.optWave.addEventListener('change', () => { opts.waveform = el.optWave.checked; saveOpts(); requestRender(); });
el.optInvert.addEventListener('change', () => { opts.invert = el.optInvert.checked; saveOpts(); });
el.inOffset.addEventListener('change', () => { opts.offset = Math.round(Number(el.inOffset.value) || 0); saveOpts(); });

// Keep keyboard shortcuts working: buttons/selects must not keep focus after use.
editorScreen.addEventListener('click', e => {
  const t = e.target;
  if (t.tagName === 'BUTTON') t.blur();
});
editorScreen.addEventListener('change', e => {
  const t = e.target;
  if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'range') t.blur();
});

// ============================================================
//  KEYBOARD
// ============================================================
function isTyping(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.tagName === 'INPUT') return t.type !== 'checkbox' && t.type !== 'range' && t.type !== 'button';
  return false;
}

document.addEventListener('keydown', e => {
  if (mode !== 'editor') return;
  if (isTyping(e)) {
    if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
    return;
  }
  const code = e.code;
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl) {
    switch (code) {
      case 'KeyZ': e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
      case 'KeyY': e.preventDefault(); redo(); return;
      case 'KeyA': e.preventDefault(); selectAll(); return;
      case 'KeyC': e.preventDefault(); copySelection(); return;
      case 'KeyX': e.preventDefault(); cutSelection(); return;
      case 'KeyV': e.preventDefault(); pasteClipboard(); return;
      case 'KeyS': e.preventDefault(); showExport(); return;
      default: return;
    }
  }

  const isArrow = code.startsWith('Arrow');
  if (e.repeat && !isArrow) { if (code === 'Space' || code === 'Enter' || KEY_TO_LANE[code] !== undefined) e.preventDefault(); return; }

  switch (code) {
    case 'Space':
      e.preventDefault();
      if (recArmed) spaceDown(); else togglePlay();
      return;
    case 'Enter': case 'NumpadEnter':
      e.preventDefault(); togglePlay(); return;
    case 'KeyR': setRec(!recArmed); return;
    case 'KeyV': setTool('select'); return;
    case 'KeyB': setTool('draw'); return;
    case 'KeyS':
      opts.snap = !opts.snap;
      el.optSnap.checked = opts.snap;
      saveOpts();
      toast('Snap ' + (opts.snap ? 'ON' : 'OFF'));
      return;
    case 'KeyM': mirrorSelection(); return;
    case 'KeyA': selectAhead(); return;
    case 'Delete': case 'Backspace':
      e.preventDefault(); deleteSelection(); return;
    case 'Escape':
      if (cancelDrag()) return;
      if (countdownActive) { pausePlayback(); return; }
      if (selection.size) { selection = new Set(); updateSelectionUI(); requestRender(); }
      return;
    case 'Home': e.preventDefault(); seek(0); return;
    case 'End': e.preventDefault(); seek(songMs); return;
    case 'Equal': case 'NumpadAdd': setZoom(pxPerMs * 1.2); return;
    case 'Minus': case 'NumpadSubtract': setZoom(pxPerMs / 1.2); return;
    case 'ArrowLeft': case 'ArrowRight': {
      e.preventDefault();
      const dir = code === 'ArrowLeft' ? -1 : 1;
      if (selection.size) nudge(0, dir);
      else seek(curTime() + dir * (e.shiftKey ? 5000 : 1000));
      return;
    }
    case 'ArrowUp': case 'ArrowDown': {
      e.preventDefault();
      const dir = code === 'ArrowUp' ? 1 : -1;
      const step = e.shiftKey ? 1 : 10;
      if (selection.size) nudge(dir * step, 0);
      else seek(curTime() + dir * step * 10);
      return;
    }
    default: break;
  }

  const lane = KEY_TO_LANE[code];
  if (lane !== undefined && recArmed) {
    e.preventDefault();
    laneDown(lane, code);
  }
});

document.addEventListener('keyup', e => {
  if (mode !== 'editor') return;
  if ((e.code === 'Space' || e.code === 'Enter') && !isTyping(e)) e.preventDefault();

  const lane = KEY_TO_LANE[e.code];
  if (lane !== undefined) { laneUp(lane, e.code); return; }
  if (e.code === 'Space') spaceUp();
});

// Release stuck keys if the tab loses focus mid-recording.
window.addEventListener('blur', () => {
  if (mode === 'editor') finalizeLivePresses();
});

// ============================================================
//  EXPORT
// ============================================================
let exported = null;

function showExport() {
  if (mode !== 'editor') return;
  if (playing || countdownActive) pausePlayback();
  if (!notes.length) { toast('Nothing to export — the chart is empty'); return; }

  const { chart, removed } = cleanForExport(notes);
  const title = titleInput.value.trim() || 'Untitled';
  const artist = artistInput.value.trim() || 'Unknown';
  const filename = filenameInput.value.trim() || (audioFile && audioFile.name) || 'song.mp3';
  const songId = songIdFrom(filename);
  const base = chartFileName ? chartFileName.replace(/\.[^.]+$/, '') : songId;
  exported = { chart, removed, title, artist, filename, songId, base };

  const holds = chart.filter(n => n.duration > 0).length;
  $('export-info').textContent = chart.length + ' notes (' + holds + ' holds) · ' + title +
    (removed ? ' · merged ' + removed + ' duplicate notes' : '');
  $('chart-filename').textContent = base + '.js';
  $('chart-id').textContent = base;
  $('audio-name').textContent = filename;
  $('move-chart').textContent = base + '.js';
  $('move-audio').textContent = filename;
  $('manifest-output').textContent = buildSongEntry({
    songId, title, artist, filename, base,
    team: teamInput.value,
    only: parseMemberList(onlyInput.value),
    cover: coverInput.value
  });

  showScreen('export');
}

function downloadChart() {
  if (!exported) return;
  const content = 'window.CHART_DATA = ' + JSON.stringify(exported.chart, null, 2) + ';\n';
  const blob = new Blob([content], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exported.base + '.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  dirty = false;
  clearAutosave();
  updateTitle();
}

function copyManifest() {
  const text = $('manifest-output').textContent;
  const btn = $('copy-manifest');
  const done = () => {
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy to clipboard'; }, 1500);
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    done();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
}

function newChart() {
  if (dirty && !confirm('Start a new empty chart? Unsaved changes will be lost.')) return;
  pendingChart = null;
  chartFileName = '';
  notes = [];
  past = [];
  future = [];
  selection = new Set();
  dirty = false;
  clearAutosave();
  chartStatus.textContent = 'No chart loaded — you will start from an empty chart.';
  showScreen('setup');
  updateSetupButtons();
}

$('download-chart').addEventListener('click', downloadChart);
$('copy-manifest').addEventListener('click', copyManifest);
$('back-editor').addEventListener('click', () => { showScreen('editor'); updateTitle(); });
$('new-recording').addEventListener('click', newChart);

// ============================================================
//  INIT
// ============================================================
updateSetupButtons();
checkAutosave();
try { music.preservesPitch = true; } catch (e) { /* ignore */ }