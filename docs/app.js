// 배포본(GitHub Pages)에서 도는 스크립트: 정렬·필터, 검색, 오래 수정 안 한 주제 표시, 논문 링크, 🔒 비밀글 열기
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const body = document.body;
  const base = body.dataset.base || '';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- 오래 수정하지 않은 주제 표시 (n일째 수정 없음) ----
  const staleDays = Number(body.dataset.stale) || 60;
  const now = Date.now();
  for (const el of $$('.upd[data-date]')) {
    const days = Math.floor((now - new Date(el.dataset.date + 'T00:00:00').getTime()) / 86400000);
    if (days > staleDays) { el.classList.add('stale'); el.textContent = `${days}일째 수정 없음`; }
  }

  // ---- 논문 링크: 로컬에서만 papers-wiki로 연결 ----
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  for (const a of $$('a.pw')) {
    if (local) { a.href = `${body.dataset.papers}/#${encodeURIComponent(a.dataset.note)}`; a.target = '_blank'; a.rel = 'noopener'; }
    else { const s = document.createElement('span'); s.className = 'pw'; s.title = 'papers-wiki 노트 (로컬에서만 열림)'; s.textContent = a.textContent; a.replaceWith(s); }
  }

  // ---- 관련 논문: 이 PC에서만 노트·원문 PDF 링크 (공개 사이트는 제목·저자·연도만) ----
  if (local) {
    $$('.papers-note').forEach(n => { n.textContent = '제목을 누르면 papers-wiki 노트가, "원문 PDF"를 누르면 PDF가 열려요.'; });
    for (const li of $$('li.paper')) {
      const t = $('.p-title', li);
      const a = document.createElement('a');
      a.className = 'p-title'; a.href = `${body.dataset.papers}/#${encodeURIComponent(li.dataset.note)}`; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = t.textContent; t.replaceWith(a);
      if (li.dataset.pdf) {
        const p = document.createElement('a');
        p.className = 'p-pdf'; p.href = `${body.dataset.papers}/pdf/${encodeURIComponent(li.dataset.pdf)}`; p.target = '_blank'; p.rel = 'noopener';
        p.textContent = '원문 PDF ↗'; li.appendChild(p);
      }
    }
  } else $$('.papers-note').forEach(n => n.remove());

  // ---- 홈: 필터·정렬 (URL 쿼리로 유지) ----
  const map = $('#map');
  if (map) {
    const params = new URLSearchParams(location.search);
    const sortSel = $('#sort');
    let filter = ['study', 'lecture'].includes(params.get('filter')) ? params.get('filter') : 'all';
    let sort = ['updated', 'count', 'title'].includes(params.get('sort')) ? params.get('sort') : 'updated';
    const apply = () => {
      const cards = $$('.topic', map);
      cards.sort((a, b) => sort === 'title' ? a.dataset.title.localeCompare(b.dataset.title, 'ko')
        : sort === 'count' ? (b.dataset.count - a.dataset.count) || a.dataset.title.localeCompare(b.dataset.title, 'ko')
        : (b.dataset.updated || '').localeCompare(a.dataset.updated || '') || a.dataset.title.localeCompare(b.dataset.title, 'ko'));
      cards.forEach(c => { map.appendChild(c); c.hidden = filter !== 'all' && Number(c.dataset[filter]) === 0; });
      $$('.fchip').forEach(b => b.classList.toggle('on', b.dataset.filter === filter));
      $$('.recent .item').forEach(i => { i.hidden = filter !== 'all' && i.dataset.section !== filter; });
      const courses = $('#courses'); if (courses) courses.hidden = filter !== 'lecture';
      sortSel.value = sort;
      const q = new URLSearchParams(); if (filter !== 'all') q.set('filter', filter); if (sort !== 'updated') q.set('sort', sort);
      history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
    };
    $$('.fchip').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; apply(); }));
    sortSel.addEventListener('change', () => { sort = sortSel.value; apply(); });
    apply();
  }

  // ---- 검색 ----
  const q = $('#q'), box = $('#results');
  let index = null;
  const norm = s => String(s || '').toLowerCase().normalize('NFC');
  async function load() { if (!index) index = await fetch(`${base}search.json`).then(r => r.json()); return index; }
  function show(html) { box.innerHTML = html; box.hidden = false; }
  q?.addEventListener('focus', load);
  q?.addEventListener('input', async () => {
    const term = norm(q.value.trim());
    if (!term) { box.hidden = true; return; }
    const idx = await load();
    const hit = o => [o.title, o.text, o.course, ...(o.tags || [])].some(v => norm(v).includes(term));
    const ts = idx.topics.filter(hit).slice(0, 8);
    const its = idx.items.filter(hit).slice(0, 15);
    const tTitle = Object.fromEntries(idx.topics.map(t => [t.id, t.title]));
    if (!ts.length && !its.length) return show('<div class="empty">일치하는 자료가 없습니다</div>');
    show((ts.length ? `<h4>주제</h4>${ts.map(t => `<a href="${base}t/${encodeURIComponent(t.id)}.html">🗂 ${esc(t.title)}${t.parent ? `<small>${esc(tTitle[t.parent] || '')} 아래</small>` : ''}</a>`).join('')}` : '') +
      (its.length ? `<h4>자료</h4>${its.map(i => `<a href="${base}i/${encodeURIComponent(i.id)}.html">${esc(i.title)}<small>${i.topics.map(id => esc(tTitle[id] || id)).join(' · ')}${i.course ? ' · ' + esc(i.course) : ''}</small></a>`).join('')}` : ''));
  });
  q?.addEventListener('keydown', e => {
    if (e.key === 'Escape') { box.hidden = true; q.blur(); }
    if (e.key === 'Enter') { const a = $('a', box); if (a) location.href = a.href; }
  });
  document.addEventListener('click', e => { if (box && !e.target.closest('.search')) box.hidden = true; });

  // ---- 🔒 비밀글 ----
  const form = $('#pin-form');
  if (form) {
    const KEY = 'studylog-pin';
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    async function unlock(pin) {
      const blob = await fetch(`${base}secret.json`, { cache: 'no-store' }).then(r => r.json());
      const enc = new TextEncoder();
      const k0 = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(blob.salt), iterations: blob.iter },
        k0, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    }
    async function open(pin, quiet) {
      const msg = $('#pin-msg');
      msg.textContent = quiet ? '' : '여는 중…';
      try {
        const data = await unlock(pin);
        sessionStorage.setItem(KEY, pin);
        $('#secret-lock').hidden = true;
        const sb = $('#secret-body');
        sb.innerHTML = `<p><button id="relock" class="btn">🔒 잠그기</button> <span class="muted">${data.count}개 열림 · 이 탭을 닫으면 다시 잠겨요</span></p>${data.html}`;
        sb.hidden = false;
        $('#relock').addEventListener('click', () => { sessionStorage.removeItem(KEY); location.reload(); });
      } catch (e) {
        sessionStorage.removeItem(KEY);
        msg.textContent = quiet ? '' : 'PIN이 맞지 않습니다';
      }
    }
    form.addEventListener('submit', e => { e.preventDefault(); open($('#pin').value); });
    const saved = sessionStorage.getItem(KEY);
    if (saved) open(saved, true);
  }
})();
