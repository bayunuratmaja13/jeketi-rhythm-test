// ============================================================
//  JEKETI RHYTHM — cards.js  (My Cards collection)
// ============================================================
(() => {
  'use strict';

  // ---------- SETTINGS ----------
  const CFG = {
    previewAll: false,     // true  = every card shows as owned (example/preview mode)
                          // false = real mode, cards only appear once earned
  };

  const STORE_KEY = 'jeketi.cards';

  // Tier order = left to right in the collection
  const TIERS = [
    { id: 'C',  name: 'Bronze',        hint: 'Finish a song with rank C' },
    { id: 'B',  name: 'Silver',        hint: 'Rank B, or C with a Full Combo' },
    { id: 'A',  name: 'Gold',          hint: 'Rank A, or B with a Full Combo' },
    { id: 'S',  name: 'Radiant Gold',  hint: 'Rank S, or A with a Full Combo' },
    { id: 'SS', name: 'Dazzling Gold', hint: 'Rank S with a Full Combo' },
  ];

  // Add a member = add her name to her team's list. Her art is images/cards/<lowercase name>.webp
  const TEAMS = [
    { id: 'Love', color: '#e0488a', back: 'images/cards/love_back.webp',
      members: ['Anindya', 'Lia', 'Lana', 'Elin', 'Cynthia', 'Fiony', 'Fritzy', 'Gracie', 'Lily', 'Indah', 'Trisha', 'Michie', 'Nayla'] },
    { id: 'Dream', color: '#17b3a3', back: 'images/cards/dream_back.webp',
      members: ['Delynn', 'Olla', 'Freya', 'Ella', 'Gita', 'Greesel', 'Eli', 'Lyn', 'Marsha', 'Nachia', 'Oline', 'Nala'] },
    { id: 'Passion', color: '#e8541e', back: 'images/cards/passion_back.webp',
      members: ['Aralie', 'Christy', 'Erine', 'Oniel', 'Danella', 'Daisy', 'Feni', 'Jessi', 'Kathrina', 'Lulu', 'Levi', 'Muthe', 'Raisha', 'Ribka', 'Kimmy'] },
  ];
  const MEMBERS = TEAMS.flatMap(T => T.members.map(name => {
    const id = name.toLowerCase();
    return { id, name, team: T.id, color: T.color, front: `images/cards/${id}.webp`, back: T.back };
  }));

  const BURST_COLORS = {
    C: ['#e0a56b', '#f6c897'], B: ['#dfe6ef', '#ffffff'], A: ['#ffd54a', '#fff0a0'],
    S: ['#ffd23f', '#fffbd2', '#ffb300'], SS: ['#ffe680', '#ff9fd0', '#7fe0ff', '#ffffff', '#c9a0ff'],
  };

  // ---------- STORAGE ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } };
  const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage blocked */ } };
  let store = load();

  const keyOf = (m, t) => m.id + ':' + t.id;

  // "seen" = the player has owned this card at least once. Unseen = locked (back + padlock), seen but empty = greyed out
  const SEEN_KEY = 'jeketi.cardsSeen';
  let seen = (() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch (e) { return {}; } })();
  const persistSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { /* storage blocked */ } };
  (() => { let ch = false; Object.keys(store).forEach(k => { if (!seen[k]) { seen[k] = 1; ch = true; } }); if (ch) persistSeen(); })();
  const isSeen = (m, t) => !!seen[keyOf(m, t)];
  const isOshiId = (id) => { try { return !!(window.Shop && Shop.getOshi && Shop.getOshi() === id); } catch (e) { return false; } };
  const HEART = '<span class="tc-heart">♥</span>';
  function syncHeart(c, on) {
    if (!c) return;
    c.querySelectorAll('.tc-heart').forEach(x => x.remove());
    c.classList.toggle('oshi', !!on);
    if (on) c.insertAdjacentHTML('beforeend', HEART);
  }
  function entry(m, t) {
    const e = store[keyOf(m, t)];
    if (e) return e;
    return CFG.previewAll ? { n: 1, fresh: false } : null;
  }
  const ownedCount = (m) => TIERS.filter(t => entry(m, t)).length;
  // a card won but not yet looked at (red dot on its team tab and member tab)
  const hasFresh = (m) => TIERS.some(t => { const e = store[keyOf(m, t)]; return !!(e && e.fresh); });

  // ---------- ELEMENTS ----------
  const $ = (id) => document.getElementById(id);
  const screen = $('cards-screen'), tabsEl = $('cards-tabs'), rowEl = $('cards-row');
  const progEl = $('cards-progress'), membersEl = $('cards-members'), toastEl = $('cards-toast'), openBtn = $('my-cards-btn');
  let tab = MEMBERS[0].id;

  const SPARKS = [[14, 18, 0], [84, 12, .6], [90, 60, 1.1], [10, 72, .3], [52, 90, .9]]
    .map(([x, y, d]) => `<span class="sp" style="left:${x}%;top:${y}%;animation-delay:${d}s">✦</span>`).join('');
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/></svg>';

  // ---------- CARD ----------
  function makeCard(m, t, owned, ghost) {
    const c = document.createElement('div');
    c.className = `tcard t-${t.id.toLowerCase()}` + (owned ? '' : (ghost ? ' ghost' : ' locked'));
    c.dataset.m = m.id;
    c.dataset.t = t.id;
    c.innerHTML =
      '<i class="tc-glow"></i><div class="tc-tilt"><div class="tc-inner">' +
        `<div class="tc-face tc-front"><div class="tc-art"><img src="${m.front}" alt="${m.name}" draggable="false" onerror="this.outerHTML='<div class=tc-ph style=--pc:${m.color}><b>${m.name}</b><small>Team ${m.team}</small></div>'"><i class="tc-foil"></i><i class="tc-sheen"></i><i class="tc-sweep"></i></div>` +
          `<span class="tc-badge">${t.id}</span>${t.id === 'SS' ? SPARKS : ''}</div>` +
        `<div class="tc-face tc-back"><div class="tc-art"><img src="${m.back}" alt="Team ${m.team}" draggable="false"><i class="tc-sheen"></i><i class="tc-sweep"></i><div class="tc-lock">${LOCK}<b>${t.id}</b></div></div></div>` +
      '</div></div>';
    if ((owned || ghost) && isOshiId(m.id)) syncHeart(c, true);
    return c;
  }

  // 3D tilt + light that follows the finger / pointer
  function enableTilt(root) {
    root.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.tcard');
      if (!c || c.classList.contains('locked') || c.classList.contains('ghost')) return;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - .5) * 24).toFixed(1));
      c.style.setProperty('--rx', ((.5 - y) * 24).toFixed(1));
      c.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(0) + '%');
      c.style.setProperty('--shine', '1');
      c.classList.add('tilting');
    });
    const reset = (c) => {
      ['--rx', '--ry', '--shine'].forEach(p => c.style.removeProperty(p));
      c.classList.remove('tilting');
    };
    root.addEventListener('pointerout', (e) => {
      const c = e.target.closest('.tcard');
      if (c && !c.contains(e.relatedTarget)) reset(c);
    });
    root.addEventListener('pointerup', (e) => { const c = e.target.closest('.tcard'); if (c) reset(c); });
    root.addEventListener('pointercancel', (e) => { const c = e.target.closest('.tcard'); if (c) reset(c); });
  }

  // ---------- COLLECTION SCREEN ----------
  function renderTabs() {
    const cur = MEMBERS.find(x => x.id === tab) || MEMBERS[0];
    tabsEl.innerHTML = '';
    TEAMS.forEach(T => {
      const list = MEMBERS.filter(m => m.team === T.id);
      const n = list.reduce((s, m) => s + ownedCount(m), 0), tot = list.length * TIERS.length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cards-tab' + (T.id === cur.team ? ' on' : '') + (n === tot ? ' complete' : '') + (list.some(hasFresh) ? ' has-new' : '');
      b.style.setProperty('--tc', T.color);
      b.innerHTML = `<span>Team ${T.id}</span><small>${n}/${tot}</small>`;
      b.addEventListener('click', () => { if (cur.team === T.id) return; tab = list[0].id; renderTabs(); renderRow(true); });
      tabsEl.appendChild(b);
    });
    membersEl.innerHTML = '';
    MEMBERS.filter(m => m.team === cur.team).forEach(m => {
      const n = ownedCount(m);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cards-chip' + (m.id === tab ? ' on' : '') + (n === TIERS.length ? ' complete' : '') + (hasFresh(m) ? ' has-new' : '');
      b.style.setProperty('--tc', m.color);
      b.innerHTML = `${m.name}<small>${n}/${TIERS.length}</small>`;
      b.addEventListener('click', () => { if (tab === m.id) return; tab = m.id; renderTabs(); renderRow(true); });
      membersEl.appendChild(b);
    });
    const on = membersEl.querySelector('.on');
    if (on) membersEl.scrollLeft = on.offsetLeft - membersEl.clientWidth / 2 + on.offsetWidth / 2;
  }

  function renderRow(deal) {
    const m = MEMBERS.find(x => x.id === tab) || MEMBERS[0];
    rowEl.innerHTML = '';
    rowEl.classList.remove('deal');
    TIERS.forEach((t, i) => {
      const e = entry(m, t);
      const slot = document.createElement('div');
      slot.className = 'slot' + (e ? '' : ' empty');
      slot.style.setProperty('--i', i);
      const c = makeCard(m, t, !!e, !e && isSeen(m, t));
      if (e && e.fresh) c.insertAdjacentHTML('beforeend', '<span class="tc-new">NEW</span>');
      if (e && e.n > 1) c.insertAdjacentHTML('beforeend', `<span class="tc-count">×${e.n}</span>`);
      if (canCombine(m.id, i)) c.insertAdjacentHTML('beforeend', '<span class="tc-up">▲ COMBINE</span>');
      slot.appendChild(c);
      slot.insertAdjacentHTML('beforeend', `<div class="cap">${e || isSeen(m, t) ? t.name : 'Locked'}</div>`);
      rowEl.appendChild(slot);
    });
    if (deal) { void rowEl.offsetWidth; rowEl.classList.add('deal'); }
  }

  function renderProgress() {
    const total = MEMBERS.length * TIERS.length;
    const have = MEMBERS.reduce((s, m) => s + ownedCount(m), 0);
    progEl.innerHTML = `<b>${have}</b><span>/${total}</span><small>collected</small>` + (window.Points ? Points.chipHTML() : '');
  }

  function renderAll(deal) { renderTabs(); renderRow(deal); renderProgress(); }

  function refreshBadge() {
    if (openBtn) openBtn.classList.toggle('has-new', Object.values(store).some(e => e && e.fresh));
  }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  const snd = (name, ...a) => { try { window.SFX && SFX[name](...a); } catch (e) { /* ignore */ } };
  const screenOpen = () => screen.style.display !== 'none';

  function showScreen() {
    if (typeof stopPreview === 'function') stopPreview();
    $('menu-screen').style.display = 'none';
    screen.style.display = '';
    renderAll(true);
  }

  function hideScreen() {
    closeViewer();
    screen.style.display = 'none';
  }

  rowEl.addEventListener('click', (e) => {
    const c = e.target.closest('.tcard');
    if (!c) return;
    const m = MEMBERS.find(x => x.id === c.dataset.m), t = TIERS.find(x => x.id === c.dataset.t);
    if (!entry(m, t)) {
      const ghost = c.classList.contains('ghost');
      snd('locked');
      toast(ghost ? `${m.name} ${t.id} · you don't have this card right now` : `${t.id} · ${t.hint}`);
      c.classList.remove('wobble'); void c.offsetWidth; c.classList.add('wobble');
      return;
    }
    snd('cardTap', TIERS.indexOf(t));
    openViewer(m, t);
  });
  enableTilt(rowEl);
  rowEl.addEventListener('pointerover', (e) => {          // desktop: soft tick when the mouse reaches a card
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest('.tcard');
    if (c && !c.contains(e.relatedTarget)) snd('hover');
  });

  // ---------- VIEWER / REVEAL ----------
  const V = document.createElement('div');
  V.id = 'card-viewer';
  V.innerHTML =
    '<button class="cv-close" type="button" aria-label="Close">✕</button>' +
    '<div class="cv-stage"><div class="cv-title"></div><div class="cv-cardwrap"></div><div class="cv-info"></div><div class="cv-actions"></div><div class="cv-hint">Tap the card to flip it</div></div>' +
    '<div class="cv-burst"></div>';
  document.body.appendChild(V);
  enableTilt(V);
  const vTitle = V.querySelector('.cv-title'), vWrap = V.querySelector('.cv-cardwrap'),
        vInfo = V.querySelector('.cv-info'), vActs = V.querySelector('.cv-actions'), vBurst = V.querySelector('.cv-burst');
  let revealTimer = 0;
  const viewerOpen = () => V.classList.contains('show');

  function burst(t) {
    const r = vWrap.getBoundingClientRect();
    vBurst.style.left = (r.left + r.width / 2) + 'px';
    vBurst.style.top = (r.top + r.height / 2) + 'px';
    vBurst.innerHTML = '';
    const cols = BURST_COLORS[t.id], n = { C: 10, B: 12, A: 16, S: 24, SS: 36 }[t.id];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--a', (Math.PI * 2 * i / n + Math.random() * .4) + 'rad');
      p.style.setProperty('--d', (r.width * (.6 + Math.random() * .7)).toFixed(0) + 'px');
      p.style.setProperty('--c', cols[i % cols.length]);
      vBurst.appendChild(p);
    }
    setTimeout(() => { vBurst.innerHTML = ''; }, 1100);
  }

  function sfx(t) {
    snd('cardTap', TIERS.indexOf(t));
    try {
      if (t.id === 'S' || t.id === 'SS') { if (typeof playStampSound === 'function') playStampSound('S'); }
      if (t.id !== 'C' && t.id !== 'B' && typeof playRecordSound === 'function') playRecordSound();
    } catch (e) { /* audio blocked */ }
  }

  function openViewer(m, t, opts = {}) {
    clearTimeout(revealTimer);
    vWrap.innerHTML = '';
    const c = makeCard(m, t, true);
    vWrap.appendChild(c);
    vTitle.textContent = opts.title || (opts.reveal ? (opts.isNew ? 'NEW CARD!' : `DUPLICATE ×${opts.n}`) : '');
    vInfo.innerHTML = `<b>${m.name}</b><span>Team ${m.team}</span><em class="chip t-${t.id.toLowerCase()}">${t.id} · ${t.name}</em>`;
    V.classList.add('show');
    c.addEventListener('click', () => { snd('flip'); c.classList.toggle('flipped'); });

    const k = keyOf(m, t);
    if (store[k] && store[k].fresh) { store[k].fresh = false; persist(); refreshBadge(); }

    drawActions(m, t);

    if (opts.reveal) {
      c.classList.add('flipped');                   // starts face-down, then flips over
      revealTimer = setTimeout(() => { c.classList.remove('flipped'); burst(t); sfx(t); }, 650);
    }
  }

  // combine / oshi / sell buttons under the card
  let sellArm = false, sellTimer = 0;
  function drawActions(m, t) {
    vActs.innerHTML = '';
    const ti = tierIndex(t.id), n = countOf(m.id, ti);
    if (!n) return;
    const bonus = window.Shop ? Shop.tierBonus(ti) : 0;
    const add = (cls, html, fn, disabled) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-btn ' + cls; b.innerHTML = html; b.disabled = !!disabled;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
      vActs.appendChild(b);
      return b;
    };
    if (bonus) vActs.insertAdjacentHTML('beforeend', `<span class="cv-bonus">+${bonus}% score</span>`);
    if (ti < TIERS.length - 1) {
      const ok = canCombine(m.id, ti);
      add('gold', ok ? `COMBINE ${combineNeed(ti)} → ${TIERS[ti + 1].id}` : `COMBINE ${Math.min(n, combineNeed(ti))}/${combineNeed(ti)}`, () => {
        const next = tierIndex(t.id) + 1;
        vActs.innerHTML = '';
        playCombine(m, ti, () => {
          const d = combine(m.id, ti);
          const fresh = d && d.isNew;
          openViewer(m, TIERS[next], { reveal: true, title: fresh ? 'NEW TIER!' : 'COMBINED!', isNew: fresh, n: d ? d.n : 1 });
          refreshAll();
        });
      }, !ok);
    }
    if (window.Shop) {
      const isO = Shop.getOshi() === m.id;
      add(isO ? 'pink on' : 'pink', isO ? '♥ OSHI' : '♡ MAKE OSHI', () => { Shop.setOshi(isO ? null : m.id); snd('deal'); syncHeart(vWrap.querySelector('.tcard'), !isO); drawActions(m, t); refreshAll(); });
    }
    const spare = n - (ti === bestOf(m.id) ? 1 : 0);
    if (spare > 0) {
      const v = SELL_VALUE[ti];
      const sb = add('ghost', `SELL SPARE +${v * spare}`, (b) => {
        if (ti >= 2 && !sellArm) {
          sellArm = true; b.textContent = 'TAP AGAIN TO SELL';
          clearTimeout(sellTimer); sellTimer = setTimeout(() => { sellArm = false; drawActions(m, t); }, 2200);
          return;
        }
        sellArm = false; clearTimeout(sellTimer);
        const got = sellSpare(m.id, ti, spare);
        if (got) { snd('coin'); toast(`Sold for ${got} Points`); }
        openViewer(m, t, {});
        refreshAll();
      });
    }
  }
  function refreshAll() { renderProgress(); if (screenOpen()) { renderTabs(); renderRow(false); } window.dispatchEvent(new CustomEvent('cards:change')); }

  function closeViewer() {
    clearTimeout(revealTimer);
    if (!viewerOpen()) return;
    V.classList.remove('show');
    vWrap.innerHTML = '';
    if (screenOpen()) { renderTabs(); renderRow(false); renderProgress(); }
  }
  V.addEventListener('click', (e) => {
    if (e.target.closest('.cv-close')) closeViewer();                       // button already clicks
    else if (e.target === V || e.target.classList.contains('cv-stage')) { snd('close'); closeViewer(); }
  });

  // ---------- EARNING CARDS ----------
  // grade C/B/A/S sets the tier; a Full Combo bumps it up one (max SS)
  function tierFor(grade, fullCombo) {
    let i = Math.max(0, 'CBAS'.indexOf(grade));
    if (fullCombo) i = Math.min(TIERS.length - 1, i + 1);
    return TIERS[i];
  }

  function award(grade, fullCombo) {
    const t = tierFor(grade, fullCombo);
    const m = MEMBERS[Math.floor(Math.random() * MEMBERS.length)];
    return give(m.id, t.id);
  }

  // hand over one specific card (the future card shop calls this after Points.spend)
  function give(memberId, tierId) {
    const m = MEMBERS.find(x => x.id === memberId), t = TIERS.find(x => x.id === tierId);
    if (!m || !t) return null;
    const k = keyOf(m, t), prev = store[k];
    store[k] = { n: (prev ? prev.n : 0) + 1, fresh: prev ? !!prev.fresh : true };
    persist();
    if (!seen[k]) { seen[k] = 1; persistSeen(); }
    refreshBadge();
    return { m, t, isNew: !prev, n: store[k].n };
  }

  function reveal(drop, force) {
    if (!drop) return;
    const results = $('results');
    if (!force && !(results && results.classList.contains('show'))) return;  // player already left
    openViewer(drop.m, drop.t, { reveal: true, isNew: drop.isNew, n: drop.n });
  }

  // ---------- INVENTORY (used by the shop, lineup and combine) ----------
  const memberOf = (id) => MEMBERS.find(x => x.id === id);
  const tierIndex = (tid) => TIERS.findIndex(t => t.id === tid);
  const countOf = (id, ti) => { const e = store[id + ':' + TIERS[ti].id]; return e ? e.n : 0; };
  function bestOf(id) { for (let i = TIERS.length - 1; i >= 0; i--) if (countOf(id, i) > 0) return i; return -1; }
  function removeCards(id, ti, n) {
    const k = id + ':' + TIERS[ti].id, e = store[k];
    if (!e || e.n < n) return false;
    e.n -= n;
    if (e.n <= 0) delete store[k];
    persist(); refreshBadge();
    return true;
  }
  const COMBINE_NEED = [2, 3, 4, 5];           // cards of the same member and tier needed: C->B 2, B->A 3, A->S 4, S->SS 5
  const combineNeed = (ti) => COMBINE_NEED[ti] || 2;
  const SELL_VALUE = [10, 20, 45, 90, 180];    // Points per spare card
  function canCombine(id, ti) { return ti >= 0 && ti < TIERS.length - 1 && countOf(id, ti) >= combineNeed(ti); }
  function combine(id, ti) {
    if (!canCombine(id, ti)) return null;
    removeCards(id, ti, combineNeed(ti));
    const d = give(id, TIERS[ti + 1].id);
    window.dispatchEvent(new CustomEvent('cards:change'));
    return d;
  }
  function sellSpare(id, ti, qty) {
    const spare = countOf(id, ti) - (ti === bestOf(id) ? 1 : 0);
    qty = Math.min(qty, spare);
    if (qty <= 0 || !removeCards(id, ti, qty)) return 0;
    const pts = SELL_VALUE[ti] * qty;
    if (window.Points) Points.add(pts);
    window.dispatchEvent(new CustomEvent('cards:change'));
    return pts;
  }
  const ownedIds = () => MEMBERS.filter(m => bestOf(m.id) >= 0).map(m => m.id);
  const canCombineAny = () => MEMBERS.some(m => TIERS.some((t, i) => canCombine(m.id, i)));

  // combine animation: the cards orbit faster and faster, get sucked into one glowing core, then BOOM.
  // The higher the new tier, the longer the build-up and the bigger the explosion.
  function playCombine(m, ti, done) {
    const T = ti + 1, n = combineNeed(ti), cols = BURST_COLORS[TIERS[T].id];
    const PARTY = ['#ffd23f', '#ff7ab3', '#7fe0ff', '#ffffff', '#c9a0ff', '#8dff9c'];
    const gather = [0, 1100, 1450, 1900, 2500][T];
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const ov = document.createElement('div');
    ov.className = 'cmb t' + T;
    ov.style.setProperty('--ca', cols[0]);
    ov.innerHTML = '<div class="cmb-rays"></div><div class="cmb-core"></div>' + (T >= 3 ? '<div class="cmb-pillar"></div>' : '') +
      '<div class="cmb-row"></div><div class="cmb-title"></div><div class="cmb-flash"></div><div class="cmb-fx"></div>';
    document.body.appendChild(ov);
    const q = (sel) => ov.querySelector(sel);
    const row = q('.cmb-row'), core = q('.cmb-core'), rays = q('.cmb-rays'), titleEl = q('.cmb-title'),
          fl = q('.cmb-flash'), fx = q('.cmb-fx'), pillar = q('.cmb-pillar');

    const wraps = [];
    for (let i = 0; i < n; i++) {
      const w = document.createElement('div');
      w.className = 'cmb-c';
      w.appendChild(makeCard(m, TIERS[ti], true));
      row.appendChild(w);
      wraps.push(w);
    }
    const rc = row.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
    ov.style.setProperty('--cx', cx + 'px');
    ov.style.setProperty('--cy', cy + 'px');
    const cw = wraps[0].offsetWidth || 120;
    const Rx = Math.min(cw * (1.0 + n * .12), window.innerWidth * .4), Ry = cw * .5;
    const sz = n >= 5 ? .78 : n >= 4 ? .86 : n === 3 ? .95 : 1;
    const spinTotal = Math.PI * 2 * (1.6 + T * 1.1);
    let hit = false;

    snd('mergeCharge', gather / 1000, T);

    function spark() {
      const el = document.createElement('i');
      const ang = Math.random() * Math.PI * 2, d = cw * (1.2 + Math.random() * 1.6), s2 = 3 + Math.random() * 5;
      el.style.cssText = `left:${cx}px;top:${cy}px;width:${s2}px;height:${s2}px;background:${cols[Math.floor(Math.random() * cols.length)]};box-shadow:0 0 8px ${cols[0]}`;
      fx.appendChild(el);
      el.animate([
        { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(1)`, opacity: 0 },
        { opacity: 1, offset: .25 },
        { transform: 'translate(0,0) scale(.2)', opacity: 0 },
      ], { duration: 380 + Math.random() * 220, easing: 'ease-in' }).onfinish = () => el.remove();
    }

    const t0 = performance.now();
    const sparkTimer = setInterval(() => {
      if (!ov.isConnected || hit) { clearInterval(sparkTimer); return; }
      const k = clamp((performance.now() - t0) / gather);
      const cnt = 1 + Math.round(k * (2 + T));
      for (let i = 0; i < cnt; i++) spark();
      try { if (navigator.vibrate && k > .5) navigator.vibrate(8); } catch (e) { /* no haptics */ }
    }, 75);

    function frame(now) {
      if (!ov.isConnected || hit) return;
      const k = clamp((now - t0) / gather);
      const spin = spinTotal * Math.pow(k, 2.1);
      const s2 = clamp((k - .6) / .4), pull = s2 * s2 * s2;
      const breathe = 1 + Math.sin(k * 26) * .04 * (1 - s2);
      wraps.forEach((w, i) => {
        const a = spin + i * Math.PI * 2 / n;
        const depth = (Math.sin(a) + 1) / 2;
        const r = (1 - pull * .985) * breathe;
        const x = Math.cos(a) * Rx * r + (Math.random() - .5) * k * k * 5;
        const y = Math.sin(a) * Ry * r + (Math.random() - .5) * k * k * 5;
        const sc = sz * (.82 + depth * .22) * (1 - pull * .3);
        const rot = Math.cos(a) * 9 * (1 - pull) + Math.sin(k * 40 + i) * k * 3;
        w.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        w.style.zIndex = Math.round(depth * 10);
        w.style.filter = `brightness(${(1 + k * k * 1.6).toFixed(2)}) drop-shadow(0 0 ${(k * 26).toFixed(0)}px ${cols[0]})`;
      });
      core.style.opacity = (.15 + .85 * k).toFixed(2);
      core.style.transform = `translate(-50%,-50%) scale(${(.25 + k * k * (1.3 + T * .45)).toFixed(2)})`;
      rays.style.opacity = (k * .9).toFixed(2);
      rays.style.transform = `rotate(${((now - t0) * .06 * (1 + k * 3)).toFixed(1)}deg)`;
      const amp = k * k * k * (1.5 + T * 1.6);
      ov.style.transform = `translate(${((Math.random() - .5) * amp).toFixed(1)}px,${((Math.random() - .5) * amp).toFixed(1)}px)`;
      if (k >= 1) { impact(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function impact() {
      hit = true;
      clearInterval(sparkTimer);
      ov.style.transform = '';
      row.innerHTML = '';
      rays.style.opacity = 1;
      rays.style.animation = `pk-spin ${30 - T * 4}s linear infinite`;
      snd('mergeBoom', T);
      try { if (navigator.vibrate) navigator.vibrate([[0], [40, 20, 60], [50, 20, 80, 20, 60], [60, 20, 100, 20, 80, 20, 60], [80, 30, 140, 30, 100, 30, 80, 30, 200]][T]); } catch (e) { /* no haptics */ }

      const sh = [0, 6, 10, 16, 24][T];
      ov.animate([
        { transform: 'none' },
        { transform: `translate(${-sh}px,${sh * .5}px) rotate(${-sh * .03}deg)`, offset: .12 },
        { transform: `translate(${sh * .9}px,${-sh * .6}px) rotate(${sh * .03}deg)`, offset: .27 },
        { transform: `translate(${-sh * .6}px,${-sh * .4}px)`, offset: .45 },
        { transform: `translate(${sh * .4}px,${sh * .3}px)`, offset: .65 },
        { transform: 'none' },
      ], { duration: 380 + T * 130, easing: 'linear' });

      const flash = () => fl.animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 0 }], { duration: 600 + T * 150, easing: 'ease-out' });
      flash();
      if (T >= 4) setTimeout(flash, 230);

      core.animate([
        { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1 },
        { transform: `translate(-50%,-50%) scale(${5 + T * 2})`, opacity: 0 },
      ], { duration: 700 + T * 100, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
      rays.animate([{ filter: 'brightness(3)' }, { filter: 'brightness(1)' }], { duration: 800 });
      if (pillar) pillar.animate([
        { opacity: 1, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)', offset: .25 }, { opacity: 0, transform: 'scaleX(.1)' },
      ], { duration: 900 + T * 100, easing: 'ease-out', fill: 'forwards' });

      for (let i = 0; i < T; i++) {
        const r = document.createElement('i');
        r.className = 'cmb-ring';
        r.style.cssText = `left:${cx}px;top:${cy}px;border-color:${cols[i % cols.length]};color:${cols[0]}`;
        fx.appendChild(r);
        r.animate([
          { transform: 'translate(-50%,-50%) scale(.1)', opacity: 1 },
          { transform: `translate(-50%,-50%) scale(${2.6 + T * .5})`, opacity: 0 },
        ], { duration: 700 + i * 120, delay: i * 110, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' }).onfinish = () => r.remove();
      }

      const cnt = [0, 24, 40, 64, 100][T], pal = T >= 2 ? cols.concat(PARTY) : cols;
      for (let i = 0; i < cnt; i++) {
        const el = document.createElement('i');
        const s2 = 5 + Math.random() * 8;
        el.style.cssText = `left:${cx}px;top:${cy}px;width:${s2.toFixed(1)}px;height:${(s2 * (1 + Math.random())).toFixed(1)}px;background:${pal[i % pal.length]};border-radius:${Math.random() < .5 ? '50%' : '2px'};box-shadow:0 0 8px ${pal[i % pal.length]}`;
        fx.appendChild(el);
        const ang = Math.random() * Math.PI * 2, sp = (160 + Math.random() * 340) * (.8 + T * .25);
        const dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp - 80, fall = 160 + Math.random() * 320, rot = (Math.random() - .5) * 900;
        el.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${rot * .5}deg)`, opacity: 1, offset: .45 },
          { transform: `translate(${dx * 1.12}px,${dy + fall}px) rotate(${rot}deg)`, opacity: 0 },
        ], { duration: 900 + Math.random() * 900, easing: 'cubic-bezier(.2,.65,.4,1)', fill: 'forwards' }).onfinish = () => el.remove();
      }

      titleEl.innerHTML = `<span>${TIERS[ti].id} → ${TIERS[T].id}</span><small>${TIERS[T].name}</small>`;
      ov.classList.add('hit');

      const doneAt = 450 + T * 120;
      setTimeout(done, doneAt);
      setTimeout(() => { ov.classList.add('out'); setTimeout(() => ov.remove(), 280); }, doneAt + 620);
    }
  }

  // ---------- WIRING ----------
  openBtn.addEventListener('click', showScreen);
  $('cards-back-btn').addEventListener('click', () => {
    hideScreen();
    if (typeof showSongSelect === 'function') showSongSelect();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (viewerOpen()) { e.preventDefault(); closeViewer(); }
    else if (screenOpen()) { e.preventDefault(); $('cards-back-btn').click(); }
  });

  window.addEventListener('points:change', () => { if (screenOpen()) renderProgress(); });
  refreshBadge();

  window.Cards = {
    showScreen, hideScreen, award, give, reveal, tierFor,
    makeCard, enableTilt, TIERS, MEMBERS, TEAMS,
    count: countOf, best: bestOf, remove: removeCards, canCombine, combine, sellSpare, ownedIds, canCombineAny, memberOf, tierIndex, openViewer, COMBINE_NEED, combineNeed, SELL_VALUE,
    refresh() { if (screenOpen()) { renderTabs(); renderRow(false); renderProgress(); } },
    // console helpers:  Cards.debugDrop('S', true)  /  Cards.reset()
    debugDrop(grade = 'S', fullCombo = false) { reveal(award(grade, fullCombo), true); },
    reset() { store = {}; persist(); refreshBadge(); if (screenOpen()) renderAll(true); },
  };
})();