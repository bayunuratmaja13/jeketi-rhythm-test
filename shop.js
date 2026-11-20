// ============================================================
//  JEKETI RHYTHM — shop.js
//  Card shop (free first time, 24h lock, Points), oshi, and the
//  12-card squad bar (bottom of song select) that raises the score.  Builds on cards.js,
//  packs.js and points.js.
// ============================================================
(() => {
  'use strict';

  const KEY = 'jeketi.shop';
  const COOLDOWN_MS = 24 * 3600 * 1000;
  const TIER_BONUS = [1, 2, 5, 9, 14];         // % score per equipped card, C B A S SS  (a perfect no-card run = 500,000; S grade = 1,000,000)
  const CENTER_BONUS = [2, 4, 8, 14, 20];         // % extra score for the CENTER card, by its tier C B A S SS (only that one card; added on top of its own bonus)
  const OSHI_MULT = 1.5;                       // oshi card bonus multiplier
  const SONG_MATCH = 1;                        // % per equipped member that sings in the song
  const TEAM_BONUS = { 3: 3, 4: 5, 5: 8 };     // % when 3 / 4 / 5+ equipped cards share a team
  const MAX_LINEUP = 12;                       // cards equipped on every song (the 12 highest-tier owned members)
  // which team's cards may be equipped per song (matched on song title or id). Songs not listed = all members.
  const SONG_TEAM = { 'ayo senyumlah': null, 'wakaka people': 'dream', '12 seconds': 'love', 'dekat namun jauh': 'passion' };
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function songTeam(song) {                      // -> team id ('dream'|'love'|'passion') or null = every member
    if (!song) return null;
    if (song.team) return String(song.team).toLowerCase();                 // optional override: team: 'dream' in songs.js
    for (const k of [song.title, song.id]) {
      const n = norm(k);
      if (n && Object.prototype.hasOwnProperty.call(SONG_TEAM, n)) return SONG_TEAM[n];
    }
    return null;
  }
  // optional per-song guest list: only: ['fiony', 'christy', ...] in songs.js -> only these members' cards can be equipped
  function songOnly(song) {                      // -> Set of member ids, or null = no restriction
    if (!song || !Array.isArray(song.only) || !song.only.length) return null;
    const set = new Set();
    song.only.forEach(x => {
      const q = String(x).toLowerCase().trim();
      const m = everyone().find(mm => mm.id === q || mm.name.toLowerCase() === q);
      if (m) set.add(m.id);
    });
    return set.size ? set : null;
  }
  // how many card slots a song shows: every member the song lists (its `only` list plus its `guest`), max MAX_LINEUP.
  // Songs with no `only` list keep the full MAX_LINEUP slots. Nothing extra to set per song.
  function slotCount(song) {
    const fixed = song && Math.floor(Number(song.slots));          // optional `slots: 4` in songs.js caps the lineup (works with or without `only`)
    if (fixed > 0) return Math.min(MAX_LINEUP, fixed);
    const only = songOnly(song);
    if (!only) return MAX_LINEUP;
    const ids = new Set(only);
    songGuests(song).forEach(g => ids.add(g));
    return Math.max(1, Math.min(MAX_LINEUP, ids.size));
  }
  const PITY_A = 15;                           // a shop pack without an A+ card this many times in a row -> next has one
  const SHOP_ORDER = ['daily', 'standard', 'premium', 'oshi'];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const snd = (name, ...a) => { try { window.SFX && SFX[name](...a); } catch (e) { /* ignore */ } };
  const fmt = (n) => Math.round(n).toLocaleString();

  // ---------- SAVE ----------
  let S = load();
  function load() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { o = {}; }
    return {
      firstDone: o.firstDone && typeof o.firstDone === 'object' ? o.firstDone : {},
      cd: o.cd && typeof o.cd === 'object' ? o.cd : {},
      pity: Math.max(0, parseInt(o.pity, 10) || 0),
      oshi: typeof o.oshi === 'string' ? o.oshi : null,
    };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }

  const C = () => window.Cards;
  // ---------- GUEST CARDS ----------
  // Special featured-artist cards (not members, not collectable): they appear automatically in the squad bar of any song that
  // lists them (in its `only: [...]` or `guest: '...'` in songs.js). Look = SS card, badge says R, scores like SS (see GUEST_TIER).
  // Art: images/cards/<id>.webp.  To add another guest, add a line here.
  const GUEST_TIER = 4;                          // index into Cards.TIERS: 4 = SS (design + score)
  const GUEST_LABEL = 'R';
  const GUESTS = {
    bernadya: { id: 'bernadya', name: 'Bernadya', team: 'Special', color: '#ff6ad5', front: 'images/cards/bernadya.webp', back: 'images/cards/love_back.webp', guest: true },
    tasya: { id: 'tasya', name: 'Tasya', caption: 'Tasya Tety', team: 'Special', color: '#ff6ad5', front: 'images/cards/tasya.webp', back: 'images/cards/love_back.webp', guest: true },
    pia: { id: 'pia', name: 'Pia', caption: 'Pia Meraleo', team: 'Special', color: '#ff6ad5', front: 'images/cards/pia.webp', back: 'images/cards/love_back.webp', guest: true },
    shani: { id: 'shani', name: 'Shani', caption: 'Kak Ci Shani', team: 'Special', color: '#ff6ad5', front: 'images/cards/shani.webp', back: 'images/cards/love_back.webp', guest: true },
  };
  const member = (id) => GUESTS[id] || C().memberOf(id);
  const everyone = () => C().MEMBERS.concat(Object.keys(GUESTS).map(k => GUESTS[k]));
  const bestT = (id) => (GUESTS[id] ? GUEST_TIER : C().best(id));          // tier index a card counts as
  function mkCard(id, ti) {                      // a card element for a member or a guest (guests get the R badge)
    const m = member(id), el = C().makeCard(m, C().TIERS[ti], true);
    if (m.guest) { const b = el.querySelector('.tc-badge'); if (b) { b.textContent = GUEST_LABEL; b.dataset.t = GUEST_LABEL; } }     // data-t is what the big letter is drawn from
    return el;
  }
  function songGuests(song) {                    // guest ids this song features
    if (!song) return [];
    const raw = [].concat(Array.isArray(song.only) ? song.only : [], song.guest || []);
    const out = [];
    raw.forEach(x => { const q = String(x).toLowerCase().trim(); if (GUESTS[q] && out.indexOf(q) < 0) out.push(q); });
    return out;
  }

  // ---------- OSHI ----------
  const getOshi = () => (S.oshi && member(S.oshi) ? S.oshi : null);
  function setOshi(id) { S.oshi = id && member(id) ? id : null; save(); changed(); }

  // ---------- PACK RULES ----------
  const now = () => Date.now();
  function cooldownLeft(kind) {
    const t = S.cd[kind] || 0;
    return Math.max(0, Math.min(t - now(), COOLDOWN_MS));     // a clock set backwards can never lock a pack longer than 24h
  }
  function packStatus(kind) {
    const P = Packs.PACKS[kind];
    const left = kind === 'daily' ? cooldownLeft(kind) : 0;       // only the Daily Pack has a 24h lock
    const first = !S.firstDone[kind];
    const free = P.price === 0 || (first && kind === 'daily');   // new players: only the daily pack is free
    const st = { kind, price: P.price, free, first, left, ok: false, reason: '' };
    if (P.oshi && !getOshi()) { st.needsOshi = true; st.reason = 'Pick an oshi first'; return st; }
    if (left > 0) { st.reason = 'locked'; return st; }
    if (!free && Points.get() < P.price) { st.reason = 'Not enough Points'; return st; }
    st.ok = true;
    return st;
  }
  function pityA() { return S.pity >= PITY_A - 1; }
  function noteResult(hasA) { S.pity = hasA ? 0 : S.pity + 1; save(); }
  const tierBonus = (ti) => TIER_BONUS[ti] || 0;

  // pay, start the 24h lock, then play the opening
  function openPack(kind) {
    const st = packStatus(kind);
    if (!st.ok) return false;
    const P = Packs.PACKS[kind];
    if (!st.free && !Points.spend(P.price)) return false;
    const before = { fd: S.firstDone[kind], cd: S.cd[kind], pity: S.pity };
    S.firstDone[kind] = 1;
    if (kind === 'daily') S.cd[kind] = now() + COOLDOWN_MS;       // other packs: no lock, open as many as you can afford
    save();
    const drops = Packs.open(kind);
    if (!drops) {                                  // an opening is already on screen: undo everything
      if (!st.free) Points.add(P.price);
      if (before.fd) S.firstDone[kind] = before.fd; else delete S.firstDone[kind];
      if (before.cd) S.cd[kind] = before.cd; else delete S.cd[kind];
      S.pity = before.pity;
      save();
      return false;
    }
    return true;
  }
  const anyReady = () => SHOP_ORDER.some(k => { const s = packStatus(k); return s.ok && s.free; });

  // ---------- BONUS ----------
  function songSet(song) {
    const set = new Set();
    if (song && Array.isArray(song.members)) {
      song.members.forEach(x => {
        const q = String(x).toLowerCase();
        const m = everyone().find(mm => mm.id === q || mm.name.toLowerCase() === q);
        if (m) set.add(m.id);
      });
    }
    return set;
  }
  // Songs with fewer slots than MAX_LINEUP scale their per-card bonuses by MAX_LINEUP / slots, so a full set of equal-tier cards
  // gives the same total bonus on a 2-slot song as on a 12-slot song (every song can reach S with the same difficulty).
  function calc(ids, song, centerId) {
    const oshi = getOshi(), set = songSet(song);
    const slots = Math.max(1, slotCount(song)), f = MAX_LINEUP / slots;
    let cards = 0, oshiExtra = 0, match = 0;
    const teams = {};
    ids.forEach(id => {
      const t = bestT(id);
      if (t < 0) return;
      const base = TIER_BONUS[t];
      cards += base;
      if (id === oshi) oshiExtra += base * (OSHI_MULT - 1);
      if (set.has(id)) match += SONG_MATCH;
      const mm = member(id);
      if (!mm.guest) teams[mm.team] = (teams[mm.team] || 0) + 1;       // guests never count toward a team bonus
    });
    let teamId = null, teamN = 0;
    Object.keys(teams).forEach(k => { if (teams[k] > teamN) { teamN = teams[k]; teamId = k; } });
    const teamEq = (slots < MAX_LINEUP && teamN >= 2) ? teamN * f : (slots < MAX_LINEUP ? 0 : teamN);   // team size measured against a 12-card lineup (needs 2+ real cards)
    const teamPct = teamEq >= 5 ? TEAM_BONUS[5] : (TEAM_BONUS[Math.floor(teamEq)] || 0);
    const r = (v) => Math.round(v * 10) / 10;
    const ctr = (centerId && ids.indexOf(centerId) >= 0 && bestT(centerId) >= 0) ? (CENTER_BONUS[bestT(centerId)] || 0) : 0;   // CENTER: stacks with the oshi bonus
    cards *= f; oshiExtra *= f; match *= f;
    const total = cards + oshiExtra + match + teamPct + ctr;
    return { cards: r(cards), oshiExtra: r(oshiExtra), match: r(match), team: { id: teamId, n: teamN, pct: teamPct }, center: r(ctr), total: r(total) };
  }
  // the squad: the 12 highest-tier owned cards, one per member (oshi wins ties, then a random pick among the equal cards)
  // the random order is re-rolled every time the song select menu is opened (and stays the same while it is open and for the run)
  let rollKeys = new Map();
  const rollKey = (id) => { let k = rollKeys.get(id); if (k === undefined) { k = Math.random(); rollKeys.set(id, k); } return k; };
  function rerollSquad() { rollKeys = new Map(); }
  function autoLineup(song) {
    const oshi = getOshi(), team = songTeam(song), only = songOnly(song);
    const guests = songGuests(song);
    const owned = Array.from(new Set(C().ownedIds()))
      .filter(id => C().memberOf(id) && C().best(id) >= 0 && (!team || member(id).team.toLowerCase() === team) && (!only || only.has(id)))
      .sort((a, b) => (C().best(b) - C().best(a)) || ((b === oshi) - (a === oshi)) || (rollKey(a) - rollKey(b)))
      .slice(0, slotCount(song) - guests.length);
    return guests.concat(owned);
  }

  // what the game uses for one run
  let centerPick = null;                         // { song, id }: the CENTER the player picked for the song about to be played
  let cpick = null;                              // the CENTER pop out while it is open: { song, go, sel }
  const songKey = (s) => (s && (s.id || s.title)) || '';
  const centerOf = (song, ids) => (centerPick && centerPick.song === songKey(song) && ids.indexOf(centerPick.id) >= 0 ? centerPick.id : null);
  let run = { mult: 1, bonus: 0, cards: [] };
  function beginRun(song) {
    const ids = song ? autoLineup(song) : [];
    const center = centerOf(song, ids);
    const b = calc(ids, song, center);
    const oshi = getOshi();
    run = { mult: 1 + b.total / 100, bonus: b.total, center, breakdown: b, cards: ids.map(id => ({ id, tier: bestT(id), oshi: id === oshi, center: id === center })) };
    showHud(run);
    return run;
  }
  const getRun = () => run;

  // ---------- change events ----------
  const listeners = [];
  function changed() { listeners.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); refreshBadges(); try { sqCache.clear(); sqSig = ''; renderSquad(); warmSquad(); } catch (e) { /* bar not ready */ } }
  window.addEventListener('cards:change', changed);

  // ---------- shared UI ----------
  const root = h('div', 'shop-root');
  document.body.appendChild(root);
  let openName = null;

  function mkScreen(name, title) {
    const el = h('div', 'sh-screen sh-' + name);
    el.id = name + '-screen';
    // the CARD SHOP screen shows images/shop.gif as its title (falls back to the text if the image is missing)
    const titleHTML = name === 'shop'
      ? '<div class="sh-title has-img"><img class="sh-title-img" src="images/shop.gif" alt="' + title + '" onerror="this.replaceWith(document.createTextNode(this.alt))"></div>'
      : '<div class="sh-title">' + title + '</div>';
    el.innerHTML = '<div class="sh-head"><button class="sh-back gif-btn" type="button" aria-label="Back"><span class="back-pill">BACK</span></button>' + titleHTML + '<div class="sh-pts"></div></div><div class="sh-body"></div>';
    root.appendChild(el);
    el.querySelector('.sh-back').addEventListener('click', () => { hide(); if (typeof showSongSelect === 'function') showSongSelect(); });
    return { el, body: el.querySelector('.sh-body'), pts: el.querySelector('.sh-pts') };
  }
  function refreshPts(scr) { scr.pts.innerHTML = window.Points ? Points.chipHTML() : ''; }
  window.addEventListener('points:change', () => { if (openName === 'shop') refreshPts(shop); refreshBadges(); });

  function modal(inner) {
    const m = h('div', 'sh-modal');
    const box = h('div', 'sh-mbox');
    box.appendChild(inner);
    const x = h('button', 'sh-mx', '×');
    box.appendChild(x);
    m.appendChild(box);
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('in'));
    const close = () => { m.classList.remove('in'); setTimeout(() => m.remove(), 180); };
    x.addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    return { close };
  }

  function show(name) {
    const menu = $('menu-screen'), main = $('main-menu-screen');
    if (typeof stopPreview === 'function') stopPreview();
    if (window.Cards) Cards.hideScreen();
    if (menu) menu.style.display = 'none';
    if (main) main.style.display = 'none';
    root.querySelectorAll('.sh-screen').forEach(el => el.classList.toggle('show', el.classList.contains('sh-' + name)));
    openName = name;
  }
  function hide() {
    root.querySelectorAll('.sh-screen').forEach(el => el.classList.remove('show'));
    openName = null;
    clearInterval(tick); tick = 0;
  }

  // ============================================================
  //  SHOP
  // ============================================================
  const shop = mkScreen('shop', 'CARD SHOP');
  shop.body.innerHTML = '<div class="sh-row"></div><div class="sh-foot"><button class="sh-odds" type="button">ODDS &amp; RULES</button></div>';
  const row = shop.body.querySelector('.sh-row');
  let tick = 0;

  function packArt(kind) {
    const P = Packs.PACKS[kind];
    const d = h('div', 'shp');
    d.style.setProperty('--p1', P.p1); d.style.setProperty('--p2', P.p2); d.style.setProperty('--ac', P.accent);
    d.innerHTML = '<i class="shp-crimp"></i><div class="shp-emb">' + P.emblem + '</div><div class="shp-nm">' + esc(P.name.replace(' Pack', '')) + '</div><div class="shp-ct">5 cards</div><i class="shp-gloss"></i><i class="shp-crimp b"></i>';
    return d;
  }
  const mmss = (ms) => { const s = Math.ceil(ms / 1000); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':'); };

  function renderShop() {
    refreshPts(shop);
    row.innerHTML = '';
    SHOP_ORDER.forEach(kind => {
      const P = Packs.PACKS[kind], st = packStatus(kind);
      const t = h('div', 'sh-tile' + (st.left > 0 ? ' locked' : '') + ' k-' + kind);
      t.dataset.kind = kind;
      const art = h('div', 'sh-art');
      art.appendChild(packArt(kind));
      if (st.ok && st.free) art.appendChild(h('div', 'sh-ribbon', st.first && P.price ? 'FIRST TIME FREE' : 'FREE'));
      if (st.left > 0) art.appendChild(h('div', 'sh-lock', '🔒'));
      t.appendChild(art);
      t.appendChild(h('div', 'sh-name', esc(P.name)));
      t.appendChild(h('div', 'sh-sub', esc(kind === 'oshi' && getOshi() ? 'Boosted chance of ' + member(getOshi()).name : P.sub)));
      const b = h('button', 'sh-btn');
      const info = h('div', 'sh-timer');
      if (st.needsOshi) { b.textContent = 'PICK OSHI'; b.classList.add('alt'); }
      else if (st.left > 0) { b.textContent = 'LOCKED'; b.disabled = true; info.textContent = mmss(st.left); }
      else if (st.free) { b.textContent = 'OPEN · FREE'; b.classList.add('gold'); }
      else if (st.ok) { b.innerHTML = 'OPEN · ' + fmt(P.price) + ' <small>Point</small>'; }
      else { b.innerHTML = fmt(P.price) + ' <small>Point</small>'; b.disabled = true; info.textContent = 'Need ' + fmt(P.price - Points.get()) + ' more'; }
      b.addEventListener('click', () => onPack(kind));
      art.addEventListener('click', () => { if (!b.disabled) onPack(kind); });
      t.appendChild(b); t.appendChild(info);
      row.appendChild(t);
    });
  }
  function onPack(kind) {
    const st = packStatus(kind);
    if (st.needsOshi) { pickOshi(() => renderShop()); return; }
    if (!st.ok) { snd('locked'); return; }
    openPack(kind);
  }
  window.addEventListener('packs:closed', () => { if (openName === 'shop') renderShop(); changed(); });

  function tickShop() {
    if (openName !== 'shop') return;
    let again = false;
    row.querySelectorAll('.sh-tile.locked').forEach(t => {
      const left = cooldownLeft(t.dataset.kind);
      if (left <= 0) again = true; else t.querySelector('.sh-timer').textContent = mmss(left);
    });
    if (again) renderShop();
  }

  shop.body.querySelector('.sh-odds').addEventListener('click', () => {
    const b = h('div', 'sh-odds-box');
    let html = '<h3>ODDS &amp; RULES</h3><table><tr><th>Pack</th><th>Price</th><th>C</th><th>B</th><th>A</th><th>Guarantee</th></tr>';
    SHOP_ORDER.forEach(k => {
      const P = Packs.PACKS[k], sum = P.odds.C + P.odds.B + P.odds.A;
      html += '<tr><td>' + esc(P.name.replace(' Pack', '')) + '</td><td>' + (P.price ? fmt(P.price) : 'FREE') + '</td><td>' + Math.round(P.odds.C / sum * 100) + '%</td><td>' + Math.round(P.odds.B / sum * 100) + '%</td><td>' + Math.round(P.odds.A / sum * 100) + '%</td><td>' + P.minBest + '+</td></tr>';
    });
    html += '</table><ul><li>The <b>Daily Pack</b> is ' + (Packs.PACKS.daily.price ? 'free the first time you open it' : 'free') + '. All other packs cost Points.</li><li>Only the <b>Daily Pack</b> is locked for 24 hours after opening. Every other pack can be opened again right away.</li><li>Packs only hold C, B and A cards. <b>Combine</b> cards of the same member and tier to rank up: ' + C().COMBINE_NEED.map((n, i) => n + '× ' + C().TIERS[i].id + ' → ' + C().TIERS[i + 1].id).join(', ') + ' (S and SS come only from combining).</li><li>Oshi Pack: each card has a ' + Math.round(Packs.PACKS.oshi.oshi * 100) + '% chance to be your oshi.</li><li>Pity: ' + (PITY_A - 1) + ' packs in a row without an A card, and the next one has one.</li></ul>';
    b.innerHTML = html;
    modal(b);
  });

  // full-screen oshi picker: a big photo carousel, the centered member is the pick
  function pickOshi(done) {
    if (document.querySelector('.oshi-pick')) return;
    const ov = h('div', 'oshi-pick');
    ov.innerHTML =
      '<div class="op-bg"></div><div class="op-fx"></div>' +
      '<div class="op-top"><div class="op-title"><span>♥</span> Who is your oshi?</div><div class="op-filters"></div></div>' +
      '<div class="op-main"><button class="op-arrow l" type="button" aria-label="Previous">◀</button><div class="op-car"></div><button class="op-arrow r" type="button" aria-label="Next">▶</button>' +
      '<div class="op-side"><div class="op-count"></div><div class="op-name"></div><div class="op-team"></div><div class="op-hint">Swipe to browse.<br>Her card gets a bigger score bonus.</div><button class="sh-btn gold op-ok" type="button">♥ THIS IS MY OSHI</button></div></div>';
    document.body.appendChild(ov);
    const car = ov.querySelector('.op-car'), fil = ov.querySelector('.op-filters'), nameEl = ov.querySelector('.op-name'),
      teamEl = ov.querySelector('.op-team'), countEl = ov.querySelector('.op-count'), ok = ov.querySelector('.op-ok'), fx = ov.querySelector('.op-fx');
    let list = [], idx = 0, filter = 'all', raf = 0, stride = 1, done_ = false;

    for (let i = 0; i < 7; i++) fx.appendChild(h('i', '', '♥'));       // a few drifting hearts (CSS only)
    fx.querySelectorAll('i').forEach((el, i) => { el.style.left = (8 + i * 14) + '%'; el.style.animationDelay = (-i * 1.7) + 's'; el.style.fontSize = (12 + (i % 3) * 7) + 'px'; });

    const measure = () => {
      const it = car.children;
      stride = it.length > 1 ? it[1].offsetLeft - it[0].offsetLeft : (it[0] ? it[0].offsetWidth : 1) || 1;
    };
    const paint = (fromScroll) => {
      const m = list[idx];
      if (!m) return;
      ov.style.setProperty('--tc', m.color);
      Array.from(car.children).forEach((c, i) => c.classList.toggle('sel', i === idx));
      nameEl.textContent = m.name;
      teamEl.innerHTML = '<span>Team ' + esc(m.team) + '</span>';
      countEl.textContent = (idx + 1) + ' / ' + list.length;
      nameEl.classList.remove('pop'); void nameEl.offsetWidth; nameEl.classList.add('pop');
      if (fromScroll) snd('hover');
    };
    const goTo = (i, smooth) => { i = Math.max(0, Math.min(list.length - 1, i)); car.scrollTo({ left: i * stride, behavior: smooth ? 'smooth' : 'auto' }); if (!smooth) { idx = i; paint(); } };
    car.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const i = Math.max(0, Math.min(list.length - 1, Math.round(car.scrollLeft / stride)));
        if (i !== idx) { idx = i; paint(true); }
      });
    }, { passive: true });
    ov.querySelector('.op-arrow.l').addEventListener('click', () => goTo(idx - 1, true));
    ov.querySelector('.op-arrow.r').addEventListener('click', () => goTo(idx + 1, true));
    const onKey = (e) => {
      if (!ov.isConnected) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); goTo(idx - 1, true); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); goTo(idx + 1, true); }
      else if (e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); ok.click(); }
    };
    window.addEventListener('keydown', onKey, true);

    const build = (keepId) => {
      const cur = keepId || (list[idx] && list[idx].id) || getOshi();
      list = C().MEMBERS.filter(m => filter === 'all' || m.team === filter);
      list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));   // A to Z by nickname (ALL = every team mixed)
      car.innerHTML = '';
      const frag = document.createDocumentFragment();
      list.forEach((m, i) => {
        const c = h('div', 'op-item'); c.style.setProperty('--tc', m.color);
        const pic = h('div', 'op-pic');
        const im = new Image(); im.alt = m.name; im.draggable = false; im.decoding = 'async'; if (i > 3) im.loading = 'lazy';
        im.onerror = () => im.replaceWith(h('div', 'op-ph', '<b>' + esc(m.name) + '</b><small>Team ' + esc(m.team) + '</small>'));
        im.src = m.front;
        pic.appendChild(im);
        c.appendChild(pic);
        c.addEventListener('click', () => { if (i !== idx) goTo(i, true); });
        frag.appendChild(c);
      });
      car.appendChild(frag);
      fil.innerHTML = '';
      [['all', 'ALL']].concat(C().TEAMS.map(t => [t.id, t.id.toUpperCase()])).forEach(([k, label]) => {
        const b = h('button', filter === k ? 'on' : '', label); b.type = 'button';
        b.addEventListener('click', () => { if (filter === k) return; filter = k; build(); });
        fil.appendChild(b);
      });
      const at = Math.max(0, list.findIndex(m => m.id === cur));
      requestAnimationFrame(() => { measure(); goTo(at, false); });
    };

    ok.addEventListener('click', () => {
      const m = list[idx];
      if (!m || done_) return;
      done_ = true;
      setOshi(m.id); snd('fanfare');
      try { if (navigator.vibrate) navigator.vibrate([20, 30, 60]); } catch (e) { /* no haptics */ }
      const sel = car.children[idx];
      if (sel) {
        const r = sel.getBoundingClientRect();
        for (let i = 0; i < 14; i++) {
          const hh = h('i', 'op-burst', '♥');
          hh.style.left = (r.left + r.width / 2) + 'px'; hh.style.top = (r.top + r.height * .55) + 'px';
          hh.style.fontSize = (14 + Math.random() * 18) + 'px';
          ov.appendChild(hh);
          const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 150;
          hh.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 40}px)) scale(1)`, opacity: 0 }], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => hh.remove();
        }
      }
      ov.classList.add('chosen');
      setTimeout(() => {
        window.removeEventListener('keydown', onKey, true);
        ov.classList.add('out'); setTimeout(() => ov.remove(), 280);
        if (done) done();
      }, 750);
    });
    build();
  }

  // ============================================================
  //  SQUAD BAR  (the bottom of the song-select page)
  //  The 12 highest-tier owned cards (one per member) are equipped
  //  automatically on every song. Missing slots show a locked blank.
  // ============================================================
  let curSong = null;
  const sqBar = h('div', 'sq-bar');
  sqBar.id = 'squad-bar';
  sqBar.innerHTML = '<div class="sq-best"></div><div class="sq-main"><div class="sq-cap"></div><div class="sq-grid"></div></div><div class="sq-tag"></div>';
  document.body.appendChild(sqBar);
  const sqBest = sqBar.querySelector('.sq-best'), sqGrid = sqBar.querySelector('.sq-grid'), sqTag = sqBar.querySelector('.sq-tag'), sqCap = sqBar.querySelector('.sq-cap');

  // Card elements are built once per member+tier and then reused, so scrolling to another song never has to
  // rebuild or re-decode the card art. (This was the cause of the carousel lag.)
  let sqCache = new Map(), sqSig = '', sqCapHTML = '', sqTagHTML = '', sqTimer = 0;
  function sqCardEl(id) {
    const ti = bestT(id), key = id + ':' + ti;
    let el = sqCache.get(key);
    if (!el) {
      el = mkCard(id, ti);
      el.style.setProperty('--cw', 'var(--sq-cw)');
      el.style.pointerEvents = 'none';
      el.classList.add('flat');
      const bk = el.querySelector('.tc-back'); if (bk) bk.remove();      // never flipped: no back face to decode or composite
      sqCache.set(key, el);
    }
    return el;
  }
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 900 }) : setTimeout(f, 150));
  // pre-build and pre-decode every owned card in the background so the first scroll to a new loadout is also smooth
  function warmSquad() {
    if (!window.Cards || !C().ownedIds) return;
    const q = C().ownedIds().slice();
    const step = (dl) => {
      let n = 0;
      while (q.length && n < 3 && (!dl || !dl.timeRemaining || dl.timeRemaining() > 4)) {
        try { sqCardEl(q.shift()).querySelectorAll('img').forEach(im => { if (im.decode) im.decode().catch(() => {}); }); } catch (e) { /* ignore */ }
        n++;
      }
      if (q.length) idle(step);
    };
    idle(step);
  }
  function renderSquad() {
    if (!window.Cards || !C().MEMBERS) return;
    const ids = autoLineup(curSong), slots = slotCount(curSong), oshi = getOshi(), set = songSet(curSong), tm = songTeam(curSong), on = songOnly(curSong), gn = songGuests(curSong).map(g => (GUESTS[g].caption || GUESTS[g].name).toUpperCase()), bo = calc(ids, curSong);
    // identical loadout + markers to what is already on screen? then do not touch the cards at all
    const sig = [ids.map(id => id + ':' + bestT(id)).join(','), oshi || '', ids.filter(id => set.has(id)).join(','), tm || '', on ? 'only' : '', slots].join('|');
    if (sig !== sqSig || !sqGrid.firstChild) {
      sqSig = sig;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < slots; i++) {
        const id = ids[i];
        const cell = h('div', 'sq-cell');
        let ok = false;
        if (id) {
          try {
            cell.appendChild(sqCardEl(id));
            if (set.has(id) || id === oshi) cell.insertAdjacentHTML('beforeend', '<span class="sq-fl">' + (set.has(id) ? '<u>♪</u>' : '') + (id === oshi ? '<u class="h">♥</u>' : '') + '</span>');
            ok = true;
          } catch (e) { /* fall back to a blank slot */ }
        }
        if (ok) cell.dataset.m = id;                 // which member this cell is (the CENTER pick reads it)
        if (!ok) { cell.classList.add('empty'); cell.innerHTML = '<div class="sq-blank"><span>🔒</span></div>'; }
        frag.appendChild(cell);
      }
      sqGrid.replaceChildren(frag);                  // one DOM swap, one layout
    }
    sqBar.style.setProperty('--sq-n', slots);       // how many cells the bar holds, so the CSS can centre them on the whole screen
    const tmName = tm ? tm.toUpperCase() : '';
    const duet = !!(curSong && curSong.duet) && gn.length > 0;
    const capHTML = 'HIGHEST CARDS EQUIPPED' + (duet ? ' <em>· DUET WITH ' + esc(gn.join(' & ')) + '</em>' : on ? ' <em>· CHOSEN MEMBERS' + (gn.length ? ' WITH ' + esc(gn.join(' & ')) : '') + '</em>' : tm ? ' <em>· TEAM ' + esc(tmName) + ' ONLY</em>' : ' <em>· ALL MEMBERS' + (gn.length ? ' WITH ' + esc(gn.join(' & ')) : '') + '</em>');
    const tagHTML = ids.length ? 'TEAM <b>+' + bo.total + '%</b> <small>' + ids.length + '/' + slots + '</small>' : (on ? 'NO CARDS OF THE CHOSEN MEMBERS YET · OPEN A PACK IN THE SHOP' : tm ? 'NO ' + esc(tmName) + ' CARDS YET · OPEN A PACK IN THE SHOP' : 'NO CARDS YET · OPEN A PACK IN THE SHOP');
    if (capHTML !== sqCapHTML) { sqCapHTML = capHTML; sqCap.innerHTML = capHTML; }
    if (tagHTML !== sqTagHTML) { sqTagHTML = tagHTML; sqTag.innerHTML = tagHTML; }
    sqTag.classList.toggle('none', !ids.length);
    renderBest();
    measureSquad();
  }
  // the selected song's saved best score, in the left part of the bar (loadBest() lives in game.js)
  let sqBestHTML = '';
  function renderBest() {
    let b = null;
    try { b = curSong && typeof loadBest === 'function' ? loadBest(curSong.id) : null; } catch (e) { b = null; }
    const has = b && Number(b.score) > 0;
    const html = has
      ? '<div class="sb-label">BEST SCORE</div><div class="sb-grade">' + esc(b.grade || '-') + '</div><div class="sb-score">' + fmt(b.score) + '</div>' + (b.fc ? '<div class="sb-fc">FULL COMBO</div>' : '')
      : '<div class="sb-label">BEST SCORE</div><div class="sb-none">NOT PLAYED YET</div>';
    if (html !== sqBestHTML) { sqBestHTML = html; sqBest.innerHTML = html; }
  }
  function measureSquad() {
    const hgt = sqBar.classList.contains('show') ? sqBar.offsetHeight : 0;
    document.documentElement.style.setProperty('--sq-h', hgt + 'px');
  }

  // show the bar only while the song-select page is on screen
  let sqOn = false, menuWasShown = false;
  function syncSquad() {
    const menu = $('menu-screen');
    // the song select menu just opened (title, back from a song, ...): shuffle which equal-tier cards make the squad
    const shown = !!menu && menu.style.display !== 'none';
    if (shown && !menuWasShown) { rerollSquad(); sqCache.clear(); sqSig = ''; }
    menuWasShown = shown;
    let on = false;
    if (menu && !openName && !document.querySelector('.oshi-pick')) {
      const cs = getComputedStyle(menu);
      on = cs.display !== 'none' && cs.visibility !== 'hidden' && menu.getClientRects().length > 0;
    }
    if (on === sqOn) return;
    sqOn = on;
    sqBar.classList.toggle('show', on);
    document.body.classList.toggle('squad-on', on);
    if (on) { renderSquad(); warmSquad(); } else measureSquad();
  }
  (() => {
    const menu = $('menu-screen');
    if (menu && window.MutationObserver) new MutationObserver(syncSquad).observe(menu, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    setInterval(() => { if (!document.body.classList.contains('carousel-scrolling')) syncSquad(); }, 600);
    window.addEventListener('resize', measureSquad);
    window.addEventListener('orientationchange', () => setTimeout(measureSquad, 250));
    syncSquad();
  })();
  // optional: call Shop.setSong(song) when the selected song changes so the ♪ marks and bonus follow it
  // song changed: let the carousel finish moving first, then update the bar (rapid swipes only render the last one)
  function setSong(song) {
    if (cpick) return;                           // a CENTER pick is open: the bar stays on the song being picked for
    curSong = song || null;
    if (!sqOn) return;
    clearTimeout(sqTimer);
    // wait for the carousel to settle, then do the update in idle time (and only if the loadout really changed)
    sqTimer = setTimeout(() => idle(() => { if (sqOn && !document.body.classList.contains('carousel-scrolling')) renderSquad(); else if (sqOn) setSong(curSong); }), 220);
  }
  // ============================================================
  //  CENTER PICK
  //  PLAY -> YES calls openLineup(song, go). A pop out asks for the CENTER, the equipped cards in the bottom bar become
  //  clickable, tapping one asks "PICK <name> AS CENTER?" (YES starts the song by calling go(), NO goes back to picking).
  //  The CENTER card gives CENTER_BONUS[its tier] % on top of its own bonus (see calc / beginRun).
  //  false = "nothing to pick, start the song"
  // ============================================================
  let pickEl = null;
  const centerBonusFor = (ti) => CENTER_BONUS[ti] || 0;
  function pickBuild() {
    if (pickEl) return;
    pickEl = h('div');
    pickEl.id = 'center-pick';
    pickEl.innerHTML =
      '<div class="cp-box cpk-box" role="dialog" aria-modal="true" aria-labelledby="cpk-title">' +
        '<div class="cp-title cpk-title" id="cpk-title"></div>' +
        '<div class="cpk-sub"></div>' +
        '<div class="cp-btns cpk-btns"><button type="button" class="cp-yes">YES</button><button type="button" class="cp-no">NO</button></div>' +
        '<button type="button" class="cpk-back">BACK</button>' +
      '</div>';
    document.body.appendChild(pickEl);
    pickEl.querySelector('.cp-yes').addEventListener('click', pickYes);
    pickEl.querySelector('.cp-no').addEventListener('click', pickNo);
    pickEl.querySelector('.cpk-back').addEventListener('click', pickCancel);
  }
  function pickMark(id) {
    sqGrid.querySelectorAll('.sq-cell').forEach(c => c.classList.toggle('sel', !!id && c.dataset.m === id));
    document.body.classList.toggle('cp-has-sel', !!id);
  }
  function pickRender() {
    if (!cpick || !pickEl) return;
    const title = pickEl.querySelector('.cpk-title'), sub = pickEl.querySelector('.cpk-sub');
    pickEl.classList.toggle('confirm', !!cpick.sel);
    if (!cpick.sel) {
      title.textContent = 'PICK THE CENTER FOR THIS SONG';
      sub.innerHTML = 'Tap one of your equipped cards below.<br>A higher tier card gives a bigger <b>CENTER</b> bonus.';
    } else {
      const ti = bestT(cpick.sel), t = C().TIERS && C().TIERS[ti];
      title.textContent = 'PICK ' + String(member(cpick.sel).name || '').toUpperCase() + ' AS CENTER?';
      sub.innerHTML = '<b>CENTER</b> bonus <b>+' + centerBonusFor(ti) + '%</b>' + (t ? ' <small>(' + esc(t.id) + ' card)</small>' : '');
    }
  }
  function pickSelect(cell) {
    if (!cpick || !cell || !cell.dataset.m) return;
    cpick.sel = cell.dataset.m;
    pickMark(cpick.sel);
    pickRender();
    try { if (typeof UI_SND !== 'undefined' && UI_SND.chip) UI_SND.chip(Math.max(0, Array.prototype.indexOf.call(sqGrid.children, cell))); } catch (e) { /* ignore */ }
    const y = pickEl.querySelector('.cp-yes');
    if (y) y.focus({ preventScroll: true });
  }
  function pickClose() {
    if (pickEl) pickEl.classList.remove('show');
    document.body.classList.remove('center-picking');
    pickMark(null);
    cpick = null;
  }
  function pickYes() {
    const q = cpick;
    if (!q || !q.sel) return;
    centerPick = { song: songKey(q.song), id: q.sel };
    pickClose();
    q.go();                                      // the song starts
  }
  function pickNo() {
    if (!cpick) return;
    cpick.sel = null;
    pickMark(null);
    pickRender();                                // back to "PICK THE CENTER FOR THIS SONG"
  }
  function pickCancel() {                        // BACK: leave the pick, nothing starts
    if (!cpick) return;
    centerPick = null;
    pickClose();
  }
  sqGrid.addEventListener('click', (e) => {
    if (cpick) pickSelect(e.target.closest ? e.target.closest('.sq-cell') : null);
  });
  window.addEventListener('keydown', (e) => {    // while the pop out is open the song list behind it must not move
    if (!cpick) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (cpick.sel) pickNo(); else pickCancel(); }
    else if (e.key && e.key.indexOf('Arrow') === 0) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  function openLineup(song, go) {
    if (cpick) return true;
    if (!song || typeof go !== 'function') return false;
    centerPick = null;
    curSong = song;
    if (!sqBar.classList.contains('show')) return false;      // the bottom bar is not on screen: nothing to tap, just start
    renderSquad();
    if (!autoLineup(song).length) return false;               // no cards equipped: no center to pick
    pickBuild();
    cpick = { song, go, sel: null };
    document.body.classList.add('center-picking');
    pickEl.classList.remove('show'); void pickEl.offsetWidth;
    pickEl.classList.add('show');
    pickMark(null);
    pickRender();
    return true;
  }

  // ============================================================
  //  IN-GAME CARD STRIP
  // ============================================================
  function slotCard(id, size) {
    const el = mkCard(id, bestT(id));
    el.style.setProperty('--cw', size + 'px');
    el.style.pointerEvents = 'none';
    return el;
  }
  // ---- cheering cards: 3 on stage (centre + 2 behind), rotating one by one; purely visual ----
  let hud = null, cheer = null, cheerPaused = false, lastPulse = 0;
  function cheerCard(id) {
    let w = cheer.els.get(id);
    if (w) return w;
    const t = bestT(id);
    w = h('div', 'cc-card ct-' + t);
    const bob = h('div', 'cc-bob');
    bob.innerHTML = '<i class="cc-aura"></i>';
    const pl = h('div', 'cc-pulse');
    const cardEl = mkCard(id, t);
    cardEl.classList.add('flat');                                   // same flat, no-animation card the squad bar uses (see shop.css)
    const bk = cardEl.querySelector('.tc-back'); if (bk) bk.remove();   // never flipped in game: no back face to composite
    pl.appendChild(cardEl);
    bob.appendChild(pl);
    if (cheer.center === id) bob.appendChild(h('b', 'cc-center', '★ CENTER'));
    bob.insertAdjacentHTML('beforeend', '<i class="cc-spark s1">✦</i><i class="cc-spark s2">✦</i><i class="cc-spark s3">✦</i>');
    w.appendChild(bob);
    cheer.els.set(id, w);
    return w;
  }
  function setPos(w, pos) { w.className = w.className.replace(/\s*pos-\w+/, '') + ' pos-' + pos; }
  function layoutCheer() {
    const ids = cheer.ids, n = ids.length, i = cheer.i;
    const want = new Map();
    want.set(ids[i], 'c');
    if (n >= 2) want.set(ids[(i + 1) % n], 'r');
    if (n >= 3) want.set(ids[(i - 1 + n) % n], 'l');
    want.forEach((pos, id) => {
      const w = cheerCard(id);
      clearTimeout(w._rm);
      if (!w.parentNode) { setPos(w, 'fr'); hud.appendChild(w); void w.offsetWidth; }
      setPos(w, pos);
    });
    Array.from(hud.querySelectorAll('.cc-card')).forEach(w => {
      const id = w.querySelector('.tcard').dataset.m;
      if (want.has(id)) return;
      setPos(w, 'fl');
      clearTimeout(w._rm);
      w._rm = setTimeout(() => { if (w.parentNode && w.classList.contains('pos-fl')) w.remove(); }, 650);
    });
  }
  function cheerLoop() {
    if (!hud || !cheer) return;
    const tier = +document.body.dataset.tier || 0;
    if (cheer.ids.length > 1 && !cheerPaused && !document.hidden) {
      cheer.i = (cheer.i + 1) % cheer.ids.length;
      layoutCheer();
      pulseEl(cheerCard(cheer.ids[cheer.i]), 1.14);
    }
    cheer.timer = setTimeout(cheerLoop, 3800 - tier * 450);
  }
  function pulseEl(w, k) {
    const p = w && w.querySelector('.cc-pulse');
    if (p) p.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + k + ')', offset: .35 }, { transform: 'scale(1)' }], { duration: 230, easing: 'ease-out' });
  }
  function showHud(r) {
    hideHud();
    if (!r || !r.cards.length || !window.Cards) return;
    hud = h('div', 'card-cheer' + (cheerPaused ? ' paused' : ''));
    hud.innerHTML = '<b class="cc-bonus">+' + r.bonus + '%</b>';
    cheer = { ids: r.cards.map(c => c.id), center: r.center || null, i: 0, els: new Map(), timer: 0 };
    document.body.appendChild(hud);
    layoutCheer();
    cheer.timer = setTimeout(cheerLoop, 3800);
  }
  function hideHud() {
    if (cheer) clearTimeout(cheer.timer);
    if (hud) hud.remove();
    hud = null; cheer = null;
  }
  function setCheerPaused(p) { cheerPaused = !!p; if (hud) hud.classList.toggle('paused', cheerPaused); }
  // equipped-cards row for the pause / game over / results cards (every .eq-strip on the page)
  function fillStrips() {
    document.querySelectorAll('.eq-strip').forEach(el => {
      el.textContent = '';
      if (!run || !run.cards.length || !window.Cards) return;
      const row = h('div', 'eq-row');
      run.cards.forEach(c => {
        const card = mkCard(c.id, bestT(c.id));
        card.style.pointerEvents = 'none';
        if (c.center) card.appendChild(h('b', 'eq-center', '★ CENTER'));      // pause / game over / results
        row.appendChild(card);
      });
      el.appendChild(h('div', 'eq-label', 'EQUIPPED CARDS <b>+' + run.bonus + '%</b>'));
      el.appendChild(row);
    });
  }
  // same card strip, but from a saved run (used by the "view high score" card)
  function fillStripFrom(el, cards, bonus) {
    if (!el) return;
    el.textContent = '';
    if (!cards || !cards.length || !window.Cards) return;
    const row = h('div', 'eq-row');
    cards.forEach(cd => {
      try {
        const card = mkCard(cd.id, cd.tier >= 0 ? cd.tier : bestT(cd.id));
        card.style.pointerEvents = 'none';
        if (cd.center) card.appendChild(h('b', 'eq-center', '★ CENTER'));     // saved high-score run
        row.appendChild(card);
      } catch (e) { /* unknown card id: skip */ }
    });
    el.appendChild(h('div', 'eq-label', 'EQUIPPED CARDS <b>+' + (bonus || 0) + '%</b>'));
    el.appendChild(row);
  }
  // the run's CENTER card, big, for the result card (saved = { cards } of a stored high-score run); empty when no center was picked
  function fillCenter(el, saved) {
    if (!el) return;
    el.textContent = '';
    let id = null, ti = -1;
    if (saved) {
      const c = (saved.cards || []).find(x => x.center);
      if (c) { id = c.id; ti = c.tier; }
    } else if (run && run.center) { id = run.center; }
    if (!id || !window.Cards) return;
    try {
      const card = mkCard(id, ti >= 0 ? ti : bestT(id));
      card.style.pointerEvents = 'none';
      el.appendChild(card);
      el.appendChild(h('b', 'eq-center rl-center-tag', '\u2605 CENTER'));
    } catch (e) { /* unknown card id: leave the slot empty */ }
  }
  // called on every PERFECT: the centre card bounces (the side cards just a little)
  function pulse() {
    if (!hud || !cheer) return;
    const now = performance.now();
    if (now - lastPulse < 130) return;
    lastPulse = now;
    pulseEl(hud.querySelector('.pos-c'), 1.2);       // only the centre card bounces now (the two side cards used to as well)
  }

  // ---------- red dots ----------
  function refreshBadges() {
    const b = $('shop-btn');
    if (b) b.classList.toggle('has-new', anyReady());
    const c = $('my-cards-btn');
    if (c && window.Cards && C().canCombineAny()) c.classList.add('has-new');
  }
  setInterval(refreshBadges, 5000);

  // ---------- wiring ----------
  function openShop() {
    show('shop');
    renderShop();
    clearInterval(tick);
    tick = setInterval(tickShop, 1000);
  }
  const sb = $('shop-btn');
  if (sb) sb.addEventListener('click', openShop);

  window.Shop = {
    open: openShop, openLineup, setSong, songTeam, renderSquad, hide, openPack, packStatus, cooldownLeft,
    getOshi, setOshi, pickOshi, tierBonus, pityA, noteResult, calc, autoLineup, slotCount, renderBest, beginRun, getRun, hideHud, pulse, setCheerPaused, fillStrips, fillStripFrom, fillCenter,
    onChange(fn) { listeners.push(fn); },
    TIER_BONUS, CENTER_BONUS, OSHI_MULT, SONG_MATCH, TEAM_BONUS,
    isOpen: () => !!openName,
    // console: Shop.reset() clears shop timers so you can test the free first-time packs again
    reset() { S = load(); S.firstDone = {}; S.cd = {}; S.pity = 0; save(); if (openName === 'shop') renderShop(); refreshBadges(); },
  };
  refreshBadges();
  setTimeout(() => { try { renderSquad(); } catch (e) { /* ignore */ } }, 600);
})();