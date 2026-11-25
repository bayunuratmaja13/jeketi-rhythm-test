(() => {
  'use strict';

  const STARTER_KEY = 'jeketi.starterClaimed';
  const OSHI_GIFT_KEY = 'jeketi.oshiGifted';

  const PACKS = {
    starter: {
      name: 'Starter Pack', count: 5, price: 0,
      odds: { C: 1 },
      p1: '#ff7ab3', p2: '#9c1f5a', accent: '#ffd23f', emblem: '★',
      greeting: '<span class="pk-welcome">Welcome to</span>' +
      '<img class="pk-logo" src="images/title.gif" alt="JEKETI RHYTHM" draggable="false" onerror="this.replaceWith(document.createTextNode(\'JEKETI RHYTHM\'))">', sub: 'Here is a free Starter Pack, just for you',
    },
    daily: {
      name: 'Daily Pack', count: 5, price: 0, minBest: 'B',
      odds: { C: 70, B: 24, A: 6 },
      p1: '#6fd68a', p2: '#1d6b45', accent: '#e8ffb0', emblem: '☀', sub: 'Your free pack for today',
    },
    standard: {
      name: 'Standard Pack', count: 5, price: 1000, minBest: 'B',
      odds: { C: 70, B: 24, A: 6 },
      p1: '#6cb8ff', p2: '#1d4a9c', accent: '#d8f0ff', emblem: '★', sub: 'At least one B or better',
    },
    premium: {
      name: 'Premium Pack', count: 5, price: 2400, minBest: 'A',
      odds: { C: 35, B: 45, A: 20 },
      p1: '#ffd54a', p2: '#9a5b00', accent: '#fff6c2', emblem: '♛', sub: 'At least one A guaranteed',
    },
    oshi: {
      name: 'Oshi Pack', count: 5, price: 1600, minBest: 'B', oshi: 0.5,
      odds: { C: 70, B: 24, A: 6 },
      p1: '#ff7ab3', p2: '#9c1f5a', accent: '#ffe0f0', emblem: '♥', sub: 'Boosted chance of your oshi',
    },
  };

  const BURST = {
    C: ['#e0a56b', '#f6c897'], B: ['#dfe6ef', '#ffffff'], A: ['#ffd54a', '#fff0a0'],
    S: ['#ffd23f', '#fffbd2', '#ffb300'], SS: ['#ffe680', '#ff9fd0', '#7fe0ff', '#ffffff', '#c9a0ff'],
  };

  const snd = (name, ...a) => { try { window.SFX && SFX[name](...a); } catch (e) {  } };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const claimed = () => { try { return localStorage.getItem(STARTER_KEY) === '1'; } catch (e) { return false; } };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function roll(pack, packId) {
    const { TIERS, MEMBERS } = Cards;
    const members = shuffle(MEMBERS.slice()).slice(0, pack.count);
    const entries = Object.entries(pack.odds);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    const picks = members.map(m => {
      let r = Math.random() * total, id = entries[0][0];
      for (const [tid, w] of entries) { if ((r -= w) < 0) { id = tid; break; } }
      return { m, t: TIERS.find(x => x.id === id) };
    });
    const oshi = window.Shop ? Shop.getOshi() : null;
    if (pack.oshi && oshi) {
      picks.forEach(p => { if (Math.random() < pack.oshi && !picks.some(q => q.m.id === oshi)) p.m = MEMBERS.find(x => x.id === oshi); });
    }
    const idx = (id) => TIERS.findIndex(x => x.id === id);
    const need = (window.Shop && packId !== 'starter' && Shop.pityA()) ? 'A' : pack.minBest;
    if (need && !picks.some(p => idx(p.t.id) >= idx(need))) {
      const p = picks[Math.floor(Math.random() * picks.length)];
      p.t = TIERS[idx(need)];
    }
    picks.sort((a, b) => TIERS.indexOf(a.t) - TIERS.indexOf(b.t));
    return picks.map(p => Cards.give(p.m.id, p.t.id));
  }

  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {  } };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeIn = (k) => k * k;
  const easeOutBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const PARTY = ['#ffd23f', '#ff7ab3', '#7fe0ff', '#ffffff', '#c9a0ff', '#8dff9c'];

  function clipShapes() {
    const N = 24, M = 40, tear = [], topEdge = [], bottomEdge = [];
    for (let i = 0; i <= N; i++) tear.push([i / N * 100, 15 + (i % 2 ? 1.8 : -1.4) + (Math.random() - .5) * 2]);
    for (let i = 0; i <= M; i++) { topEdge.push([i / M * 100, i % 2 ? 1.6 : 0]); bottomEdge.push([i / M * 100, i % 2 ? 98.4 : 100]); }
    const poly = (pts) => 'polygon(' + pts.map(p => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`).join(',') + ')';
    const up = tear.map(([x, y]) => [x, y - 1.4]), down = tear.map(([x, y]) => [x, y + 1.4]);
    return {
      top: poly(topEdge.concat(tear.slice().reverse())),
      body: poly(tear.concat(bottomEdge.slice().reverse())),
      frayBelow: poly(tear.concat(down.slice().reverse())),
      frayAbove: poly(up.concat(tear.slice().reverse())),
    };
  }

  let busy = false;

  function open(id = 'starter') {
    const pack = PACKS[id];
    if (!pack || busy || !window.Cards) return null;
    busy = true;
    if (typeof stopPreview === 'function') stopPreview();

    const drops = roll(pack, id);
    if (window.Shop && id !== 'starter') Shop.noteResult(drops.some(d => d.t.id === 'A' || d.t.id === 'S' || d.t.id === 'SS'));
    if (id === 'starter') { try { localStorage.setItem(STARTER_KEY, '1'); } catch (e) {  } }
    const n = drops.length;

    const art =
      '<div class="pk-art">' +
        '<div class="pk-brand">JEKETI RHYTHM</div>' +
        `<div class="pk-center"><div class="pk-emblem">${pack.emblem}</div><div class="pk-name">${pack.name}</div><div class="pk-count">${n} cards</div></div>` +
        '<div class="pk-foot">BOOSTER PACK</div>' +
        '<i class="pk-puff"></i><i class="pk-wrinkle"></i><i class="pk-holo"></i><i class="pk-foil"></i>' +
        '<i class="pk-crimp"></i><i class="pk-crimp b"></i>' +
      '</div>';

    const ov = document.createElement('div');
    ov.id = 'pack-overlay';
    ov.dataset.phase = 'idle';
    ov.style.setProperty('--p1', pack.p1);
    ov.style.setProperty('--p2', pack.p2);
    ov.style.setProperty('--accent', pack.accent);
    ov.innerHTML =
      '<div class="pk-rays"></div>' +
      '<button class="pk-skip" type="button">Skip</button>' +
      `<div class="pk-head"><h2>${pack.greeting || pack.name}</h2><p>${pack.sub || ''}</p></div>` +
      '<div class="pk-stage">' +
        '<div class="pk-grid"><i class="pk-aura"></i>' +
          `<div class="pk-pack" role="button" tabindex="0" aria-label="Rip open ${pack.name}">` +
            `<div class="pk-body">${art}</div>` +
            '<div class="pk-fray"><i></i></div><i class="pk-leak"></i><i class="pk-spark"></i>' +
            `<div class="pk-flap r"><div class="pk-part">${art}<i class="pk-fray-u"></i><i class="pk-bend"></i></div></div>` +
            `<div class="pk-flap l"><div class="pk-part">${art}<i class="pk-fray-u"></i><i class="pk-bend"></i></div></div>` +
            '<div class="pk-guide"><i></i></div>' +
          '</div>' +
          '<i class="pk-light"></i><i class="pk-beam"></i>' +
          '<div class="pk-deck"></div></div>' +
        '<div class="pk-info"></div>' +
        '<div class="pk-hint">Swipe across the pack to rip it open!</div>' +
        '<button class="pk-done" type="button">Collect</button>' +
      '</div>' +
      `<div class="pk-row">${'<div class="pk-slot"></div>'.repeat(n)}</div>` +
      '<div class="pk-flash"></div><div class="cv-burst"></div><div class="pk-fx"></div>';
    document.body.appendChild(ov);

    const $ = (s) => ov.querySelector(s);
    const packEl = $('.pk-pack'), deckEl = $('.pk-deck'), infoEl = $('.pk-info'), hintEl = $('.pk-hint'),
          headTitle = $('.pk-head h2'), headSub = $('.pk-head p'), burstEl = $('.cv-burst'), fx = $('.pk-fx'),
          flashEl = $('.pk-flash'), auraEl = $('.pk-aura'), stageEl = $('.pk-stage'), rowEl = $('.pk-row');
    const slots = Array.from(ov.querySelectorAll('.pk-slot'));
    const shapes = clipShapes();
    ov.querySelectorAll('.pk-part').forEach(el => { el.style.clipPath = shapes.top; });
    $('.pk-body').style.clipPath = shapes.body;
    $('.pk-fray i').style.clipPath = shapes.frayBelow;
    ov.querySelectorAll('.pk-fray-u').forEach(el => { el.style.clipPath = shapes.frayAbove; });
    Cards.enableTilt(ov);

    let phase = 'idle', idx = 0, closed = false, p = 0, lastStep = 0, drag = null;
    const cards = [];
    const setPhase = (v) => { phase = v; ov.dataset.phase = v; };
    const tierIdx = (d) => Cards.TIERS.indexOf(d.t);

    setTimeout(() => snd('thump'), 520);

    function confetti(x, y, count, colors, power = 1, up = false) {
      for (let i = 0; i < count; i++) {
        const el = document.createElement('i');
        el.className = 'pk-conf';
        const w = 5 + Math.random() * 7;
        el.style.cssText = `left:${x}px;top:${y}px;width:${w.toFixed(1)}px;height:${(w * (1 + Math.random())).toFixed(1)}px;background:${colors[i % colors.length]}`;
        fx.appendChild(el);
        const ang = up ? -Math.PI * (.1 + Math.random() * .8) : Math.random() * Math.PI * 2;
        const sp = (90 + Math.random() * 280) * power;
        const dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp * (up ? 1.7 : 1) - (up ? 0 : 110 * power);
        const fall = 220 + Math.random() * 340, rot = (Math.random() - .5) * 1000;
        const a = el.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${rot * .5}deg)`, opacity: 1, offset: .42 },
          { transform: `translate(${dx * 1.15}px,${dy + fall}px) rotate(${rot}deg)`, opacity: 0 },
        ], { duration: 950 + Math.random() * 750, easing: 'cubic-bezier(.2,.65,.4,1)', fill: 'forwards' });
        a.onfinish = () => el.remove();
      }
    }
    function ring(x, y, color) {
      const el = document.createElement('i');
      el.className = 'pk-ring';
      el.style.cssText = `left:${x}px;top:${y}px;border-color:${color}`;
      fx.appendChild(el);
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.1)', opacity: .95 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
      ], { duration: 680, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => el.remove();
    }
    function quake(big) {
      [stageEl, rowEl].forEach(el => {
        el.classList.remove('quake', 'quake-big');
        void el.offsetWidth;
        el.classList.add(big ? 'quake-big' : 'quake');
        setTimeout(() => el.classList.remove('quake', 'quake-big'), 600);
      });
    }
    function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }

    function burst(c, t) {
      const r = c.getBoundingClientRect();
      burstEl.style.left = (r.left + r.width / 2) + 'px';
      burstEl.style.top = (r.top + r.height / 2) + 'px';
      burstEl.innerHTML = '';
      const cols = BURST[t.id], k = { C: 8, B: 9, A: 12, S: 16, SS: 22 }[t.id];
      for (let i = 0; i < k; i++) {
        const q = document.createElement('i');
        q.style.setProperty('--a', (Math.PI * 2 * i / k + Math.random() * .4) + 'rad');
        q.style.setProperty('--d', (r.width * (.7 + Math.random() * .8)).toFixed(0) + 'px');
        q.style.setProperty('--c', cols[i % cols.length]);
        burstEl.appendChild(q);
      }
      setTimeout(() => { burstEl.innerHTML = ''; }, 1100);
    }

    function tween(from, to, dur, ease, fn) {
      return new Promise(res => {
        const t0 = performance.now();
        const step = (now) => {
          if (closed) return res();
          const k = Math.min(1, (now - t0) / dur);
          fn(from + (to - from) * ease(k));
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }

    function applyP(v, tilt = 0) {
      p = v;
      packEl.style.setProperty('--p', v.toFixed(4));
      ov.style.setProperty('--tp', v.toFixed(3));
      const j = v * v * 5;
      packEl.style.setProperty('--jx', ((Math.random() - .5) * j).toFixed(1) + 'px');
      packEl.style.setProperty('--jy', ((Math.random() - .5) * j).toFixed(1) + 'px');
      packEl.style.setProperty('--rot', tilt.toFixed(2) + 'deg');
      while (v - lastStep >= .04) {
        lastStep += .04;
        snd('tear', lastStep);
        buzz(5);
        const r = packEl.getBoundingClientRect();
        if (Math.round(lastStep / .04) % 2 === 0) confetti(r.left + lastStep * r.width, r.top + r.height * .15, 1, [pack.accent, '#ffffff'], .3);
      }
      if (v < lastStep - .08) lastStep = Math.floor(v / .04) * .04;
    }

    async function springBack() {
      setPhase('snapping');
      const from = p;
      await tween(from, 0, 300, easeOutBack, (v) => applyP(Math.max(0, v)));
      applyP(0);
      packEl.classList.remove('grab');
      auraEl.classList.remove('charging');
      lastStep = 0;
      setPhase('idle');
    }

    async function finishTear(auto) {
      setPhase('opening');
      hintEl.textContent = '';
      packEl.classList.add('grab');
      auraEl.classList.add('charging');
      const from = p;
      if (auto) { snd('shake', 1); await wait(90); }
      await tween(from, 1, auto ? 460 : Math.max(120, (1 - from) * 420), easeIn, (v) => applyP(v, 4 * v));
      applyP(1);
      completeRip();
    }

    async function completeRip() {
      packEl.classList.remove('grab');
      packEl.classList.add('torn');
      ov.classList.add('open');
      snd('rip');
      buzz([25, 30, 90]);
      flash();
      quake(true);
      const r = packEl.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height * .15, 20, PARTY.concat([pack.accent]), 1.2);
      ring(r.left + r.width / 2, r.top + r.height * .15, pack.accent);
      await wait(230);
      snd('whoosh');
      drops.forEach((d, i) => {
        const c = Cards.makeCard(d.m, d.t, true);
        c.classList.add('pk-deckcard', 'flipped', 'emerge');
        c.style.setProperty('--k', i);
        c.style.zIndex = n - i;
        deckEl.appendChild(c);
        cards.push(c);
      });
      await wait(820);
      packEl.style.display = 'none';
      setPhase('ready');
      hintEl.textContent = 'Tap to reveal your first card';
    }

    packEl.addEventListener('pointerdown', (e) => {
      if (phase !== 'idle') return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: 0, w: packEl.getBoundingClientRect().width };
      try { packEl.setPointerCapture(e.pointerId); } catch (err) {  }
      packEl.classList.add('grab');
      auraEl.classList.add('charging');
      hintEl.textContent = 'Keep going!';
      snd('shake', 0);
    });
    packEl.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || phase !== 'idle') return;
      const dx = e.clientX - drag.x0;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(e.clientY - drag.y0));
      const v = clamp01(dx / (drag.w * .82));
      applyP(v, Math.max(-3, Math.min(8, dx / drag.w * 6)));
      if (v >= 1) { drag = null; finishTear(false); }
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = drag.moved < 10 && performance.now() - drag.t0 < 450;
      drag = null;
      if (phase !== 'idle') return;
      if (tap) finishTear(true);
      else if (p >= .5) finishTear(false);
      else { hintEl.textContent = 'Swipe across the pack to rip it open!'; springBack(); }
    };
    packEl.addEventListener('pointerup', release);
    packEl.addEventListener('pointercancel', release);

    function celebrate(c, d, last) {
      const r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ti = tierIdx(d), cols = BURST[d.t.id].concat(PARTY.slice(0, 3));
      burst(c, d.t);
      ring(cx, cy, BURST[d.t.id][0]);
      confetti(cx, cy, 8 + ti * 5 + idx * 2, cols, 1 + ti * .25 + idx * .1);
      snd('pull', idx, ti);
      buzz(ti >= 3 ? [20, 20, 60] : 14 + idx * 5);
      quake(ti >= 3 || last);
      if (d.isNew) setTimeout(() => snd('slam'), 150);
      if (last) { flash(); confetti(cx, cy, 14, PARTY, 1.4); }
    }

    async function revealTop() {
      const d = drops[idx], c = cards[idx], last = idx === n - 1;
      setPhase('revealing');
      hintEl.textContent = '';
      c.classList.add('lift');
      await wait(170);
      c.classList.remove('flipped');
      snd('flip');
      await wait(330);
      celebrate(c, d, last);
      infoEl.innerHTML = `<b>${d.m.name}</b><span>Team ${d.m.team}</span>` +
        (d.isNew ? '<em>NEW</em>' : `<em class="dup">×${d.n}</em>`);
      await wait(260);
      setPhase('revealed');
      hintEl.textContent = 'Tap to keep it';
    }

    function sendCard() {
      const c = cards[idx], slot = slots[idx];
      infoEl.innerHTML = '';
      const first = c.getBoundingClientRect();
      c.classList.remove('pk-deckcard', 'lift');
      c.style.zIndex = '';
      slot.appendChild(c);
      const last = c.getBoundingClientRect();
      c.style.transformOrigin = '0 0';
      c.style.transition = 'none';
      c.style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})`;
      void c.offsetWidth;
      c.style.transition = 'transform .55s cubic-bezier(.3, 1.2, .4, 1)';
      c.style.transform = 'none';
      snd('deal');
      idx++;
      cards.slice(idx).forEach((cc, j) => cc.style.setProperty('--k', j));
    }

    async function sendTop() {
      setPhase('flying');
      hintEl.textContent = '';
      sendCard();
      await wait(620);
      if (idx < n) { setPhase('ready'); hintEl.textContent = 'Tap to reveal the next card'; }
      else finish();
    }

    async function skipAll() {
      if (phase !== 'ready' && phase !== 'revealed') return;
      setPhase('flying');
      hintEl.textContent = '';
      while (idx < n) {
        const c = cards[idx];
        if (c.classList.contains('flipped')) { c.classList.remove('flipped'); snd('flip'); await wait(260); }
        sendCard();
        await wait(170);
      }
      await wait(450);
      finish();
    }

    function finish() {
      setPhase('done');
      headTitle.textContent = 'Added to My Cards!';
      headSub.textContent = '';
      snd('fanfare');
      flash();
      quake(true);
      buzz([30, 40, 30, 40, 100]);
      const W = window.innerWidth, H = window.innerHeight;
      [0, 180, 360].forEach((d, k) => setTimeout(() => {
        if (closed) return;
        confetti(W * .08, H, 12, PARTY.concat([pack.accent]), 1.9, true);
        confetti(W * .92, H, 12, PARTY.concat([pack.accent]), 1.9, true);
        snd('pop');
        buzz(12);
      }, d + 120));
    }

    function close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey, true);
      ov.classList.add('out');
      setTimeout(() => ov.remove(), 320);
      busy = false;
      if (id === 'starter' && typeof setPreviewHold === 'function') setPreviewHold(false);
      const b = document.getElementById('my-cards-btn');
      if (b) { b.classList.add('attn'); setTimeout(() => b.classList.remove('attn'), 5200); }
      window.dispatchEvent(new CustomEvent('packs:closed', { detail: { pack: id, drops } }));
    }

    function advance() {
      if (phase === 'ready') revealTop();
      else if (phase === 'revealed') sendTop();
    }

    function onKey(e) {
      if (!ov.isConnected || !['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        if (phase === 'done') close();
        else if (phase === 'idle') finishTear(true);
        else advance();
      }
    }
    window.addEventListener('keydown', onKey, true);

    ov.addEventListener('click', (e) => { if (!e.target.closest('button')) advance(); });
    $('.pk-skip').addEventListener('click', skipAll);
    $('.pk-done').addEventListener('click', close);

    return drops;
  }

  function giveOshiCard() {
    try {
      if (localStorage.getItem(OSHI_GIFT_KEY) === '1') return;
      const oshi = window.Shop && Shop.getOshi ? Shop.getOshi() : null;
      if (!oshi || !window.Cards) return;
      if (!Cards.give(oshi, 'C')) return;
      localStorage.setItem(OSHI_GIFT_KEY, '1');
      window.dispatchEvent(new CustomEvent('cards:change'));
    } catch (e) {  }
  }

  function onFirstPlay() {
    if (claimed()) return;
    setTimeout(() => {
      if (claimed()) return;
      if (window.Shop && !Shop.getOshi()) Shop.pickOshi(() => { giveOshiCard(); setTimeout(() => open('starter'), 350); });
      else { giveOshiCard(); open('starter'); }
    }, 500);
  }

  window.Packs = {
    PACKS, open, onFirstPlay, needsStarter: () => !claimed(),
    resetStarter() {
      try { localStorage.removeItem(STARTER_KEY); localStorage.removeItem(OSHI_GIFT_KEY); } catch (e) {  }
      if (window.Shop) Shop.setOshi(null);
    },
  };
})();