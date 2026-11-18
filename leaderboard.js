// leaderboard.js - online per-song leaderboard (Supabase, plain fetch, no library needed)
// Adds: a LEADERBOARD button on the "PLAY THIS SONG?" pop up, a SUBMIT TO LEADERBOARD button on the result card,
// a name pop up and a leaderboard pop up. Loaded after game.js (see game.html).
(function () {
  'use strict';

  // ================= 1) PASTE YOUR TWO VALUES HERE =================
  var SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';   // Project URL
  var SUPABASE_KEY = 'sb_publishable_YOUR_KEY';                // Publishable key (safe to be public)
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
    // SUBMIT button: sits right under the result card (the overlay stacks the card and the button in a column)
    '#results{flex-direction:column;gap:12px}' +
    '#results.lb-on:not(.hs-view) .results-card{max-height:calc(100dvh - 84px)}' +
    '#lb-submit{display:none;flex:none;font:800 clamp(16px,3.8dvh,24px)/1 Fredoka,var(--font-game,sans-serif);letter-spacing:.08em;color:#fff;' +
      'text-shadow:0 2px 0 rgba(160,40,90,.35);padding:.5em 1.4em;border:3px solid #fff;border-radius:999px;' +
      'background:linear-gradient(180deg,#ff9cc4,#ff66a3);box-shadow:0 4px 0 #c23b79,0 6px 14px rgba(0,0,0,.35);cursor:pointer;' +
      'white-space:nowrap;touch-action:manipulation}' +
    '#lb-submit:active{transform:translateY(3px);box-shadow:0 1px 0 #c23b79}' +
    '#lb-submit:disabled{background:linear-gradient(180deg,#d9d9d9,#b5b5b5);box-shadow:0 4px 0 #8a8a8a;cursor:default;text-shadow:none}' +
    '#results.show:not(.hs-view) #lb-submit.on{display:block;animation:lbIn .35s ease 1.8s both}' +
    '@keyframes lbIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.cp-lb{margin-top:8px}' +
    // pop ups: same look as the "PLAY THIS SONG?" box (cp-box)
    '.lb-ov{position:fixed;left:0;top:0;right:0;bottom:0;z-index:3000;display:none;align-items:center;justify-content:center;padding:12px;' +
      'background:rgba(5,2,10,.72);touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '.lb-ov.show{display:flex;animation:cp-fade .18s ease-out}' +
    '#lb-name{align-items:flex-start;padding-top:4dvh}' +
    '.lb-box{position:relative;box-sizing:border-box;width:min(90vw,520px);max-height:94dvh;overflow:hidden;display:flex;flex-direction:column;' +
      'padding:clamp(12px,3dvh,22px) clamp(14px,4vw,26px);background:var(--paper,#fdf6e3);color:#3a2140;text-align:center;border-radius:16px;' +
      'border:3px solid #fff;box-shadow:0 14px 44px rgba(0,0,0,.65),0 0 0 4px rgba(255,107,166,.55);' +
      'font-family:Fredoka,var(--font-game,sans-serif);animation:cp-pop .34s cubic-bezier(.2,1.5,.4,1)}' +
    '.lb-narrow{width:min(90vw,400px)}' +
    '.lb-title{font:900 clamp(22px,6dvh,34px)/1.05 var(--font-impact,Fredoka,sans-serif);letter-spacing:.5px;color:#e0488a;text-shadow:0 2px 0 rgba(0,0,0,.12)}' +
    '.lb-song{margin:clamp(2px,.8dvh,6px) 0 clamp(6px,1.6dvh,12px);font:700 clamp(14px,3.6dvh,20px)/1.2 Fredoka,sans-serif;overflow-wrap:anywhere}' +
    '.lb-score{font:900 clamp(26px,7dvh,40px)/1 var(--font-impact,Fredoka,sans-serif);color:#2f9e6a;margin:0 0 clamp(6px,1.6dvh,12px)}' +
    '.lb-list{flex:1 1 auto;min-height:0;overflow-y:auto}' +
    '.lb-row{display:flex;align-items:center;gap:10px;padding:clamp(3px,.9dvh,7px) 12px;border-radius:10px;font:700 clamp(14px,3.8dvh,22px)/1.15 Fredoka,sans-serif}' +
    '.lb-row:nth-child(odd){background:rgba(224,72,138,.08)}' +
    '.lb-row.me{background:#ffe9a3;box-shadow:inset 0 0 0 2px #ffcc33}' +
    '.lb-rank{flex:0 0 2.2em;text-align:right;color:#e0488a;font-family:var(--font-impact,Fredoka,sans-serif)}' +
    '.lb-pname{flex:1;min-width:0;text-align:left;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lb-pscore{font-variant-numeric:tabular-nums}' +
    '.lb-pacc{flex:0 0 4.2em;text-align:right;opacity:.6;font-size:.8em}' +
    '.lb-msg{padding:clamp(10px,3dvh,22px) 6px;font:600 clamp(15px,3.8dvh,22px)/1.3 Fredoka,sans-serif;white-space:pre-line}' +
    '.lb-note{font:500 clamp(12px,2.8dvh,15px)/1.2 Fredoka,sans-serif;opacity:.65;margin:6px 0 0}' +
    '.lb-extra{font:700 clamp(12px,3dvh,16px)/1.25 Fredoka,sans-serif;color:#b0630a;margin:0 0 6px}' +
    '.lb-extra:empty{display:none}' +
    '.lb-hint{flex:none;font:500 clamp(11px,2.6dvh,14px)/1 Fredoka,sans-serif;opacity:.5;margin-top:clamp(6px,1.6dvh,10px)}' +
    // iOS Safari will not let you type in a field inside a body that has user-select:none, so the input opts back in
    '.lb-input{width:100%;box-sizing:border-box;font:800 clamp(22px,6dvh,32px)/1.1 Fredoka,sans-serif;text-align:center;letter-spacing:2px;' +
      'padding:clamp(6px,1.6dvh,10px);border:3px solid #e0488a;border-radius:12px;background:#fff;color:#3a2140;outline:none;' +
      '-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none}' +
    '.lb-input:focus{border-color:#5dbcf2}' +
    '.lb-err{min-height:1.3em;font:700 clamp(12px,3dvh,16px)/1.3 Fredoka,sans-serif;color:#d0293f;margin:6px 0 2px}' +
    '.lb-btns{display:flex;gap:12px;justify-content:center;margin-top:clamp(6px,1.6dvh,12px)}' +
    '.lb-btn{flex:1 1 0;max-width:160px;min-height:clamp(40px,9dvh,52px);border-radius:999px;border:3px solid #fff;cursor:pointer;' +
      'font:900 clamp(18px,4.8dvh,24px)/1 var(--font-impact,Fredoka,sans-serif);letter-spacing:1px;color:#fff;touch-action:manipulation}' +
    '.lb-go{background:linear-gradient(180deg,#62e096,#2f9e6a);box-shadow:0 4px 0 #1f7049;text-shadow:0 2px 0 rgba(0,0,0,.25)}' +
    '.lb-cancel{background:linear-gradient(180deg,#ff9db4,#e0486a);box-shadow:0 4px 0 #a02a48;text-shadow:0 2px 0 rgba(0,0,0,.25)}' +
    '.lb-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.35)}' +
    '.lb-btn:disabled{opacity:.6}';
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
      if (resultsEl) { if (ok) resultsEl.classList.add('lb-on'); else resultsEl.classList.remove('lb-on'); }
    }
  };
})();