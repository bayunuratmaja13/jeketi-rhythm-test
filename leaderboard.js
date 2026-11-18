// leaderboard.js - online per-song leaderboard (Supabase, plain fetch, no library needed)
// Adds: a LEADERBOARD button on the "PLAY THIS SONG?" pop up, a SUBMIT TO LEADERBOARD button on the result card,
// a name pop up and a leaderboard pop up. Loaded after game.js (see game.html).
(function () {
  'use strict';

  // ================= 1) PASTE YOUR TWO VALUES HERE =================
  var SUPABASE_URL = 'https://gpbffmigrfacgwdjcqhj.supabase.co/rest/v1/';   // Project URL
  var SUPABASE_KEY = 'sb_publishable_sAuwhgZR34XPG--2Pk6uvw_A6kpAmVR';                // Publishable key (safe to be public)
  // =================================================================

  var NAME_RE = /^[A-Za-z0-9]{1,10}$/;
  var LS_NAME = 'jeketi.lb.name';
  var LS_SESSION = 'jeketi.lb.session';
  var LS_MINE = 'jeketi.lb.mine.';        // + song id -> {name, score} of this device's entry (to highlight it)
  var API = SUPABASE_URL.replace(/\/+$/, '');
  var configured = SUPABASE_URL.indexOf('YOUR') === -1 && SUPABASE_KEY.indexOf('YOUR') === -1;

  // ---------- tiny Supabase client (REST) ----------
  var HEAD = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };

  function req(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
        if (!r.ok) {
          var err = new Error((j && (j.message || j.msg || j.error_description)) || ('HTTP ' + r.status));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  function loadSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { return null; } }
  function saveSession(s) {
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600))
      }));
    } catch (e) { /* storage blocked */ }
  }

  // anonymous sign-in = a hidden per-device ID (no login screen for the player)
  function signInAnon() {
    return req(API + '/auth/v1/signup', { method: 'POST', headers: HEAD, body: JSON.stringify({ data: {} }) })
      .then(function (s) { saveSession(s); return s.access_token; });
  }

  function getToken() {
    var s = loadSession();
    var now = Math.floor(Date.now() / 1000);
    if (s && s.access_token && s.expires_at - 60 > now) return Promise.resolve(s.access_token);
    if (s && s.refresh_token) {
      return req(API + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: HEAD, body: JSON.stringify({ refresh_token: s.refresh_token }) })
        .then(function (n) { saveSession(n); return n.access_token; })
        .catch(function (e) {
          // only start a brand new identity if the server rejected the old one; a network error just fails (can retry)
          if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 422) return signInAnon();
          throw e;
        });
    }
    return signInAnon();
  }

  function submitScore(songId, name, score, accPct) {
    return getToken().then(function (token) {
      var h = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
      return req(API + '/rest/v1/rpc/submit_score', {
        method: 'POST', headers: h,
        body: JSON.stringify({ p_song_id: songId, p_name: name, p_score: score, p_accuracy: accPct })
      });
    });
  }

  function fetchBoard(songId) {
    var url = API + '/rest/v1/scores?select=player_name,score,accuracy&song_id=eq.' + encodeURIComponent(songId) +
      '&order=score.desc,created_at.asc&limit=10';
    return req(url, { headers: { 'apikey': SUPABASE_KEY } });
  }

  // ---------- styles ----------
  var css = '' +
    '#lb-submit{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;display:none;' +
      'padding:12px 30px;border:3px solid #2f5a40;border-radius:999px;background:#ffd84d;color:#2b2b2b;font-family:inherit;font-weight:800;' +
      'font-size:26px;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 0 #2f5a40;white-space:nowrap}' +
    '#lb-submit:active{transform:translateX(-50%) translateY(2px);box-shadow:0 2px 0 #2f5a40}' +
    '#lb-submit:disabled{background:#cfd8cf;color:#456;cursor:default;box-shadow:none}' +
    '#results.show:not(.hs-view) #lb-submit.on{display:block;animation:lbIn .35s ease 1.8s both}' +
    '@keyframes lbIn{from{opacity:0}to{opacity:1}}' +
    '.cp-lb{margin-top:10px}' +
    '.lb-ov{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999999;display:none;align-items:center;justify-content:center;' +
      'background:rgba(10,20,14,.72);-webkit-tap-highlight-color:transparent;font-family:inherit}' +
    '.lb-ov.show{display:flex}' +
    '.lb-box{width:min(760px,92vw);max-height:92vh;overflow:auto;box-sizing:border-box;background:#fbf4de;color:#2b2b2b;' +
      'border:5px solid #2f5a40;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);padding:22px 28px;text-align:center}' +
    '.lb-narrow{width:min(560px,92vw)}' +
    '.lb-title{font-size:38px;font-weight:900;color:#2f5a40;letter-spacing:2px}' +
    '.lb-song{font-size:26px;font-weight:700;margin:4px 0 14px;opacity:.85}' +
    '.lb-score{font-size:34px;font-weight:900;margin:0 0 12px}' +
    '.lb-list{min-height:60px}' +
    '.lb-row{display:flex;align-items:center;gap:14px;padding:8px 14px;border-radius:10px;font-size:28px;font-weight:700}' +
    '.lb-row:nth-child(odd){background:rgba(47,90,64,.09)}' +
    '.lb-row.me{background:#ffe27a;outline:3px solid #2f5a40}' +
    '.lb-rank{width:52px;text-align:right;color:#2f5a40}' +
    '.lb-pname{flex:1;text-align:left;letter-spacing:1px;overflow:hidden;text-overflow:ellipsis}' +
    '.lb-pscore{font-variant-numeric:tabular-nums}' +
    '.lb-pacc{width:100px;text-align:right;opacity:.65;font-size:22px}' +
    '.lb-msg{font-size:26px;font-weight:700;padding:18px 6px;white-space:pre-line}' +
    '.lb-note{font-size:22px;opacity:.7;margin:8px 0}' +
    '.lb-extra{font-size:22px;font-weight:700;color:#8a5a00;margin:0 0 10px}' +
    '.lb-hint{font-size:20px;opacity:.55;margin-top:12px}' +
    '.lb-input{width:100%;box-sizing:border-box;font:inherit;font-size:36px;font-weight:800;text-align:center;letter-spacing:3px;' +
      'padding:10px;border:4px solid #2f5a40;border-radius:12px;background:#fff;color:#2b2b2b;text-transform:none}' +
    '.lb-err{min-height:30px;font-size:22px;font-weight:700;color:#b3261e;margin:8px 0 4px}' +
    '.lb-btns{display:flex;gap:14px;justify-content:center;margin-top:8px}' +
    '.lb-btn{font-family:inherit;font-size:28px;font-weight:800;padding:10px 28px;border:3px solid #2f5a40;border-radius:999px;' +
      'background:#ffd84d;color:#2b2b2b;cursor:pointer;box-shadow:0 4px 0 #2f5a40}' +
    '.lb-btn.lb-cancel{background:#e8e2cd}' +
    '.lb-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #2f5a40}' +
    '.lb-btn:disabled{opacity:.6}' +
    '@media (max-height:520px){.lb-title{font-size:30px}.lb-row{font-size:22px;padding:5px 12px}.lb-song{margin-bottom:8px}#lb-submit{font-size:20px;padding:8px 22px}}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  // ---------- leaderboard pop up ----------
  var lbPop = el('div', 'lb-ov');
  lbPop.id = 'lb-pop';
  lbPop.innerHTML =
    '<div class="lb-box">' +
      '<div class="lb-title">LEADERBOARD</div>' +
      '<div class="lb-song"></div>' +
      '<div class="lb-extra"></div>' +
      '<div class="lb-list"></div>' +
      '<div class="lb-hint">tap anywhere to close</div>' +
    '</div>';
  document.body.appendChild(lbPop);
  var lbSongEl = lbPop.querySelector('.lb-song');
  var lbExtraEl = lbPop.querySelector('.lb-extra');
  var lbListEl = lbPop.querySelector('.lb-list');
  var lbToken = 0;

  function showMsg(text) {
    lbListEl.textContent = '';
    var m = el('div', 'lb-msg');
    m.textContent = text;
    lbListEl.appendChild(m);
  }

  function renderBoard(rows, songId) {
    lbListEl.textContent = '';
    if (!rows || !rows.length) { showMsg('No scores yet.\nBe the first!'); return; }
    var mine = null;
    try { mine = JSON.parse(localStorage.getItem(LS_MINE + songId) || 'null'); } catch (e) { /* ignore */ }
    var markedMine = false;
    rows.forEach(function (r, i) {
      var row = el('div', 'lb-row');
      if (mine && !markedMine && r.player_name === mine.name && r.score === mine.score) { row.className += ' me'; markedMine = true; }
      var rank = el('div', 'lb-rank'); rank.textContent = String(i + 1);
      var nm = el('div', 'lb-pname'); nm.textContent = r.player_name;
      var sc = el('div', 'lb-pscore'); sc.textContent = Number(r.score).toLocaleString('en-US');
      var ac = el('div', 'lb-pacc'); ac.textContent = (r.accuracy == null ? '' : Number(r.accuracy).toFixed(1) + '%');
      row.appendChild(rank); row.appendChild(nm); row.appendChild(sc); row.appendChild(ac);
      lbListEl.appendChild(row);
    });
  }

  function openBoard(song, extra) {
    lbSongEl.textContent = song.title || song.id || '';
    lbExtraEl.textContent = extra || '';
    lbPop.classList.add('show');
    if (!configured) { showMsg('Leaderboard is not set up yet.'); return; }
    showMsg('Loading…');
    var tok = ++lbToken;
    fetchBoard(song.id).then(function (rows) {
      if (tok === lbToken) renderBoard(rows, song.id);
    }).catch(function () {
      if (tok === lbToken) showMsg("Couldn't load the leaderboard.\nCheck your connection.");
    });
  }
  function closeBoard() { lbToken++; lbPop.classList.remove('show'); }
  lbPop.addEventListener('click', closeBoard);        // click anywhere closes it (back to the pop up underneath)

  // ---------- name pop up ----------
  var run = null;      // the run that is currently on the result card: {song, score, acc, sent}
  var busy = false;

  var namePop = el('div', 'lb-ov');
  namePop.id = 'lb-name';
  namePop.innerHTML =
    '<div class="lb-box lb-narrow">' +
      '<div class="lb-title">SUBMIT SCORE</div>' +
      '<div class="lb-song"></div>' +
      '<div class="lb-score"></div>' +
      '<input class="lb-input" type="text" maxlength="10" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="YOUR NAME">' +
      '<div class="lb-note">1-10 letters or numbers</div>' +
      '<div class="lb-err"></div>' +
      '<div class="lb-btns"><button type="button" class="lb-btn lb-go">SUBMIT</button><button type="button" class="lb-btn lb-cancel">CANCEL</button></div>' +
    '</div>';
  document.body.appendChild(namePop);
  var nSong = namePop.querySelector('.lb-song'), nScore = namePop.querySelector('.lb-score');
  var nInput = namePop.querySelector('.lb-input'), nErr = namePop.querySelector('.lb-err');
  var nGo = namePop.querySelector('.lb-go'), nCancel = namePop.querySelector('.lb-cancel');

  nInput.addEventListener('input', function () {
    nInput.value = nInput.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
    nErr.textContent = '';
  });
  function closeName() { namePop.classList.remove('show'); nInput.blur(); }
  nCancel.addEventListener('click', closeName);

  function doSubmit() {
    if (busy || !run) return;
    var name = nInput.value;
    if (!NAME_RE.test(name)) { nErr.textContent = 'Use 1-10 letters or numbers.'; return; }
    busy = true;
    nGo.disabled = true; nGo.textContent = 'SENDING…'; nErr.textContent = '';
    var r = run;
    submitScore(r.song.id, name, r.score, r.acc).then(function (updated) {
      busy = false; nGo.disabled = false; nGo.textContent = 'SUBMIT';
      try { localStorage.setItem(LS_NAME, name); } catch (e) { /* ignore */ }
      if (updated) { try { localStorage.setItem(LS_MINE + r.song.id, JSON.stringify({ name: name, score: r.score })); } catch (e) { /* ignore */ } }
      r.sent = true;
      if (run === r) { submitBtn.textContent = 'SUBMITTED ✓'; submitBtn.disabled = true; }
      closeName();
      openBoard(r.song, updated ? '' : 'Your higher score from this device is already on the board.');
    }).catch(function () {
      busy = false; nGo.disabled = false; nGo.textContent = 'SUBMIT';
      nErr.textContent = "Couldn't send. Check your connection and try again.";
    });
  }
  nGo.addEventListener('click', doSubmit);
  nInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSubmit(); } });

  function openName() {
    if (!run || run.sent) return;
    if (!configured) { openBoard(run.song); return; }       // shows "not set up yet"
    nSong.textContent = run.song.title || run.song.id || '';
    nScore.textContent = run.score.toLocaleString('en-US');
    var saved = '';
    try { saved = localStorage.getItem(LS_NAME) || ''; } catch (e) { /* ignore */ }
    nInput.value = NAME_RE.test(saved) ? saved : '';
    nErr.textContent = '';
    namePop.classList.add('show');
    setTimeout(function () { try { nInput.focus(); nInput.select(); } catch (e) { /* ignore */ } }, 60);
  }

  // ---------- SUBMIT TO LEADERBOARD button (inside the result overlay) ----------
  var submitBtn = el('button', '');
  submitBtn.id = 'lb-submit';
  submitBtn.type = 'button';
  submitBtn.textContent = 'SUBMIT TO LEADERBOARD';
  submitBtn.addEventListener('click', function (e) { e.stopPropagation(); openName(); });
  var resultsEl = document.getElementById('results');
  if (resultsEl) resultsEl.appendChild(submitBtn);

  // ---------- LEADERBOARD button on the "PLAY THIS SONG?" pop up ----------
  function addConfirmButton() {
    var box = document.querySelector('#confirm-play .cp-box');
    if (!box) return false;
    if (box.querySelector('.cp-lb')) return true;
    var b = el('button', 'cp-hs cp-lb');       // same look as VIEW HIGH SCORE
    b.type = 'button';
    b.textContent = 'LEADERBOARD';
    var hs = box.querySelector('.cp-hs');
    if (hs && hs.parentNode) hs.parentNode.insertBefore(b, hs.nextSibling); else box.appendChild(b);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var s = (typeof confirmSong !== 'undefined') ? confirmSong : null;     // the song shown in the pop up (from game.js)
      if (s) openBoard(s);
    });
    return true;
  }
  if (!addConfirmButton()) document.addEventListener('DOMContentLoaded', addConfirmButton);

  // ---------- keyboard: Esc closes our pop ups first; typing in the name box never reaches the game ----------
  document.addEventListener('keydown', function (e) {
    var inName = namePop.classList.contains('show'), inBoard = lbPop.classList.contains('show');
    if (!inName && !inBoard) return;
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (inBoard) closeBoard(); else closeName();
    }
  }, true);

  // ---------- called by game.js when the result card is built ----------
  window.Leaderboard = {
    onResults: function (song, score, acc) {
      var ok = !!(song && song.id && score > 0);
      run = ok ? { song: song, score: Math.round(score), acc: Math.round((acc || 0) * 10000) / 100, sent: false } : null;
      submitBtn.textContent = 'SUBMIT TO LEADERBOARD';
      submitBtn.disabled = false;
      if (ok) submitBtn.classList.add('on'); else submitBtn.classList.remove('on');
    }
  };
})();