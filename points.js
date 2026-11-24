(() => {
  'use strict';

  const BASE = { C: 25, B: 50, A: 100, S: 300, SS: 500 };
  const FULL_COMBO_MULT = 1.5;
  const ALL_PERFECT_MULT = 2;

  const KEY = 'jeketi.points';
  const load = () => { try { return Math.max(0, parseInt(localStorage.getItem(KEY), 10) || 0); } catch (e) { return 0; } };
  const save = () => { try { localStorage.setItem(KEY, String(balance)); } catch (e) {  } };
  let balance = load();

  const fmt = (n) => Math.round(n).toLocaleString();
  const snd = (name, ...a) => { try { window.SFX && SFX[name](...a); } catch (e) {  } };

  const COIN = '<i class="pt-coin">P</i>';
  const chipHTML = () => `<span class="points-chip">${COIN}<b>${fmt(balance)}</b><small>Point</small></span>`;

  function refreshChips(bump) {
    document.querySelectorAll('.points-chip').forEach(chip => {
      const b = chip.querySelector('b');
      if (b) b.textContent = fmt(balance);
      if (bump) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
    });
  }
  function changed(delta) {
    refreshChips(delta > 0);
    window.dispatchEvent(new CustomEvent('points:change', { detail: { balance, delta } }));
  }

  function earnFor(grade, fullCombo, allPerfect) {
    let p = BASE[grade] || 0;
    if (allPerfect) p *= ALL_PERFECT_MULT;
    else if (fullCombo) p *= FULL_COMBO_MULT;
    return Math.round(p);
  }

  function add(n) {
    n = Math.floor(n);
    if (n > 0) { balance += n; save(); changed(n); }
    return balance;
  }

  function spend(n) {
    n = Math.floor(n);
    if (n <= 0 || n > balance) return false;
    balance -= n; save(); changed(-n);
    return true;
  }

  function showEarned(el, amount) {
    if (!el) return;
    el.className = 'points-earned';
    el.innerHTML = `${COIN}<b>+0</b><small>Point</small>`;
    void el.offsetWidth;
    el.classList.add('show');
    const b = el.querySelector('b');
    if (amount <= 0) return;
    const dur = Math.min(1400, 500 + amount * 2), t0 = performance.now();
    let ticks = 0;
    const step = (now) => {
      if (!el.classList.contains('show')) return;
      const k = Math.min(1, (now - t0) / dur);
      b.textContent = '+' + fmt(amount * (1 - Math.pow(1 - k, 3)));
      const tk = Math.floor(k * 14);
      if (tk > ticks) { ticks = tk; snd('tick', ticks); }
      if (k < 1) requestAnimationFrame(step);
      else { b.textContent = '+' + fmt(amount); el.classList.add('done'); snd('coin'); }
    };
    requestAnimationFrame(step);
  }
  function clearEarned(el) { if (el) { el.className = 'points-earned'; el.innerHTML = ''; } }

  const header = document.querySelector('#menu-screen .menu-header');
  if (header) header.insertAdjacentHTML('beforeend', chipHTML());

  window.Points = {
    get: () => balance, add, spend, earnFor, fmt, chipHTML, showEarned, clearEarned,
    BASE,
    reset() { balance = 0; save(); changed(0); },
  };
})();