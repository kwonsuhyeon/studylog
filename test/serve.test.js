const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createServer } = require('../serve');
const store = require('../lib/store');
const candidates = require('../lib/candidates');
const { makeRoot, read, exists, BASIC } = require('./helpers');

const BASE_PORT = Number(process.env.STUDYLOG_TEST_PORT) || 4760; // 사용자 서버(4750)와 다른 포트
let nextPort = BASE_PORT; // 테스트마다 새 포트 (fetch 연결 풀 재사용 문제 회피)

async function withServer(files, fn) {
  const PORT = nextPort++;
  const root = makeRoot(files);
  const scan = path.join(root, 'scan');
  fs.mkdirSync(path.join(scan, 'proj', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(scan, 'proj', 'slide.html'), '<img src="img/a.png"><link href="../../outside.css"><a href="https://x.com">x</a>');
  fs.mkdirSync(path.join(scan, 'proj', 'img'));
  fs.writeFileSync(path.join(scan, 'proj', 'img', 'a.png'), 'PNG');
  fs.writeFileSync(path.join(scan, 'proj', 'deep', 'notes.pdf'), 'PDF');
  fs.mkdirSync(path.join(scan, 'node_modules'));
  fs.writeFileSync(path.join(scan, 'node_modules', 'skip.html'), 'x');
  const cfg = JSON.parse(files['studylog.config.json'] || '{}');
  fs.writeFileSync(path.join(root, 'studylog.config.json'), JSON.stringify({ ...cfg, scanDirs: [scan], githubUser: 'nobody-studylog-test' }));
  candidates.clearCache();
  const server = createServer({ root });
  server.rebuild();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${PORT}`;
  const call = async (method, url, body, headers = {}) => {
    const r = await fetch(origin + url, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json };
  };
  try { await fn({ root, call, origin, scan }); } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}

test('serve: 다른 출처의 쓰기 요청 차단', async () => {
  await withServer(BASIC, async ({ call }) => {
    const r = await call('POST', '/api/build', {}, { Origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    const ok = await call('POST', '/api/build', {});
    assert.equal(ok.status, 200);
  });
});

test('serve: 자료 등록 -> md 파일 생성, 빌드, 주제 updated 갱신', async () => {
  await withServer(BASIC, async ({ root, call }) => {
    const r = await call('POST', '/api/items', { isNew: true, title: '페르소나 실험 사이트', section: 'study', kind: 'site', topics: ['causal'], url: 'https://kwonsuhyeon.github.io/personaex/', body: '실험 정리', tags: 'LLM, 실험', date: '2026-10-13' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.id, '페르소나-실험-사이트');
    const f = read(root, 'items/페르소나-실험-사이트.md');
    assert.match(f, /topics: \[causal\]/);
    assert.match(f, /tags: \[LLM, 실험\]/);
    assert.doesNotMatch(f, /course:/, '공부 자료엔 과정명 저장 안 함');
    assert.ok(exists(root, 'docs/i/페르소나-실험-사이트.html'));
    assert.equal(store.load(root).topics.find(t => t.id === 'causal').updated, store.today());
    // 같은 제목 -> -2
    const r2 = await call('POST', '/api/items', { isNew: true, title: '페르소나 실험 사이트', section: 'study', kind: 'note', topics: ['kt'] });
    assert.equal(r2.json.id, '페르소나-실험-사이트-2');
  });
});

test('serve: 자료 등록 검증 — 주제 없음, 비밀글+파일, UTF-8 아닌 요청', async () => {
  await withServer(BASIC, async ({ call }) => {
    const cp949 = Buffer.from([0x7b, 0x22, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x22, 0x3a, 0x22, 0xc7, 0xd1, 0x22, 0x7d]); // {"title":"한"} (CP949)
    const enc = await call('POST', '/api/items', cp949);
    assert.equal(enc.status, 400);
    assert.match(enc.json.error, /UTF-8/);
    assert.equal((await call('POST', '/api/items', { isNew: true, title: 'x', section: 'study', topics: [] })).status, 400);
    const r = await call('POST', '/api/items', { isNew: true, title: 'x', section: 'study', topics: ['kt'], kind: 'pdf', url: 'assets/a/b.pdf', secret: true });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /비밀글에는 파일/);
  });
});

test('serve: 비밀 자료는 private/에 저장, 공개로 바꾸면 이동', async () => {
  await withServer(BASIC, async ({ root, call }) => {
    await call('POST', '/api/items', { isNew: true, title: 'secret one', section: 'study', kind: 'note', topics: ['kt'], secret: true });
    assert.ok(exists(root, 'private/items/secret-one.md'));
    assert.ok(!exists(root, 'items/secret-one.md'));
    await call('POST', '/api/items', { id: 'secret-one', title: 'secret one', section: 'study', kind: 'note', topics: ['kt'], secret: false });
    assert.ok(exists(root, 'items/secret-one.md'));
    assert.ok(!exists(root, 'private/items/secret-one.md'));
  });
});

test('serve: 주제 — 2단계 제한, 본문 3절 저장, 삭제 보호', async () => {
  await withServer(BASIC, async ({ root, call }) => {
    let r = await call('POST', '/api/topics', { isNew: true, id: 'akt', title: 'AKT', parent: 'kt' });
    assert.equal(r.status, 400, '하위 주제 아래로는 못 만듦');
    r = await call('POST', '/api/topics', { isNew: true, id: 'Bad Id', title: 'x' });
    assert.equal(r.status, 400);
    r = await call('POST', '/api/topics', { isNew: true, id: 'aig', title: '자동문항생성', parts: { '한 줄 정의': '문항을 자동으로 만든다', '이어서 정리할 것': '- [ ] 템플릿 방식 정리' } });
    assert.equal(r.status, 200);
    const t = read(root, 'topics/aig.md');
    assert.match(t, /## 한 줄 정의\n\n문항을 자동으로 만든다/);
    assert.match(t, /## 지금까지 정리한 것/);
    assert.match(t, /- \[ \] 템플릿 방식 정리/);
    assert.match(read(root, 'docs/index.html'), /data-title="자동문항생성"/);
    // 하위 주제가 있는 la를 다른 주제 아래로 옮기기 금지
    r = await call('POST', '/api/topics', { id: 'la', title: '학습분석', parent: 'aig' });
    assert.equal(r.status, 400);
    // 자료가 붙은 주제 삭제 금지, 하위가 있는 주제 삭제 금지
    assert.equal((await call('DELETE', '/api/topics/kt')).status, 400);
    assert.equal((await call('DELETE', '/api/topics/la')).status, 400);
    assert.equal((await call('DELETE', '/api/topics/aig')).status, 200);
    assert.ok(!exists(root, 'docs/t/aig.html'));
  });
});

test('serve: 등록 후보 — 로컬 스캔(제외 폴더), GitHub 오류는 따로 보고', async () => {
  await withServer(BASIC, async ({ call }) => {
    const r = await call('GET', '/api/candidates');
    assert.equal(r.status, 200);
    const names = r.json.local.files.map(f => f.rel).sort();
    assert.deepEqual(names, ['scan/proj/deep/notes.pdf', 'scan/proj/slide.html']);
    assert.ok(Array.isArray(r.json.github));
  });
});

test('serve: 후보 파일 가져오기 — 관련 리소스 함께, scanDirs 밖 거부, 등록됨 표시', async () => {
  await withServer(BASIC, async ({ root, call, scan }) => {
    const bad = await call('POST', '/api/import-file', { path: path.join(root, 'items', 'dkt-site.md') });
    assert.equal(bad.status, 400);
    const r = await call('POST', '/api/import-file', { path: path.join(scan, 'proj', 'slide.html'), id: 'my slide' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.url, 'assets/my-slide/slide.html');
    assert.equal(r.json.files, 2, 'img/a.png 포함, 상위 폴더·외부 링크 제외');
    assert.ok(exists(root, 'assets/my-slide/img/a.png'));
    await call('POST', '/api/items', { isNew: true, title: 'my slide', section: 'lecture', kind: 'slide', topics: ['causal'], url: r.json.url, source: r.json.source, course: '특강' });
    assert.ok(exists(root, 'docs/assets/my-slide/img/a.png'));
    candidates.clearCache();
    const c = await call('GET', '/api/candidates');
    assert.equal(c.json.local.files.find(f => f.name === 'slide.html').registered, true);
    // 자료 삭제 시 전용 assets 폴더도 정리
    const del = await call('DELETE', '/api/items/my-slide');
    assert.equal(del.status, 200);
    assert.ok(!exists(root, 'assets/my-slide'));
    assert.ok(!exists(root, 'docs/assets/my-slide/slide.html'));
  });
});

test('serve: 파일 업로드', async () => {
  await withServer(BASIC, async ({ root, call }) => {
    const r = await call('POST', '/api/upload?name=report.pdf&id=report', Buffer.from('%PDF-1.4'), { 'Content-Type': 'application/octet-stream' });
    assert.equal(r.status, 200);
    assert.equal(read(root, 'assets/report/report.pdf'), '%PDF-1.4');
    assert.equal((await call('POST', '/api/upload?name=evil.exe', 'x')).status, 400);
  });
});

test('serve: 정적 파일 — 경로 탈출 차단, admin은 docs에 없음', async () => {
  await withServer(BASIC, async ({ root, origin }) => {
    const home = await fetch(origin + '/');
    assert.equal(home.status, 200);
    const admin = await fetch(origin + '/admin/');
    assert.match(await admin.text(), /등록 페이지/);
    const esc = await fetch(origin + '/..%2f..%2fstudylog.config.json');
    assert.notEqual(esc.status, 200);
    assert.ok(!fs.existsSync(path.join(root, 'docs', 'admin')));
  });
});

test('serve: buildwork 미리보기 — 키 없으면 안내, 있으면 계획만 (가짜 Notion)', async () => {
  const buildwork = require('../lib/buildwork');
  const md = require('../lib/md');
  const calls = [];
  const fake = async (url, opt) => {
    calls.push(`${opt.method} ${url.replace('https://api.notion.com/v1', '')}`);
    const ok = body => ({ ok: true, json: async () => body });
    if (url.endsWith('/databases/abc')) return ok({ properties: { studylog_id: { type: 'rich_text' } } });
    if (url.endsWith('/query')) return ok({ results: [
      { id: 'p1', properties: { studylog_id: { rich_text: [{ plain_text: 'old' }] }, '제목': { title: [{ plain_text: 'Old' }] }, '공개여부': { checkbox: true } } },
    ], has_more: false });
    return ok({});
  };
  const items = [
    { id: 'a', title: 'A', public: true, topics: ['kt'], body: '설명', date: '2026-10-01' },
    { id: 'old', title: 'Old', public: false, topics: [], body: '' },
    { id: 's', title: 'S', public: true, secret: true, topics: [], body: '' },
  ];
  await assert.rejects(buildwork.plan({ items, topics: [], config: {}, env: {}, fetchImpl: fake, md }), /NOTION_API_KEY/);
  const p = await buildwork.plan({ items, topics: [{ id: 'kt', title: '지식추적' }], config: { siteUrl: 'https://x/' }, env: { NOTION_API_KEY: 'k', NOTION_RESOURCES_DB_ID: 'abc' }, fetchImpl: fake, md });
  assert.deepEqual(p.actions.map(a => `${a.op}:${a.id}`), ['create:a', 'hide:old']);
  assert.ok(p.warnings.some(w => w.includes('비밀글')));
  assert.equal(calls.filter(c => c.startsWith('PATCH') || c.startsWith('POST /pages')).length, 0, '미리보기에선 쓰기 호출 없음');
  await p.apply();
  assert.ok(calls.includes('POST /pages'));
  assert.ok(calls.includes('PATCH /pages/p1'));
});
