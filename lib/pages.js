// 정적 페이지 HTML 템플릿. base = 루트까지 상대 경로('' 또는 '../').
// 카드는 제목 링크를 카드 전체로 늘린다(.stretch::after). 칩·열기 버튼은 그 위에 따로 눌린다.
const md = require('./md');
const { esc } = md;

const PALETTE = 8; // CSS 변수 --topic-1 … --topic-8
const SEC = { study: '공부', lecture: '강의' };
const KIND = { site: '사이트', slide: '슬라이드', repo: '저장소', pdf: 'PDF', note: '노트' };

function layout({ title, base, body, hero = '', config, page }) {
  const robots = config.indexable ? '' : '\n<meta name="robots" content="noindex, nofollow">';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${robots}
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${base}style.css">
</head>
<body data-page="${page}" data-base="${base}" data-papers="${esc(config.papersWiki)}" data-stale="${config.staleDays}">
<div class="ink">
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="${base}index.html"><span class="brand-mark" aria-hidden="true"></span>${esc(config.siteTitle)}</a>
    <div class="search"><input id="q" type="search" placeholder="주제·자료 검색" autocomplete="off" aria-label="주제·자료 검색"><div id="results" class="results" hidden></div></div>
  </div>
</header>
${hero}
</div>
<main class="wrap">
${body}
</main>
<footer class="foot"><div class="wrap">공부·연구·강의 자료를 주제별로 모아 둔 곳 · 공개 자료는 <a href="https://buildwork.kr/resources" target="_blank" rel="noopener">buildwork.kr</a></div></footer>
<script src="${base}app.js"></script>
</body>
</html>
`;
}

// 비밀 주제는 공개 페이지가 없으므로 링크 없이 표시
const chip = (t, base, cls = '') => t.secret
  ? `<span class="chip ${cls}" style="--c:${t._color}">🔒 ${esc(t.title)}</span>`
  : `<a class="chip ${cls}" href="${base}t/${encodeURIComponent(t.id)}.html" style="--c:${t._color}">${esc(t.title)}</a>`;

function itemHref(it, base) {
  if (!it.url) return '';
  return /^https?:\/\//.test(it.url) ? it.url : base + it.url;
}

const dateTag = (d, cls = '') => d ? `<time class="mono ${cls}" datetime="${esc(d)}">${esc(String(d).replace(/-/g, '.'))}</time>` : '';

function itemCard(it, ctx, base) {
  const href = itemHref(it, base);
  const topics = it.topics.map(id => ctx.topicById.get(id)).filter(Boolean);
  const desc = md.plain(it.body, 180);
  const title = it.secret ? esc(it.title) : `<a class="stretch" href="${base}i/${encodeURIComponent(it.id)}.html">${esc(it.title)}</a>`;
  return `<article class="item${it.secret ? '' : ' linked'}" data-section="${it.section}" data-date="${esc(it.date || '')}">
  <p class="eyebrow">${KIND[it.kind] || '자료'} · ${SEC[it.section]}${it.course ? ` · ${esc(it.course)}` : ''}${it.public ? ' <span class="pub" title="buildwork.kr에 공개">공개</span>' : ''}</p>
  <h3>${title}</h3>
  ${it.secret && it.body ? `<div class="desc">${md.render(it.body)}</div>` : desc ? `<p class="desc">${esc(desc)}</p>` : ''}
  <div class="item-foot"><div class="chips">${topics.map(t => chip(t, base, 'sm')).join('')}</div>${dateTag(it.date, 'date')}${href ? `<a class="open" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(it.title)} 새 탭에서 열기">열기 ↗</a>` : ''}</div>
</article>`;
}

function topicStats(t, ctx) {
  const ids = new Set([t.id, ...(ctx.children.get(t.id) || []).map(c => c.id)]);
  const items = ctx.items.filter(it => it.topics.some(x => ids.has(x)));
  const dates = [t.updated, ...(ctx.children.get(t.id) || []).map(c => c.updated), ...items.map(i => i.date)].filter(Boolean).sort();
  return {
    items,
    study: items.filter(i => i.section === 'study').length,
    lecture: items.filter(i => i.section === 'lecture').length,
    updated: dates[dates.length - 1] || '',
    next: md.openTasks(t.parts['이어서 정리할 것'])[0] || '',
  };
}

const updTag = d => d ? `<span class="upd mono" data-date="${d}">${esc(d.replace(/-/g, '.'))}</span>` : '';

function topicCard(t, ctx, base) {
  const s = topicStats(t, ctx);
  const kids = ctx.children.get(t.id) || [];
  const def = md.plain(t.parts['한 줄 정의'], 110);
  return `<article class="topic" style="--c:${t._color}" data-title="${esc(t.title)}" data-updated="${s.updated}" data-count="${s.items.length}" data-study="${s.study}" data-lecture="${s.lecture}">
  <div class="topic-head"><span class="dot" aria-hidden="true"></span><h2><a class="stretch" href="${base}t/${encodeURIComponent(t.id)}.html">${esc(t.title)}</a></h2><span class="go" aria-hidden="true">→</span></div>
  ${def ? `<p class="def">${esc(def)}</p>` : '<p class="def muted">한 줄 정의가 비어 있어요</p>'}
  ${kids.length ? `<div class="chips">${kids.map(k => chip(k, base)).join('')}</div>` : ''}
  ${s.next ? `<p class="next"><span class="lbl">다음</span>${esc(md.plain(s.next, 70))}</p>` : '<p class="next none"><span class="lbl">다음</span>이어서 할 일을 적어 두세요</p>'}
  <div class="meta"><span>공부 <b class="mono">${s.study}</b></span><span>강의 <b class="mono">${s.lecture}</b></span>${updTag(s.updated)}</div>
</article>`;
}

function home(ctx, config) {
  const base = '';
  const roots = ctx.topics.filter(t => !t.parent);
  const recent = [...ctx.items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
  const courses = new Map();
  for (const it of ctx.items.filter(i => i.section === 'lecture')) {
    const c = it.course || '과정 미지정';
    if (!courses.has(c)) courses.set(c, []);
    courses.get(c).push(it);
  }
  const courseList = [...courses.entries()].sort((a, b) => (a[0] === '과정 미지정') - (b[0] === '과정 미지정') || a[0].localeCompare(b[0], 'ko'));
  const body = `
<section class="toolbar">
  <div class="filters" role="group" aria-label="구분">
    <button class="fchip on" data-filter="all">전체</button><button class="fchip" data-filter="study">공부</button><button class="fchip" data-filter="lecture">강의</button>
  </div>
  <label class="sort">정렬 <select id="sort"><option value="updated">최근순</option><option value="count">자료 많은 순</option><option value="title">이름순</option></select></label>
</section>
<section id="map" class="map" aria-label="주제">
${roots.map(t => topicCard(t, ctx, base)).join('\n')}
</section>
<section id="courses" class="block courses" hidden>
  <div class="block-head"><p class="eyebrow">강의</p><h2>과정별로 보기</h2></div>
  ${courseList.length ? `<div class="course-grid">${courseList.map(([c, its]) => `<div class="course-box"><h3>${esc(c)} <span class="mono">${its.length}</span></h3><ul>${its.map(it => {
    const href = itemHref(it, base);
    return `<li><a href="i/${encodeURIComponent(it.id)}.html">${esc(it.title)}</a>${href ? ` <a class="ext" href="${esc(href)}" target="_blank" rel="noopener" aria-label="새 탭에서 열기">↗</a>` : ''}</li>`;
  }).join('')}</ul></div>`).join('')}</div>` : '<p class="muted">강의 자료가 아직 없어요. 등록 페이지에서 구분을 "강의"로 골라 추가하세요.</p>'}
</section>
<section class="block recent">
  <div class="block-head"><p class="eyebrow">최근</p><h2>새로 모은 자료</h2></div>
  <div class="items">${recent.map(it => itemCard(it, ctx, base)).join('\n') || '<p class="muted">아직 자료가 없어요. 등록 페이지에서 첫 자료를 추가하세요.</p>'}</div>
</section>
${ctx.hasSecret ? `<section id="secret" class="block secret-box">
  <div class="block-head"><p class="eyebrow">나만 보기</p><h2>🔒 비밀글</h2></div>
  <div id="secret-lock" class="lock"><p>PIN을 입력하면 이 탭을 닫을 때까지 열려 있어요.</p>
    <form id="pin-form"><input id="pin" type="password" autocomplete="current-password" placeholder="PIN" aria-label="PIN"><button class="btn">열기</button></form><p id="pin-msg" class="msg" role="status"></p></div>
  <div id="secret-body" hidden></div>
</section>` : ''}`;
  return layout({ title: config.siteTitle, base, body, config, page: 'home' });
}

function topicPage(t, ctx, config) {
  const base = '../';
  const s = topicStats(t, ctx);
  const parent = t.parent ? ctx.topicById.get(t.parent) : null;
  const kids = ctx.children.get(t.id) || [];
  const p = t.parts;
  const bySec = sec => [...s.items.filter(i => i.section === sec)].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const related = new Map();
  for (const it of s.items) for (const id of it.topics) {
    const r = ctx.topicById.get(id);
    if (r && r.id !== t.id && r.id !== t.parent && !kids.some(k => k.id === r.id)) related.set(r.id, r);
  }
  const block = (sec) => {
    const list = bySec(sec);
    return `<div class="sec-block"><h3>${SEC[sec]} <span class="mono">${list.length}</span></h3><div class="items">${list.map(it => itemCard(it, ctx, base)).join('\n') || `<p class="muted">${SEC[sec]} 자료가 아직 없어요</p>`}</div></div>`;
  };
  const hero = `<section class="page-head" style="--c:${t._color}">
  <div class="wrap">
    <nav class="crumb" aria-label="경로"><a href="${base}index.html">지도</a>${parent ? ` <span>/</span> <a href="${base}t/${encodeURIComponent(parent.id)}.html">${esc(parent.title)}</a>` : ''} <span>/</span> <b>${esc(t.title)}</b></nav>
    <h1><span class="dot" aria-hidden="true"></span>${esc(t.title)}</h1>
    ${p['한 줄 정의'] ? `<div class="def">${md.render(p['한 줄 정의'])}</div>` : '<p class="def muted">한 줄 정의가 비어 있어요</p>'}
    <p class="tally mono"><span>공부 ${s.study}</span><span>강의 ${s.lecture}</span>${s.updated ? `<span>최근 수정 <span class="upd" data-date="${s.updated}">${s.updated.replace(/-/g, '.')}</span></span>` : ''}</p>
  </div>
</section>`;
  const body = `
<article class="topic-page" style="--c:${t._color}">
  ${kids.length ? `<section class="block"><div class="block-head"><p class="eyebrow">하위 주제</p></div><div class="sub-topics">${kids.map(k => topicCard(k, ctx, base)).join('\n')}</div></section>` : ''}
  <div class="topic-body">
    <section class="part summary"><p class="eyebrow">지금까지 정리한 것</p>${p['지금까지 정리한 것'] ? md.render(p['지금까지 정리한 것'], { headingShift: 2 }) : '<p class="muted">아직 비어 있어요. 등록 페이지의 주제 관리에서 채울 수 있어요.</p>'}</section>
    <aside class="part todo"><p class="eyebrow">이어서 정리할 것</p>${p['이어서 정리할 것'] ? md.render(p['이어서 정리할 것'], { headingShift: 2, checkboxPrefix: t.id }) : '<p class="muted">아직 없어요</p>'}
      ${related.size ? `<p class="eyebrow rel">관련 주제</p><div class="chips">${[...related.values()].map(r => chip(r, base)).join('')}</div>` : ''}</aside>
  </div>
  <section class="block"><div class="block-head"><p class="eyebrow">자료</p><h2>이 주제로 만든 것</h2></div>${block('study')}${block('lecture')}</section>
</article>`;
  return layout({ title: `${t.title} · ${config.siteTitle}`, base, body, hero, config, page: 'topic' });
}

function itemPage(it, ctx, config) {
  const base = '../';
  const href = itemHref(it, base);
  const topics = it.topics.map(id => ctx.topicById.get(id)).filter(Boolean);
  const isLocalHtml = it.url && !/^https?:/.test(it.url) && /\.html?$/i.test(it.url);
  const c = topics[0]?._color || 'var(--accent)';
  const hero = `<section class="page-head" style="--c:${c}">
  <div class="wrap">
    <nav class="crumb" aria-label="경로"><a href="${base}index.html">지도</a> <span>/</span> ${topics.map(t => `<a href="${base}t/${encodeURIComponent(t.id)}.html">${esc(t.title)}</a>`).join(' · ')}</nav>
    <p class="eyebrow">${KIND[it.kind] || '자료'} · ${SEC[it.section]}${it.course ? ` · ${esc(it.course)}` : ''}</p>
    <h1>${esc(it.title)}</h1>
    <p class="tally mono">${it.date ? `<span>${esc(it.date.replace(/-/g, '.'))}</span>` : ''}${(it.tags || []).map(g => `<span>#${esc(g)}</span>`).join('')}</p>
    ${href ? `<p class="actions"><a class="btn accent" href="${esc(href)}" target="_blank" rel="noopener">새 탭에서 열기 ↗</a><span class="url mono">${esc(it.url)}</span></p>` : ''}
  </div>
</section>`;
  const body = `
<article class="item-page">
  <div class="chips">${topics.map(t => chip(t, base)).join('')}</div>
  <div class="body">${md.render(it.body, { headingShift: 1 })}</div>
  ${isLocalHtml || it.kind === 'site' ? `<iframe class="preview" src="${esc(href)}" loading="lazy" title="${esc(it.title)} 미리보기"></iframe>` : ''}
</article>`;
  return layout({ title: `${it.title} · ${config.siteTitle}`, base, body, hero, config, page: 'item' });
}

// 비밀글 묶음 (암호화 전 평문) — 홈 화면 🔒 영역에 그대로 꽂히는 HTML
function secretPayload(sctx) {
  const base = '';
  const roots = sctx.secretTopics.filter(t => !t.parent || !sctx.secretTopics.some(x => x.id === t.parent));
  const topicBlock = t => {
    const p = t.parts;
    const its = sctx.items.filter(i => i.secret && i.topics.includes(t.id));
    const kids = sctx.secretTopics.filter(k => k.parent === t.id);
    return `<details class="secret-topic" style="--c:${t._color}"><summary>🔒 ${esc(t.title)}${t.parent && !sctx.secretTopics.some(x => x.id === t.parent) ? ` <small>(${esc(sctx.topicById.get(t.parent)?.title || t.parent)} 아래)</small>` : ''}</summary>
      ${TOPIC_SECTIONS.map(h => `<p class="eyebrow">${h}</p>${p[h] ? md.render(p[h], { headingShift: 3 }) : '<p class="muted">비어 있음</p>'}`).join('')}
      ${its.length ? `<p class="eyebrow">자료</p><div class="items">${its.map(it => itemCard(it, sctx, base)).join('')}</div>` : ''}
      ${kids.map(topicBlock).join('')}
    </details>`;
  };
  const looseItems = sctx.items.filter(i => i.secret && !i.topics.some(id => sctx.secretTopics.some(t => t.id === id)));
  const html = `${roots.map(topicBlock).join('')}${looseItems.length ? `<p class="eyebrow">비밀 자료</p><div class="items">${looseItems.map(it => itemCard(it, sctx, base)).join('')}</div>` : ''}`;
  return { html, count: sctx.secretTopics.length + sctx.items.filter(i => i.secret).length };
}
const TOPIC_SECTIONS = ['한 줄 정의', '지금까지 정리한 것', '이어서 정리할 것'];

module.exports = { layout, home, topicPage, itemPage, secretPayload, topicStats, PALETTE };
