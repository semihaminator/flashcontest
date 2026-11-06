(() => {
  const $ = (s) => document.querySelector(s);
  const LANGS = Object.keys(I18N);
  let lang = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    let saved = null; try { saved = localStorage.getItem('lang'); } catch {}
    const nav = (navigator.language || '').slice(0, 2);
    return [q, saved, nav === 'uk' ? 'ua' : nav].find((l) => LANGS.includes(l)) || 'ru';
  })();
  let data = null, error = false;
  const t = (k) => I18N[lang][k];
  const fmt = (n) => Number(n).toLocaleString(t('_locale'));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function applyLang() {
    document.documentElement.lang = lang === 'ua' ? 'uk' : lang;
    document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = t(el.dataset.i); });
    document.querySelectorAll('[data-i-ph]').forEach((el) => { el.placeholder = t(el.dataset.iPh); });
    document.querySelectorAll('[data-place]').forEach((el) => { el.textContent = t('place')(+el.dataset.place); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    $('#ruleTotal').textContent = fmt(500000);
    tick(); render();
  }
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; try { localStorage.setItem('lang', lang); } catch {}
    applyLang();
  }));

  // ---------- countdown ----------
  const start = new Date(CONTEST.start).getTime(), end = new Date(CONTEST.end).getTime();
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const now = Date.now(), box = $('.countdown');
    const target = now < start ? start : end;
    if (now >= end) { box.classList.add('done'); $('#cdLabel').textContent = `${t('finished')} · ${t('tlPayout')} ${t('tlPayoutDate')}`; return; }
    $('#cdLabel').textContent = now < start ? t('toStart') : t('toEnd');
    let s = Math.max(0, Math.floor((target - now) / 1000));
    $('#cdD').textContent = pad(Math.floor(s / 86400)); s %= 86400;
    $('#cdH').textContent = pad(Math.floor(s / 3600)); s %= 3600;
    $('#cdM').textContent = pad(Math.floor(s / 60));
    $('#cdS').textContent = pad(s % 60);
  }
  setInterval(tick, 1000);

  // ---------- leaderboard ----------
  const PRIZE = { 1: '$750', 2: '$450', 3: '$300' };
  function metric(cls, label, val, goal, display) {
    const pct = Math.min(100, (val / goal) * 100);
    return `<div class="metric ${cls}${val >= goal ? ' ok' : ''}"><span class="lbl">${label}</span>
      <b>${display}</b><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }
  function render() {
    const box = $('#rows');
    if (error) { box.innerHTML = `<div class="empty">${t('error')}</div>`; return; }
    if (!data) return;
    $('#updated').textContent = data.updatedAt
      ? `${t('updated')}: ${new Date(data.updatedAt).toLocaleString(t('_locale'), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : '';
    const q = $('#search').value.trim().toLowerCase();
    const R = data.rules;
    const rows = data.rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    if (!data.rows.length) { box.innerHTML = `<div class="empty"><img src="/img/icon-bolt.webp" alt="">${t('empty')}</div>`; return; }
    if (!rows.length) { box.innerHTML = `<div class="empty">${t('noMatch')}</div>`; return; }
    box.innerHTML = rows.map((r) => {
      const top = r.place && r.place <= 3;
      const rank = r.place ?? '—';
      return `<div class="tr${top ? ` top p-${r.place}` : ''}" role="row">
        <span class="rank${r.place ? '' : ' none'}">${rank}</span>
        <div class="ag"><span class="rank-m">${rank}</span><div>
          <div class="ag-name">${esc(r.name || '—')}</div>
          <div class="ag-id">ID ${esc(r.id || '—')}</div>
          ${top ? `<span class="ag-prize">${PRIZE[r.place]}</span>` : ''}
        </div></div>
        ${metric('m1', t('colStreamers'), r.streamers, R.minStreamers, `${fmt(r.streamers)}<small>/ ${R.minStreamers}</small>`)}
        ${metric('m2', t('colTotal'), r.total, R.minTotal, fmt(r.total))}
        ${metric('m3', t('colActive'), r.active, R.minActive, `${fmt(r.active)}<small>/ ${R.minActive}</small>`)}
        <span class="chip ${r.qualified ? 'yes' : 'no'}">${r.qualified ? t('qualified') : t('notQualified')}</span>
      </div>`;
    }).join('');
  }
  $('#search').addEventListener('input', render);

  async function load() {
    try {
      const r = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json(); error = false;
    } catch { error = !data; }
    render();
  }
  load(); setInterval(load, 60000);

  // ---------- reveal on scroll ----------
  const els = document.querySelectorAll('.sec-head, .prize, .rule-grid li, .timeline, .table');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    els.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  applyLang();
})();
