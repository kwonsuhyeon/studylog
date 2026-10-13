// node serve.js — 로컬 미리보기(docs/) + 등록 페이지(/admin) + API
// 127.0.0.1 전용. 포트 STUDYLOG_PORT(기본 4750).
// /admin과 /api는 배포본(docs/)에 들어가지 않는다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const store = require('./lib/store');
const md = require('./lib/md');
const candidates = require('./lib/candidates');
const buildwork = require('./lib/buildwork');
const { build } = require('./build');
const { writeIfChanged, removeFile } = require('./lib/fsutil');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const MAX_UPLOAD = 200 * 1024 * 1024;

function createServer({ root = store.ROOT, port } = {}) {
  const P = store.paths(root);
  const ADMIN = path.join(__dirname, 'admin');
  let lastBuild = null;
  const rebuild = () => { lastBuild = build(root, { log: () => {} }); return lastBuild; };

  const send = (res, code, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const fail = (res, code, msg) => send(res, code, { error: msg });

  function serveFile(res, base, rel) {
    const file = path.resolve(base, '.' + path.sep + decodeURIComponent(rel));
    if (!file.startsWith(path.resolve(base))) return fail(res, 403, 'forbidden');
    let f = file;
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) return send(res, 404, '없는 페이지예요', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  }

  const readBody = (req, limit = 5 * 1024 * 1024) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('너무 큰 요청')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  // UTF-8이 아닌 요청(예: Windows 콘솔의 CP949)은 글자가 깨진 채 저장되므로 거부
  const readJson = async req => {
    const buf = await readBody(req);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { const e = new Error('UTF-8이 아닌 요청이에요 (글자가 깨져 저장될 수 있어 거부)'); e.status = 400; throw e; }
    return JSON.parse(text || '{}');
  };

  const git = args => new Promise(resolve => execFile('git', args, { cwd: root, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || '') + String(stderr || '') })));

  // 상태 (등록 페이지용 — 비밀글 포함 전체)
  function state() {
    const all = store.load(root);
    const { errors } = store.validate(all, root);
    const strip = o => { const { _file, parts, ...rest } = o; return rest; };
    return { topics: all.topics.map(strip), items: all.items.map(strip), errors, config: store.loadConfig(root), hasPin: !!(store.loadEnv(root).STUDYLOG_PIN || process.env.STUDYLOG_PIN), lastBuild };
  }

  // 같은 출처에서 온 요청만 쓰기 허용 (다른 웹사이트가 이 PC의 서버로 요청을 보내는 것 차단)
  function sameOrigin(req) {
    const o = req.headers.origin;
    const host = req.headers.host;
    if (!o) return req.headers['sec-fetch-site'] === 'same-origin' || req.headers['x-studylog'] === '1';
    try { const u = new URL(o); return u.host === host && ['127.0.0.1', 'localhost'].includes(u.hostname); } catch { return false; }
  }

  const today = store.today;

  async function api(req, res, url) {
    const m = req.method;
    const route = url.pathname;
    if (m !== 'GET' && !sameOrigin(req)) return fail(res, 403, '다른 출처의 요청은 받지 않아요');

    if (m === 'GET' && route === '/api/state') return send(res, 200, state());

    if (m === 'POST' && route === '/api/items') {
      const b = await readJson(req);
      const all = store.load(root);
      const taken = new Set(all.items.map(i => i.id));
      let id = b.id;
      if (b.isNew || !id) id = store.uniqueId(store.slugify(b.id || b.title), taken);
      if (!store.isId(id)) return fail(res, 400, `id 형식 오류: ${id}`);
      const data = {
        title: String(b.title || '').trim(), section: b.section, topics: (b.topics || []).filter(Boolean), kind: b.kind,
        url: String(b.url || '').trim(), date: b.date || today(), course: String(b.course || '').trim(),
        tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',')).map(s => s.trim()).filter(Boolean),
        public: b.public === true, secret: b.secret === true, source: String(b.source || '').trim(),
      };
      if (!data.title) return fail(res, 400, '제목을 입력하세요');
      if (!data.topics.length) return fail(res, 400, '주제를 하나 이상 고르세요');
      if (data.secret && data.url.startsWith('assets/')) return fail(res, 400, '비밀글에는 파일을 첨부할 수 없어요 (공개 저장소에 그대로 올라감). 링크를 쓰세요');
      if (data.section !== 'lecture') data.course = '';
      const prev = all.items.find(i => i.id === id);
      store.saveDoc('item', id, data, String(b.body || ''), root);
      // 자료가 새로 붙은 주제는 updated를 오늘로
      const added = data.topics.filter(t => !prev || !prev.topics.includes(t));
      for (const tid of added) touchTopic(tid);
      return send(res, 200, { id, build: rebuild() });
    }

    let mm;
    if (m === 'DELETE' && (mm = route.match(/^\/api\/items\/([^/]+)$/))) {
      const id = decodeURIComponent(mm[1]);
      const it = store.load(root).items.find(i => i.id === id);
      if (!it) return fail(res, 404, '없는 자료');
      store.deleteDoc('item', id, root);
      // 그 자료 전용 assets 폴더도 정리 (다른 자료가 같은 파일을 쓰지 않을 때)
      const url = String(it.url || '');
      if (url.startsWith(`assets/${id}/`)) {
        const dir = path.join(P.assets, id);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      }
      return send(res, 200, { ok: true, build: rebuild() });
    }

    if (m === 'POST' && route === '/api/topics') {
      const b = await readJson(req);
      const all = store.load(root);
      const id = String(b.id || '').trim();
      if (!store.isId(id)) return fail(res, 400, 'id는 영문 소문자·숫자·한글·-·_만 (예: kt, causal)');
      const prev = all.topics.find(t => t.id === id);
      if (b.isNew && prev) return fail(res, 400, `이미 있는 주제 id: ${id}`);
      if (b.parent) {
        const p = all.topics.find(t => t.id === b.parent);
        if (!p) return fail(res, 400, `없는 상위 주제: ${b.parent}`);
        if (p.parent) return fail(res, 400, '주제는 2단계까지예요 (상위 주제에는 또 상위가 없어야 해요)');
        if (p.id === id) return fail(res, 400, '자기 자신을 상위 주제로 고를 수 없어요');
        if (all.topics.some(t => t.parent === id)) return fail(res, 400, '하위 주제가 있는 주제는 다른 주제 아래로 옮길 수 없어요');
      }
      const parts = { ...(prev ? prev.parts : {}), ...(b.parts || {}) };
      const data = { title: String(b.title || id).trim(), parent: b.parent || '', updated: today(), color: b.color || '', secret: b.secret === true };
      store.saveDoc('topic', id, data, store.topicBody(parts), root);
      return send(res, 200, { id, build: rebuild() });
    }

    if (m === 'DELETE' && (mm = route.match(/^\/api\/topics\/([^/]+)$/))) {
      const id = decodeURIComponent(mm[1]);
      const all = store.load(root);
      if (all.topics.some(t => t.parent === id)) return fail(res, 400, '하위 주제가 있어 지울 수 없어요');
      const used = all.items.filter(i => i.topics.includes(id));
      if (used.length) return fail(res, 400, `이 주제를 쓰는 자료 ${used.length}개가 있어요: ${used.slice(0, 3).map(i => i.title).join(', ')}`);
      store.deleteDoc('topic', id, root);
      return send(res, 200, { ok: true, build: rebuild() });
    }

    if (m === 'POST' && route === '/api/build') return send(res, 200, { build: rebuild() });

    if (m === 'GET' && route === '/api/candidates') {
      const config = store.loadConfig(root);
      const force = url.searchParams.get('force') === '1';
      const [gh, local] = await Promise.allSettled([candidates.githubPages(config, { force }), candidates.scanLocal(config, { force })]);
      const all = store.load(root);
      const used = new Set(all.items.map(i => String(i.url || '').replace(/\/+$/, '')));
      const usedSrc = new Set(all.items.map(i => i.source).filter(Boolean));
      const mark = c => ({ ...c, registered: c.source === 'github' ? used.has(c.url.replace(/\/+$/, '')) : usedSrc.has(c.rel) });
      return send(res, 200, {
        github: gh.status === 'fulfilled' ? gh.value.map(mark) : [], githubError: gh.status === 'rejected' ? gh.reason.message : null,
        local: local.status === 'fulfilled' ? { ...local.value, files: local.value.files.map(mark) } : { files: [] },
        localError: local.status === 'rejected' ? local.reason.message : null, scanDirs: config.scanDirs,
      });
    }

    // 로컬 파일을 assets/<id>/로 가져오기 (등록 후보에서 고른 파일)
    if (m === 'POST' && route === '/api/import-file') {
      const b = await readJson(req);
      const config = store.loadConfig(root);
      const src = path.resolve(String(b.path || ''));
      const allowed = (config.scanDirs || []).some(d => src.startsWith(path.resolve(d) + path.sep));
      if (!allowed) return fail(res, 400, '설정의 scanDirs 안에 있는 파일만 가져올 수 있어요');
      if (!fs.existsSync(src) || !/\.(html?|pdf)$/i.test(src)) return fail(res, 400, '파일이 없거나 html·pdf가 아니에요');
      const id = store.uniqueId(store.slugify(b.id || path.basename(src).replace(/\.\w+$/, '')), new Set([...store.load(root).items.map(i => i.id), ...(fs.existsSync(P.assets) ? fs.readdirSync(P.assets) : [])]));
      const dest = path.join(P.assets, id);
      const name = path.basename(src);
      const files = [name, ...(/\.html?$/i.test(name) ? candidates.htmlRelatedFiles(src) : [])];
      let bytes = 0;
      for (const rel of files) {
        const from = path.join(path.dirname(src), rel);
        bytes += fs.statSync(from).size;
        if (bytes > MAX_UPLOAD) return fail(res, 400, '파일이 너무 커요 (200MB 넘음)');
        writeIfChanged(path.join(dest, rel), fs.readFileSync(from));
      }
      const scanRoot = path.resolve(config.scanDirs.find(d => src.startsWith(path.resolve(d) + path.sep)));
      return send(res, 200, { id, url: `assets/${id}/${name}`, files: files.length, bytes, source: path.relative(path.dirname(scanRoot), src).split(path.sep).join('/') });
    }

    // 파일 직접 올리기 (본문 = 파일 바이트)
    if (m === 'POST' && route === '/api/upload') {
      const name = path.basename(String(url.searchParams.get('name') || ''));
      if (!/\.(html?|pdf|png|jpe?g|gif|svg|webp)$/i.test(name)) return fail(res, 400, 'html·pdf·이미지 파일만 올릴 수 있어요');
      const buf = await readBody(req, MAX_UPLOAD);
      const id = store.uniqueId(store.slugify(url.searchParams.get('id') || name.replace(/\.\w+$/, '')), new Set([...store.load(root).items.map(i => i.id), ...(fs.existsSync(P.assets) ? fs.readdirSync(P.assets) : [])]));
      writeIfChanged(path.join(P.assets, id, name), buf);
      return send(res, 200, { id, url: `assets/${id}/${name}`, bytes: buf.length });
    }

    if (m === 'GET' && route === '/api/git/status') {
      const isRepo = fs.existsSync(path.join(root, '.git'));
      if (!isRepo) return send(res, 200, { isRepo: false });
      const st = await git(['status', '--porcelain', '-uall']);
      const br = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
      const remote = await git(['remote', 'get-url', 'origin']);
      return send(res, 200, { isRepo: true, branch: br.out.trim(), remote: remote.out.trim(), changes: st.out.split('\n').filter(Boolean) });
    }

    if (m === 'POST' && route === '/api/git/publish') {
      const b = await readJson(req);
      if (b.confirm !== true) return fail(res, 400, '확인이 필요해요');
      const b0 = rebuild();
      const log = [];
      const run = async args => { const r = await git(args); log.push(`$ git ${args.join(' ')}\n${r.out.trim()}`); return r; };
      await run(['add', '-A']);
      const c = await run(['commit', '-m', String(b.message || `studylog 갱신 ${today()}`)]);
      if (!c.ok && !/nothing to commit/.test(c.out)) return send(res, 500, { error: '커밋 실패', log });
      const p = await run(['push', '-u', 'origin', 'HEAD']);
      if (!p.ok) return send(res, 500, { error: '푸시 실패', log });
      return send(res, 200, { ok: true, log, build: b0 });
    }

    if (m === 'POST' && route === '/api/buildwork') {
      const b = await readJson(req);
      const { valid } = store.validate(store.load(root), root);
      try {
        const p = await buildwork.plan({ items: valid.items, topics: valid.topics, config: store.loadConfig(root), env: store.loadEnv(root), md });
        const preview = p.actions.map(({ props, ...a }) => a);
        if (b.apply !== true) return send(res, 200, { preview, warnings: p.warnings });
        const done = await p.apply();
        return send(res, 200, { done: done.length, preview, warnings: p.warnings });
      } catch (e) { return fail(res, 400, e.message); }
    }

    return fail(res, 404, '없는 API');
  }

  function touchTopic(id) {
    const t = store.load(root).topics.find(x => x.id === id);
    if (!t || t.updated === today()) return;
    store.saveDoc('topic', id, { title: t.title, parent: t.parent, color: t.color, secret: t.secret, updated: today() }, t.body, root);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
      if (url.pathname.startsWith('/admin/')) return serveFile(res, ADMIN, url.pathname.slice('/admin/'.length) || 'index.html');
      if (url.pathname.startsWith('/assets/') && !fs.existsSync(path.join(P.docs, decodeURIComponent(url.pathname)))) {
        return serveFile(res, P.assets, url.pathname.slice('/assets/'.length)); // 등록 직후 미리보기용
      }
      return serveFile(res, P.docs, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    } catch (e) {
      if (!e.status) console.error(e);
      if (!res.headersSent) fail(res, e.status || (e instanceof SyntaxError ? 400 : 500), e.message);
    }
  });
  server.rebuild = rebuild;
  return server;
}

if (require.main === module) {
  const HOST = '127.0.0.1';
  const PORT = Number(process.env.STUDYLOG_PORT) || 4750;
  const server = createServer();
  try { const r = server.rebuild(); console.log(`빌드: 주제 ${r.topics} · 자료 ${r.items}${r.warnings.length ? ` · 경고 ${r.warnings.length}` : ''}`); } catch (e) { console.error('빌드 실패:', e.message); }
  server.listen(PORT, HOST, () => {
    console.log(`🗺 studylog  http://${HOST}:${PORT}/`);
    console.log(`✏️ 등록 페이지 http://${HOST}:${PORT}/admin/`);
  });
}

module.exports = { createServer };
