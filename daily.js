// ============================================================
//  JEKETI RHYTHM — daily.js
//  Daily missions · 7-day check-in calendar (never resets) · featured song (+50% Points)
//  Everything is kept in one object under localStorage 'jeketi.daily' (easy to sync to a server later).
// ============================================================
(() => {
  'use strict';

  const KEY = 'jeketi.daily';
  const MISSION_REWARD = { easy: 40, med: 80, hard: 120 };   // Points per mission
  const ALL_BONUS = 100;                                       // Points for finishing all three
  const FEATURED_MULT = 1.5;                                   // Points multiplier on the featured song
  const RANK = { C: 1, B: 2, A: 3, S: 4 };

  // 7-day calendar. 'low' / 'high' packs are picked at runtime: cheapest / most expensive paid pack that doesn't need an oshi.
  const DAYS = [
    { t: 'pts', n: 50 },
    { t: 'pts', n: 75 },
    { t: 'card', tier: 'C' },
    { t: 'pts', n: 100 },
    { t: 'pack', slot: 'low' },
    { t: 'card', tier: 'B' },
    { t: 'pack', slot: 'high' },
  ];

  // mission pool: one of each difficulty is picked per day (same pick for everyone on the same date)
  const POOL = {
    easy: [
      { id: 'e_fin2',   text: 'Finish 2 songs',               type: 'finish',   target: 2 },
      { id: 'e_perf150', text: 'Hit 150 PERFECTs',             type: 'perfects', target: 150 },
      { id: 'e_combo50', text: 'Reach a 50 combo',             type: 'combo',    target: 50 },
      { id: 'e_b1',     text: 'Get B or better on a song',    type: 'grade',    target: 1, arg: 2 },
    ],
    med: [
      { id: 'm_fin3',   text: 'Finish 3 songs',               type: 'finish',   target: 3 },
      { id: 'm_perf400', text: 'Hit 400 PERFECTs',             type: 'perfects', target: 400 },
      { id: 'm_combo100', text: 'Reach a 100 combo',           type: 'combo',    target: 100 },
      { id: 'm_b2',     text: 'Get B or better on 2 songs',   type: 'grade',    target: 2, arg: 2 },
      { id: 'm_feat',   text: "Finish today's featured song", type: 'featured', target: 1 },
    ],
    hard: [
      { id: 'h_fc',     text: 'Get a Full Combo',             type: 'fc',       target: 1 },
      { id: 'h_a1',     text: 'Get A or better on a song',    type: 'grade',    target: 1, arg: 3 },
      { id: 'h_fin5',   text: 'Finish 5 songs',               type: 'finish',   target: 5 },
      { id: 'h_combo200', text: 'Reach a 200 combo',           type: 'combo',    target: 200 },
    ],
  };
  const DEF = {};
  Object.keys(POOL).forEach(tier => POOL[tier].forEach(d => { DEF[d.id] = Object.assign({ tier }, d); }));

  // ---------- date helpers (local midnight is the daily reset) ----------
  let dayOffset = 0;                                           // only used by the console helpers for testing
  const nowDate = () => new Date(Date.now() + dayOffset * 864e5);
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = () => { const d = nowDate(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const dayNum = () => { const d = nowDate(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const msToMidnight = () => { const d = nowDate(), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return n - d; };
  function rng(seed) {                                         // small seeded random generator
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- save ----------
  const fresh = () => ({ v: 1, day: 0, last: '', total: 0, m: { date: '', bonus: 0, list: [] } });
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      if (o && typeof o === 'object') { const s = Object.assign(fresh(), o); if (!s.m || !Array.isArray(s.m.list)) s.m = fresh().m; return s; }
    } catch (e) { /* ignore */ }
    return fresh();
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } };

  // ---------- featured song ----------
  const songs = () => (Array.isArray(window.SONGS) ? window.SONGS : []);
  function featuredSong() { const s = songs(); return s.length ? s[dayNum() % s.length] : null; }
  const isFeatured = (id) => { const f = featuredSong(); return !!f && id != null && f.id === id; };

  // ---------- missions ----------
  function ensureToday() {
    const t = dateKey();
    const ok = S.m && S.m.date === t && S.m.list.length === 3 && S.m.list.every(it => DEF[it.id]);
    if (ok) return;
    const r = rng('missions:' + t);
    const pick = (a) => a[Math.floor(r() * a.length)];
    S.m = { date: t, bonus: 0, list: [pick(POOL.easy), pick(POOL.med), pick(POOL.hard)].map(d => ({ id: d.id, p: 0, c: 0 })) };
    save();
  }
  function onRun(info) {                                       // called by game.js when a song is finished
    ensureToday();
    S.m.list.forEach(it => {
      const d = DEF[it.id];
      if (!d || it.p >= d.target) return;
      switch (d.type) {
        case 'finish': it.p += 1; break;
        case 'perfects': it.p += info.perfects || 0; break;
        case 'combo': it.p = Math.max(it.p, info.maxCombo || 0); break;
        case 'grade': if ((RANK[info.grade] || 0) >= d.arg) it.p += 1; break;
        case 'fc': if (info.fullCombo) it.p += 1; break;
        case 'featured': if (isFeatured(info.songId)) it.p += 1; break;
      }
      it.p = Math.min(it.p, d.target);
    });
    save(); refreshDot(); if (isOpen()) render();
  }
  const allClaimed = () => S.m.list.length === 3 && S.m.list.every(it => it.c);
  function claimMission(i) {
    ensureToday();
    const it = S.m.list[i], d = it && DEF[it.id];
    if (!d || it.c || it.p < d.target) return;
    it.c = 1; Points.add(MISSION_REWARD[d.tier]); save(); refreshDot(); render();
  }
  function claimBonus() {
    ensureToday();
    if (!allClaimed() || S.m.bonus) return;
    S.m.bonus = 1; Points.add(ALL_BONUS); save(); refreshDot(); render();
  }

  // ---------- check-in ----------
  const canCheckIn = () => S.last !== dateKey();
  const nextDay = () => (S.day >= 7 ? 1 : S.day + 1);
  function packKinds() {
    try {
      return Object.keys(Packs.PACKS).filter(k => { const P = Packs.PACKS[k]; return P && !P.oshi && P.price > 0; })
        .sort((a, b) => Packs.PACKS[a].price - Packs.PACKS[b].price);
    } catch (e) { return []; }
  }
  const packFor = (slot) => { const k = packKinds(); return k.length ? (slot === 'low' ? k[0] : k[k.length - 1]) : null; };
  function giveReward(r) {                                     // true when delivered
    try {
      if (r.t === 'pts') { Points.add(r.n); return true; }
      if (r.t === 'card') {
        const ms = Cards.MEMBERS, m = ms[Math.floor(Math.random() * ms.length)];
        const drop = Cards.give(m.id, r.tier);
        if (!drop) return false;
        setTimeout(() => { try { Cards.reveal(drop, true); } catch (e) { /* ignore */ } }, 450);
        return true;
      }
      if (r.t === 'pack') {
        const k = packFor(r.slot);
        if (!k) { Points.add(150); return true; }              // no paid pack exists: fall back to Points
        return !!Packs.open(k);
      }
    } catch (e) { /* fall through */ }
    return false;
  }
  function checkIn() {
    if (!canCheckIn()) return;
    const d = nextDay();
    if (!giveReward(DAYS[d - 1])) { toast('Something is already opening. Try again in a moment.'); return; }
    S.day = d; S.last = dateKey(); S.total = (S.total || 0) + 1;
    save(); refreshDot(); render();
  }

  // ---------- red dot ----------
  function hasNew() {
    ensureToday();
    return canCheckIn() || S.m.list.some(it => !it.c && DEF[it.id] && it.p >= DEF[it.id].target) || (allClaimed() && !S.m.bonus);
  }
  const btn = document.getElementById('daily-btn');
  function refreshDot() { if (btn) btn.classList.toggle('has-new', hasNew()); }

  // ---------- screen ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const screen = document.createElement('div');
  screen.id = 'daily-screen';
  screen.innerHTML = '<div class="dy-head"><button class="dy-back" type="button" aria-label="Back">◀</button>' +
    '<div class="dy-title">DAILY</div><div class="dy-pts"></div></div><div class="dy-body"></div><div class="dy-toast"></div>';
  document.body.appendChild(screen);
  const body = screen.querySelector('.dy-body'), ptsBox = screen.querySelector('.dy-pts'), toastEl = screen.querySelector('.dy-toast');
  let timer = 0, toastT = 0;
  const isOpen = () => screen.classList.contains('show');

  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  function tileHTML(i, r, state) {
    let ico, lab, cls;
    if (r.t === 'pts') { cls = 't-pts'; ico = '<i class="pt-coin">P</i>'; lab = r.n + ' Point'; }
    else if (r.t === 'card') { cls = 't-card'; ico = '<span class="dy-ico">🃏</span>'; lab = r.tier + ' card'; }
    else {
      const k = packFor(r.slot), P = k && Packs.PACKS[k];
      if (P) { cls = 't-pack'; ico = '<span class="dy-ico">' + P.emblem + '</span>'; lab = esc(P.name.replace(' Pack', '')) + ' pack'; }
      else { cls = 't-pts'; ico = '<i class="pt-coin">P</i>'; lab = '150 Point'; }
    }
    return '<div class="dy-day ' + cls + ' ' + state + (i === 7 ? ' big' : '') + '"><small>DAY ' + i + '</small>' + ico + '<b>' + lab + '</b>' +
      (i === 7 ? '<em class="dy-crown">★ BIG PRIZE ★</em>' : '') + (state === 'done' ? '<i class="dy-tick">✓</i>' : '') + '</div>';
  }
  const TIER_NAME = { easy: 'EASY', med: 'MEDIUM', hard: 'HARD' };
  function render() {
    ensureToday();
    const can = canCheckIn(), claimed = (S.day >= 7 && can) ? 0 : S.day, nd = nextDay();
    let days = '';
    DAYS.forEach((r, k) => { const i = k + 1; days += tileHTML(i, r, i <= claimed ? 'done' : (can && i === nd ? 'today' : '')); });
    const f = featuredSong();
    const feat = f ? '<div class="dy-feat"><div class="dy-feat-c"><span>♪</span>' + (f.cover ? '<img src="' + esc(f.cover) + '" alt="" onerror="this.remove()">' : '') + '</div>' +
      '<div class="dy-feat-t"><small>★ TODAY\'S FEATURED SONG</small><b>' + esc(f.title || f.id) + '</b><em class="dy-plus">+50% POINTS</em></div>' +
      '<button class="dy-go" type="button" data-id="' + esc(f.id) + '">GO ▶</button></div>' : '';
    let ml = '';
    S.m.list.forEach((it, i) => {
      const d = DEF[it.id], done = it.p >= d.target, pc = Math.round(100 * it.p / d.target);
      ml += '<div class="dy-m ' + d.tier + (it.c ? ' claimed' : '') + '"><div class="dy-mt"><em class="dy-tag">' + TIER_NAME[d.tier] + '</em><b>' + esc(d.text) + '</b>' +
        '<div class="dy-bar"><i style="width:' + pc + '%"></i><span>' + it.p + ' / ' + d.target + '</span></div></div>' +
        '<div class="dy-mr"><span class="dy-rw"><i class="pt-coin">P</i>+' + MISSION_REWARD[d.tier] + '</span>' +
        (it.c ? '<span class="dy-done">✓ DONE</span>' : (done ? '<button class="dy-claim" type="button" data-i="' + i + '">CLAIM</button>' : '')) + '</div></div>';
    });
    const bonusReady = allClaimed() && !S.m.bonus;
    const bonus = '<div class="dy-bonus' + (S.m.bonus ? ' claimed' : '') + (bonusReady ? ' ready' : '') + '"><span>🏆 ALL 3 DONE BONUS <i class="pt-coin">P</i>+' + ALL_BONUS + '</span>' +
      (S.m.bonus ? '<span class="dy-done">✓ DONE</span>' : (bonusReady ? '<button class="dy-bonus-btn" type="button">CLAIM</button>' : '<small>' + S.m.list.filter(x => x.c).length + ' / 3</small>')) + '</div>';
    const missionDot = S.m.list.some(it => !it.c && it.p >= DEF[it.id].target) || bonusReady;
    body.innerHTML =
      '<section class="dy-col dy-left"><h3 class="dy-rib pink">CHECK-IN' + (can ? '<i class="dy-dot"></i>' : '') + '</h3><div class="dy-days">' + days + '</div>' +
      '<button class="dy-checkin-btn" type="button"' + (can ? '' : ' disabled') + '>' + (can ? 'CHECK IN · DAY ' + nd : 'COME BACK TOMORROW') + '</button>' +
      '<div class="dy-note">Missing a day never resets your calendar.</div></section>' +
      '<section class="dy-col dy-right"><h3 class="dy-rib blue">MISSIONS' + (missionDot ? '<i class="dy-dot"></i>' : '') + '<small class="dy-reset">new in <b></b></small></h3>' +
      feat + '<div class="dy-mlist">' + ml + '</div>' + bonus + '</section>';
    tickReset();
    ptsBox.innerHTML = window.Points ? Points.chipHTML() : '';
  }
  function tickReset() {
    const el = body.querySelector('.dy-reset b');
    if (!el) return;
    const s = Math.ceil(msToMidnight() / 1000);
    el.textContent = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => pad(v)).join(':');
    if (dateKey() !== S.m.date) { ensureToday(); render(); refreshDot(); }       // midnight passed while open
  }
  function show() { ensureToday(); render(); screen.classList.add('show'); clearInterval(timer); timer = setInterval(tickReset, 1000); }
  function hide() { screen.classList.remove('show'); clearInterval(timer); refreshDot(); }

  screen.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.dy-back')) return hide();
    if (t.closest('.dy-checkin-btn')) return checkIn();
    const c = t.closest('.dy-claim'); if (c) return claimMission(+c.dataset.i);
    if (t.closest('.dy-bonus-btn')) return claimBonus();
    const g = t.closest('.dy-go'); if (g) { hide(); window.dispatchEvent(new CustomEvent('daily:goto', { detail: { id: g.dataset.id } })); }
  });
  document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && isOpen()) { e.preventDefault(); hide(); } });
  if (btn) btn.addEventListener('click', show);
  window.addEventListener('packs:closed', () => { if (isOpen()) render(); refreshDot(); });
  window.addEventListener('focus', () => { refreshDot(); if (isOpen()) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDot(); if (isOpen()) render(); } });
  setInterval(refreshDot, 60000);

  // keep the Daily button right under the Points chip (top-right), whatever the screen size
  const chip = document.querySelector('#menu-screen .menu-header .points-chip');
  function place() {
    if (!btn || !chip) return;
    const r = chip.getBoundingClientRect();
    if (!r.height) return;
    btn.style.left = 'auto';
    btn.style.right = Math.max(0, document.documentElement.clientWidth - r.right) + 'px';
    btn.style.top = (r.bottom + 8) + 'px';
  }
  if (chip && window.ResizeObserver) new ResizeObserver(place).observe(chip);
  window.addEventListener('resize', place);
  window.addEventListener('orientationchange', () => setTimeout(place, 250));
  window.addEventListener('load', place);
  setTimeout(place, 300);

  ensureToday(); refreshDot();

  window.Daily = {
    isFeatured, featuredSong, featuredId: () => { const f = featuredSong(); return f ? f.id : null; },
    FEATURED_MULT, onRun, show, hide, refresh: refreshDot,
    // console helpers for testing:  Daily.debugNextDay()  (jump one day ahead)  /  Daily.reset()
    debugNextDay() { dayOffset++; ensureToday(); refreshDot(); if (isOpen()) render(); return dateKey(); },
    reset() { S = fresh(); dayOffset = 0; save(); ensureToday(); refreshDot(); if (isOpen()) render(); },
  };
})();