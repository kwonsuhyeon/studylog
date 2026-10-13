// 등록 페이지 (로컬 전용). 서버 API: /api/*
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PARTS = ['한 줄 정의', '지금까지 정리한 것', '이어서 정리할 것'];
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  let S = { topics: [], items: [] };
  let cand = null, candSrc = 'github';

  async function api(method, url, body, raw) {
    const opt = { method, headers: { 'X-Studylog': '1' } };
    if (raw) { opt.body = raw; opt.headers['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.statusText); e.data = j; throw e; }
    return j;
  }
  let toastT;
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 2500);
  }
  function showBuild(b) {
    if (!b) return;
    const w = b.warnings || [];
    $('#build-status').innerHTML = `빌드: 주제 ${b.topics} · 자료 ${b.items}${b.secret ? ` · 🔒 ${b.secret}` : ''}${w.length ? ` · <span class="w">경고 ${w.length}개 (게시 탭에서 확인)</span>` : ' · 경고 없음'}`;
    $('#warn-list').innerHTML = w.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted" style="color:var(--muted)">없음</li>';
  }

  async function refresh() {
    S = await api('GET', '/api/state');
    showBuild(S.lastBuild);
    renderTopicPicks(); renderItems(); renderTopicTree(); renderCourses(); renderCands();
  }

  // ---------- 탭 ----------
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('on', x === b));
    for (const id of ['items', 'topics', 'publish']) $(`#tab-${id}`).hidden = id !== b.dataset.tab;
    if (b.dataset.tab === 'publish') gitStatus();
    location.hash = b.dataset.tab;
  }));
  const initTab = location.hash.slice(1);
  if (initTab) $(`.tab[data-tab="${initTab}"]`)?.click();

  // ---------- 주제 트리 공통 ----------
  const roots = () => S.topics.filter(t => !t.parent).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  const kidsOf = id => S.topics.filter(t => t.parent === id).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  const countOf = id => S.items.filter(i => i.topics.includes(id)).length;

  // ---------- 자료 폼 ----------
  const F = $('#item-form');
  function renderTopicPicks(selected = selectedTopics()) {
    const box = $('#topic-picks');
    const cb = t => `<label><input type="checkbox" value="${esc(t.id)}"${selected.includes(t.id) ? ' checked' : ''}> ${t.secret ? '🔒 ' : ''}${esc(t.title)}</label>`;
    box.innerHTML = roots().map(r => `<div class="grp">${cb(r)}</div>${kidsOf(r.id).length ? `<div class="grp kid">${kidsOf(r.id).map(cb).join('')}</div>` : ''}`).join('')
      || '<span class="muted">주제가 없어요 — "주제 관리" 탭에서 먼저 만드세요</span>';
  }
  const selectedTopics = () => $$('#topic-picks input:checked').map(i => i.value);
  function renderCourses() {
    $('#course-list').innerHTML = [...new Set(S.items.map(i => i.course).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('');
  }
  const syncSection = () => { $('.course-field').hidden = F.section.value !== 'lecture'; };
  $$('input[name=section]', F).forEach(r => r.addEventListener('change', syncSection));

  function fillItem(it) {
    F.reset();
    F.id.value = it?.id || ''; F.source.value = it?.source || '';
    F.title.value = it?.title || '';
    F.section.value = it?.section || 'study';
    F.kind.value = it?.kind || 'site';
    F.date.value = it?.date || today();
    F.course.value = it?.course || '';
    F.url.value = it?.url || '';
    F.body.value = (it?.body || '').trim();
    F.tags.value = (it?.tags || []).join(', ');
    F.public.checked = !!it?.public; F.secret.checked = !!it?.secret;
    renderTopicPicks(it?.topics || []);
    $('#item-form-title').textContent = it?.id ? `자료 수정 — ${it.id}` : '새 자료 등록';
    $('#file-note').textContent = '';
    syncSection();
  }
  $('#item-reset').addEventListener('click', () => fillItem(null));

  F.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      id: F.id.value || undefined, isNew: !F.id.value, title: F.title.value, section: F.section.value, kind: F.kind.value,
      date: F.date.value, course: F.course.value, topics: selectedTopics(), url: F.url.value, body: F.body.value,
      tags: F.tags.value, public: F.public.checked, secret: F.secret.checked, source: F.source.value,
    };
    try {
      const r = await api('POST', '/api/items', body);
      toast(`저장했어요 — ${r.id}`);
      showBuild(r.build);
      fillItem(null);
      await refresh();
    } catch (err) { toast(err.message, true); }
  });

  $('#upload').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#file-note').textContent = `올리는 중… ${f.name}`;
    try {
      const base = F.title.value || f.name.replace(/\.\w+$/, '');
      const r = await api('POST', `/api/upload?name=${encodeURIComponent(f.name)}&id=${encodeURIComponent(base)}`, undefined, f);
      F.url.value = r.url;
      if (/\.pdf$/i.test(f.name)) F.kind.value = 'pdf'; else F.kind.value = 'slide';
      if (!F.title.value) F.title.value = f.name.replace(/\.\w+$/, '');
      $('#file-note').textContent = `✔ ${r.url} (${Math.round(r.bytes / 1024)}KB) — 이미지 등 함께 쓰는 파일이 있으면 "로컬 폴더" 후보에서 고르세요`;
    } catch (err) { $('#file-note').textContent = ''; toast(err.message, true); }
    e.target.value = '';
  });

  // ---------- 자료 목록 ----------
  const tTitle = id => S.topics.find(t => t.id === id)?.title || id;
  function renderItems() {
    const q = $('#item-filter').value.trim().toLowerCase();
    const list = [...S.items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(i => !q || [i.title, ...i.topics.map(tTitle), i.course].some(v => String(v || '').toLowerCase().includes(q)));
    $('#item-count').textContent = `${S.items.length}개`;
    const err = new Set((S.errors || []).map(e => e.id));
    $('#item-list').innerHTML = list.map(i => `<tr class="${i.secret ? 'secret' : ''}" data-id="${esc(i.id)}">
      <td><a data-act="edit">${esc(i.title)}</a>${err.has(i.id) ? ' <span title="검증 오류" style="color:var(--warn)">⚠</span>' : ''}${i.public ? ' <span class="pub" style="font-size:.7rem;background:var(--accent);color:#fff;padding:0 5px;border-radius:4px">공개</span>' : ''}</td>
      <td>${i.section === 'lecture' ? '강의' : '공부'}</td><td>${i.topics.map(id => esc(tTitle(id))).join(', ')}</td><td>${esc(i.date || '')}</td>
      <td>${i.secret ? '' : `<a href="/i/${encodeURIComponent(i.id)}.html" target="_blank">보기</a> · `}<a data-act="del" style="color:#DC2626">삭제</a></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">아직 없어요 — 오른쪽 후보에서 골라 보세요</td></tr>';
  }
  $('#item-filter').addEventListener('input', renderItems);
  $('#item-list').addEventListener('click', async e => {
    const a = e.target.closest('a[data-act]'); if (!a) return;
    const id = a.closest('tr').dataset.id;
    const it = S.items.find(i => i.id === id);
    if (a.dataset.act === 'edit') { fillItem(it); F.scrollIntoView({ behavior: 'smooth' }); }
    if (a.dataset.act === 'del') {
      if (!confirm(`"${it.title}" 자료를 삭제할까요?\n(이 자료 전용으로 올린 파일도 함께 지워져요)`)) return;
      try { const r = await api('DELETE', `/api/items/${encodeURIComponent(id)}`); showBuild(r.build); toast('삭제했어요'); await refresh(); }
      catch (err) { toast(err.message, true); }
    }
  });

  // ---------- 등록 후보 ----------
  async function loadCands(force) {
    $('#cand-msg').textContent = force ? '다시 스캔하는 중… (로컬 폴더는 최대 15초)' : '불러오는 중…';
    try { cand = await api('GET', `/api/candidates${force ? '?force=1' : ''}`); }
    catch (err) { $('#cand-msg').textContent = err.message; return; }
    renderCands();
  }
  function renderCands() {
    if (!cand) return;
    const q = $('#cand-filter').value.trim().toLowerCase();
    const hide = $('#cand-hide-done').checked;
    const used = new Set(S.items.map(i => String(i.url || '').replace(/\/+$/, '')));
    const usedSrc = new Set(S.items.map(i => i.source).filter(Boolean));
    let list, msg = '';
    if (candSrc === 'github') {
      list = cand.github.map(c => ({ ...c, registered: used.has(c.url.replace(/\/+$/, '')) }));
      msg = cand.githubError ? `GitHub 오류: ${cand.githubError}` : `Pages 사이트 ${list.length}개`;
      list.sort((a, b) => a.excluded - b.excluded);
    } else {
      list = cand.local.files.map(c => ({ ...c, registered: usedSrc.has(c.rel) }));
      msg = cand.localError ? `스캔 오류: ${cand.localError}` : !cand.scanDirs?.length ? '설정(studylog.config.json)의 scanDirs가 비어 있어요'
        : `${cand.scanDirs.join(', ')} — html·pdf ${list.length}개${cand.local.truncated ? ' (일부만: 시간·개수 제한)' : ''}`;
    }
    const total = list.length;
    list = list.filter(c => (!hide || !c.registered) && (!q || [c.title, c.name, c.rel].some(v => String(v || '').toLowerCase().includes(q))));
    $('#cand-msg').textContent = `${msg}${hide ? ` · 미등록 ${list.length}/${total}` : ''}`;
    $('#cand-list').innerHTML = list.slice(0, 300).map(c => `<li class="${c.registered ? 'done' : ''} ${c.excluded ? 'excluded' : ''}" data-key="${esc(c.url || c.path)}">
      <span class="t">${c.kind === 'pdf' ? 'PDF · ' : c.kind === 'slide' ? 'HTML · ' : ''}${esc(c.title)}${c.registered ? ' · 등록됨' : ''}${c.excluded ? ' · 제외 후보' : ''}</span>
      <span class="s">${esc(c.url || c.rel)} · ${esc(c.date)}${c.size ? ` · ${Math.round(c.size / 1024)}KB` : ''}</span></li>`).join('') || '<li class="muted">없어요</li>';
    $('#cand-list')._data = list;
  }
  $$('.stab').forEach(b => b.addEventListener('click', () => { candSrc = b.dataset.src; $$('.stab').forEach(x => x.classList.toggle('on', x === b)); renderCands(); }));
  $('#cand-filter').addEventListener('input', renderCands);
  $('#cand-hide-done').addEventListener('change', renderCands);
  $('#cand-refresh').addEventListener('click', () => loadCands(true));
  $('#cand-list').addEventListener('click', async e => {
    const li = e.target.closest('li[data-key]'); if (!li) return;
    const c = $('#cand-list')._data.find(x => (x.url || x.path) === li.dataset.key);
    if (!c) return;
    if (c.registered && !confirm('이미 등록된 후보예요. 그래도 새로 등록할까요?')) return;
    fillItem(null);
    F.title.value = c.title; F.date.value = c.date || today(); F.kind.value = c.kind;
    if (c.source === 'github') {
      F.url.value = c.url; F.body.value = '';
      $('#file-note').textContent = `저장소: ${c.repo}`;
    } else {
      $('#file-note').textContent = '파일 가져오는 중…';
      try {
        const r = await api('POST', '/api/import-file', { path: c.path, id: c.title });
        F.url.value = r.url; F.source.value = r.source;
        $('#file-note').textContent = `✔ ${r.url}${r.files > 1 ? ` (함께 쓰는 파일 ${r.files - 1}개 포함)` : ''} · ${Math.round(r.bytes / 1024)}KB`;
      } catch (err) { $('#file-note').textContent = ''; toast(err.message, true); }
    }
    F.title.focus(); F.title.select();
    F.scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- 주제 관리 ----------
  const TF = $('#topic-form');
  let editingTopic = null;
  function renderTopicTree() {
    const li = (t, kid) => `<li class="${kid ? 'kid' : ''} ${editingTopic === t.id ? 'on' : ''}" data-id="${esc(t.id)}"><span><span class="dot" style="--c:${esc(t.color || 'var(--line)')}"></span>${t.secret ? '🔒 ' : ''}${esc(t.title)} <span class="n">${esc(t.id)}</span></span><span class="n">${countOf(t.id)}</span></li>`;
    $('#topic-tree').innerHTML = roots().map(r => li(r) + kidsOf(r.id).map(k => li(k, true)).join('')).join('') || '<li class="muted">없어요</li>';
    const sel = TF.parent; const cur = sel.value;
    sel.innerHTML = '<option value="">(없음 — 최상위)</option>' + roots().filter(r => r.id !== editingTopic).map(r => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('');
    sel.value = cur;
  }
  function sectionsOf(body) {
    const out = {}; let cur = '';
    for (const line of String(body || '').split(/\r?\n/)) {
      const h = line.match(/^##\s+(.+?)\s*$/);
      if (h) { cur = h[1]; out[cur] = []; continue; }
      if (cur) out[cur].push(line);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('\n').trim()]));
  }
  function fillTopic(t) {
    editingTopic = t?.id || null;
    TF.reset();
    renderTopicTree();
    TF.title.value = t?.title || ''; TF.id.value = t?.id || ''; TF.id.readOnly = !!t;
    TF.parent.value = t?.parent || '';
    TF.useColor.checked = !!t?.color; if (t?.color) TF.color.value = t.color;
    const p = sectionsOf(t?.body);
    TF.p0.value = p[PARTS[0]] || ''; TF.p1.value = p[PARTS[1]] || ''; TF.p2.value = p[PARTS[2]] || '';
    TF.secret.checked = !!t?.secret;
    $('#topic-form-title').textContent = t ? `주제 편집 — ${t.title}` : '새 주제';
    $('#topic-delete').hidden = !t;
  }
  $('#topic-tree').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    fillTopic(S.topics.find(t => t.id === li.dataset.id));
  });
  $('#topic-new').addEventListener('click', () => fillTopic(null));
  TF.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      id: TF.id.value.trim(), isNew: !editingTopic, title: TF.title.value, parent: TF.parent.value,
      color: TF.useColor.checked ? TF.color.value : '', secret: TF.secret.checked,
      parts: { [PARTS[0]]: TF.p0.value, [PARTS[1]]: TF.p1.value, [PARTS[2]]: TF.p2.value },
    };
    try {
      const r = await api('POST', '/api/topics', body);
      toast(`주제를 저장했어요 — ${r.id}`); showBuild(r.build);
      await refresh();
      fillTopic(S.topics.find(t => t.id === r.id));
    } catch (err) { toast(err.message, true); }
  });
  $('#topic-delete').addEventListener('click', async () => {
    if (!editingTopic || !confirm(`"${TF.title.value}" 주제를 삭제할까요?`)) return;
    try { const r = await api('DELETE', `/api/topics/${encodeURIComponent(editingTopic)}`); showBuild(r.build); toast('삭제했어요'); fillTopic(null); await refresh(); }
    catch (err) { toast(err.message, true); }
  });

  // ---------- 게시 ----------
  async function gitStatus() {
    try {
      const g = await api('GET', '/api/git/status');
      if (!g.isRepo) { $('#git-info').textContent = 'git 저장소가 아니에요'; $('#git-publish').disabled = true; return; }
      $('#git-info').textContent = `${g.remote} · 브랜치 ${g.branch} · 바뀐 파일 ${g.changes.length}개`;
      $('#git-changes').innerHTML = g.changes.slice(0, 200).map(c => `<li>${esc(c)}</li>`).join('') || '<li>바뀐 파일 없음</li>';
      $('#git-publish').disabled = !g.changes.length;
    } catch (err) { $('#git-info').textContent = err.message; }
  }
  $('#git-refresh').addEventListener('click', gitStatus);
  $('#git-publish').addEventListener('click', async () => {
    const n = $$('#git-changes li').length;
    if (!confirm(`바뀐 파일 ${n}개를 커밋하고 GitHub에 push할까요?\n공개 저장소라 누구나 볼 수 있어요. (🔒 비밀글 원본은 올라가지 않아요)`)) return;
    const btn = $('#git-publish'); btn.disabled = true; btn.textContent = '게시하는 중…';
    const log = $('#git-log');
    try {
      const r = await api('POST', '/api/git/publish', { confirm: true, message: $('#git-msg').value.trim() || undefined });
      log.textContent = r.log.join('\n\n'); log.hidden = false; toast('게시했어요 — 1~2분 뒤 사이트에 반영돼요');
    } catch (err) { log.textContent = (err.data?.log || []).join('\n\n') || err.message; log.hidden = false; toast(err.message, true); }
    btn.textContent = '게시하기'; gitStatus();
  });

  const OP = { create: '새로 만듦', update: '수정', keep: '그대로', hide: '공개 해제' };
  $('#bw-preview').addEventListener('click', async () => {
    $('#bw-result').textContent = '불러오는 중…';
    try {
      const r = await api('POST', '/api/buildwork', { apply: false });
      const changes = r.preview.filter(a => a.op !== 'keep').length;
      $('#bw-result').innerHTML = `${r.warnings.map(w => `<p style="color:var(--warn)">⚠ ${esc(w)}</p>`).join('')}<ul>${r.preview.map(a => `<li><b>${OP[a.op]}</b> ${esc(a.title)}</li>`).join('') || '<li>공개 체크한 자료가 없어요</li>'}</ul>`;
      $('#bw-apply').disabled = !changes;
    } catch (err) { $('#bw-result').innerHTML = `<p style="color:#DC2626">${esc(err.message)}</p>`; $('#bw-apply').disabled = true; }
  });
  $('#bw-apply').addEventListener('click', async () => {
    if (!confirm('미리보기 내용대로 buildwork.kr Notion에 반영할까요?')) return;
    try { const r = await api('POST', '/api/buildwork', { apply: true }); toast(`Notion 반영 ${r.done}건`); $('#bw-apply').disabled = true; }
    catch (err) { toast(err.message, true); }
  });

  // ---------- 시작 ----------
  fillItem(null); fillTopic(null);
  refresh().then(() => loadCands(false));
})();
