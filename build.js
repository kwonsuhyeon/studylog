// node build.js — topics/·items/(+private/) -> docs/ (GitHub Pages 배포 폴더)
// docs/를 직접 고치지 않는다. 원본을 고치거나 등록 페이지(/admin)를 쓴 뒤 다시 빌드한다.
// Dropbox 잠금 대응: 바뀐 파일만 덮어쓰고, 이번 빌드에서 안 만든 파일만 지운다.
process.stdout.setDefaultEncoding?.('utf8');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const pages = require('./lib/pages');
const secret = require('./lib/secret');
const md = require('./lib/md');
const { loadPapers } = require('./lib/papers');
const { writeIfChanged, copyIfChanged, removeFile, walk } = require('./lib/fsutil');

function build(root = store.ROOT, { log = console.log } = {}) {
  const P = store.paths(root);
  const config = store.loadConfig(root);
  const env = { ...store.loadEnv(root), ...(process.env.STUDYLOG_PIN ? { STUDYLOG_PIN: process.env.STUDYLOG_PIN } : {}) };
  const { errors, valid } = store.validate(store.load(root), root);
  const warnings = errors.map(e => `${e.file}: ${e.msg}`);

  // 비밀 자료의 assets/ 파일은 공개 저장소에 평문으로 올라가므로 금지
  for (const it of valid.items.filter(i => i.secret && String(i.url || '').startsWith('assets/'))) {
    warnings.push(`${it.id}: 비밀글은 assets/ 파일을 쓸 수 없어요 (공개 저장소에 그대로 올라감) — 링크만 쓰세요`);
  }
  const items = valid.items.filter(i => !(i.secret && String(i.url || '').startsWith('assets/')));

  // 색: 상위 주제 순서대로 팔레트, 하위 주제는 상위 색을 물려받음
  const roots = valid.topics.filter(t => !t.parent).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  roots.forEach((t, i) => { t._color = t.color || `var(--topic-${(i % pages.PALETTE) + 1})`; });
  for (const t of valid.topics.filter(t => t.parent)) {
    const p = valid.topics.find(x => x.id === t.parent);
    t._color = t.color || p._color;
  }

  const pubTopics = valid.topics.filter(t => !t.secret);
  const pubItems = items.filter(i => !i.secret);
  const ctxFor = (topics, its) => {
    const children = new Map();
    for (const t of topics.filter(t => t.parent)) {
      if (!children.has(t.parent)) children.set(t.parent, []);
      children.get(t.parent).push(t);
    }
    for (const list of children.values()) list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    return { topics, items: its, children, topicById: new Map(topics.map(t => [t.id, t])) };
  };
  const ctx = ctxFor(pubTopics, pubItems);
  const papers = config.papersDir ? loadPapers(path.resolve(root, config.papersDir)) : [];
  ctx.papers = papers;

  const out = new Map(); // docs 상대 경로 -> 내용
  const put = (rel, content) => out.set(rel, content);

  // 비밀글
  const secretTopics = valid.topics.filter(t => t.secret);
  const secretItems = items.filter(i => i.secret);
  ctx.hasSecret = false;
  if (secretTopics.length || secretItems.length) {
    const pin = env.STUDYLOG_PIN;
    if (!pin) warnings.push(`비밀글 ${secretTopics.length + secretItems.length}개를 건너뜀 — .env.local에 STUDYLOG_PIN이 없어요`);
    else {
      if (String(pin).length < 8) warnings.push('PIN이 8자 미만이에요 — 암호문을 내려받으면 짧은 시간에 전수 대입할 수 있어요');
      const sctx = ctxFor(valid.topics, items);
      sctx.papers = papers;
      sctx.secretTopics = secretTopics;
      put('secret.json', JSON.stringify(secret.encrypt(pages.secretPayload(sctx), pin, Number(env.STUDYLOG_PIN_ITER) || secret.ITER)));
      ctx.hasSecret = true;
    }
  }

  put('index.html', pages.home(ctx, config));
  for (const t of pubTopics) put(`t/${t.id}.html`, pages.topicPage(t, ctx, config));
  for (const it of pubItems) put(`i/${it.id}.html`, pages.itemPage(it, ctx, config));

  put('search.json', JSON.stringify({
    topics: pubTopics.map(t => ({ id: t.id, title: t.title, parent: t.parent, text: md.plain(t.body, 400) })),
    items: pubItems.map(i => ({ id: i.id, title: i.title, section: i.section, kind: i.kind || '', course: i.course || '', topics: i.topics, tags: i.tags, url: i.url || '', text: md.plain(i.body, 200) })),
  }));
  put('robots.txt', config.indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  put('.nojekyll', '');
  for (const f of ['style.css', 'app.js']) put(f, fs.readFileSync(path.join(__dirname, 'site', f)));

  // 공개 자료가 쓰는 assets만 복사 (슬라이드 HTML은 같은 폴더 전체)
  const assetSrc = new Map();
  for (const it of pubItems.filter(i => String(i.url || '').startsWith('assets/'))) {
    const rel = it.url.slice('assets/'.length);
    const top = rel.split('/')[0];
    const dir = path.join(P.assets, top);
    const files = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? walk(dir).map(f => `${top}/${f}`) : [rel];
    for (const f of files) assetSrc.set(`assets/${f}`, path.join(P.assets, f));
  }

  let written = 0, removed = 0;
  for (const [rel, content] of out) if (writeIfChanged(path.join(P.docs, rel), content)) written++;
  for (const [rel, src] of assetSrc) if (copyIfChanged(src, path.join(P.docs, rel))) written++;
  const keep = new Set([...out.keys(), ...assetSrc.keys()]);
  for (const rel of walk(P.docs)) if (!keep.has(rel) && removeFile(path.join(P.docs, rel))) removed++;

  const summary = { topics: pubTopics.length, items: pubItems.length, secret: ctx.hasSecret ? secretTopics.length + secretItems.length : 0, written, removed, warnings };
  log(`✅ 빌드 완료 — 주제 ${summary.topics} · 자료 ${summary.items}${summary.secret ? ` · 🔒 비밀글 ${summary.secret}` : ''} · 파일 갱신 ${written} · 삭제 ${removed}`);
  for (const w of warnings) log(`⚠ ${w}`);
  return summary;
}

if (require.main === module) {
  try { build(); } catch (e) { console.error('❌ 빌드 실패:', e.message); process.exit(1); }
}
module.exports = { build };
