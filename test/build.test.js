const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const md = require('../lib/md');
const store = require('../lib/store');
const { build } = require('../build');
const { decrypt } = require('../lib/secret');
const { makeRoot, read, exists, BASIC } = require('./helpers');

const quiet = { log: () => {} };

test('md: frontmatter 왕복', () => {
  const s = md.stringify({ title: 'A: B', topics: ['kt', 'la'], public: true, empty: '' }, 'hello');
  const { data, body } = md.parse(s);
  assert.equal(data.title, 'A: B');
  assert.deepEqual(data.topics, ['kt', 'la']);
  assert.equal(data.public, true);
  assert.equal('empty' in data, false);
  assert.equal(body.trim(), 'hello');
});

test('md: 화살표·체크리스트·표·논문 링크 렌더', () => {
  const h = md.render('A -> B => C\n\n- [ ] 할 일\n- [x] 끝\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[[papers:X_2020|X 논문]] `a->b`');
  assert.match(h, /A → B ⇒ C/);
  assert.match(h, /<input type="checkbox" disabled>/);
  assert.match(h, /<input type="checkbox" checked disabled>/);
  assert.match(h, /<table>.*<th>a<\/th>.*<td>2<\/td>/s);
  assert.match(h, /<a class="pw" data-note="X_2020">X 논문<\/a>/);
  assert.match(h, /<code>a-&gt;b<\/code>/, '코드 안 화살표는 변환하지 않음');
  assert.doesNotMatch(md.render('<script>x</script>'), /<script>/, 'HTML 이스케이프');
  assert.equal(md.plain('환경설정 -> describe() => 끝\n> 인용'), '환경설정 → describe() ⇒ 끝 인용', '요약 텍스트도 화살표 변환');
  // 표 안의 논문 링크 라벨은 \| 로 쓴다
  const t = md.render('| a | b |\n|---|---|\n| x | [[papers:P_1\\|라벨]] |');
  assert.match(t, /<td>x<\/td><td><a class="pw" data-note="P_1">라벨<\/a><\/td>/);
  assert.match(md.render('- [[papers:Q_2\\|라벨2]] 끝'), /data-note="Q_2">라벨2</);
});

test('store: 검증 — 2단계 초과·없는 주제·필수 필드', () => {
  const root = makeRoot({
    'topics/a.md': '---\ntitle: A\n---\n',
    'topics/b.md': '---\ntitle: B\nparent: a\n---\n',
    'topics/c.md': '---\ntitle: C\nparent: b\n---\n',
    'items/x.md': '---\ntitle: X\nsection: study\ntopics: [nope]\n---\n',
    'items/y.md': '---\nsection: oops\ntopics: [a]\nkind: pdf\n---\n',
    'items/z.md': '---\ntitle: Z\nsection: study\ntopics: [a]\nkind: pdf\nurl: assets/none.pdf\n---\n',
  });
  const { errors } = store.validate(store.load(root), root);
  const msgs = errors.map(e => `${e.id}:${e.msg}`).join('\n');
  assert.match(msgs, /c:주제는 2단계까지/);
  assert.match(msgs, /x:없는 주제 id: nope/);
  assert.match(msgs, /y:title 없음/);
  assert.match(msgs, /y:section은/);
  assert.match(msgs, /y:kind=pdf인데 url 없음/);
  assert.match(msgs, /z:파일 없음: assets\/none.pdf/);
});

test('build: 지도·주제·자료 페이지와 상위/하위 주제 집계', () => {
  const root = makeRoot(BASIC);
  const r = build(root, quiet);
  assert.equal(r.topics, 4);
  assert.equal(r.items, 2);
  assert.equal(r.secret, 2);
  const home = read(root, 'docs/index.html');
  // 상위 주제 카드만 지도에, 하위 주제는 칩으로
  assert.match(home, /data-title="학습분석"/);
  assert.doesNotMatch(home, /<article class="topic"[^>]*data-title="지식추적"/);
  assert.match(home, /class="chip "[^>]*>지식추적</);
  // 학습분석 = 지식추적 자료 1(공부) + 직접 연결 강의 1
  assert.match(home, /data-title="학습분석" data-updated="2026-10-12" data-count="2" data-study="1" data-lecture="1"/);
  assert.match(home, /<span class="lbl">다음<\/span>상위 개념도 그리기/);
  // 카드 전체 클릭: 제목 링크가 stretch
  assert.match(home, /<a class="stretch" href="t\/la\.html">학습분석<\/a>/);
  assert.doesNotMatch(home, /class="hero"/, '첫 화면은 소개 없이 바로 카드');
  assert.match(home, /noindex/);
  // 강의 과정 묶음
  assert.match(home, /SEM 연구자 특강/);

  const kt = read(root, 'docs/t/kt.html');
  assert.match(kt, /학습분석<\/a> <span>\/<\/span> <b>지식추적<\/b>/, '경로 표시');
  assert.match(kt, /BKT → DKT/);
  assert.match(kt, /data-key="kt:1"/);
  assert.match(kt, /DKT 정리 사이트/);
  const la = read(root, 'docs/t/la.html');
  assert.match(la, /DKT 정리 사이트/, '상위 주제 페이지에 하위 주제 자료 포함');
  assert.match(la, /class="sub-topics"/);

  const item = read(root, 'docs/i/causal-lecture.html');
  assert.match(item, /href="\.\.\/assets\/causal-lecture\/index.html"/);
  assert.match(item, /<iframe class="preview"/);
});

test('build: assets — 공개 자료가 쓰는 폴더만 복사', () => {
  const root = makeRoot(BASIC);
  build(root, quiet);
  assert.ok(exists(root, 'docs/assets/causal-lecture/index.html'));
  assert.ok(exists(root, 'docs/assets/causal-lecture/fig.png'), '슬라이드 같은 폴더 리소스');
  assert.ok(!exists(root, 'docs/assets/unused/orphan.pdf'));
});

test('build: 비밀글은 평문이 docs에 남지 않고, 맞는 PIN으로만 풀린다', async () => {
  const root = makeRoot(BASIC);
  build(root, quiet);
  const all = fs.readdirSync(path.join(root, 'docs'), { recursive: true })
    .filter(f => fs.statSync(path.join(root, 'docs', f)).isFile())
    .map(f => fs.readFileSync(path.join(root, 'docs', f), 'utf8')).join('\n');
  for (const secretText of ['연구 고민 일기', '지도교수 피드백', '주제를 좁혀라', '박사 진로', 'correct-horse']) {
    assert.ok(!all.includes(secretText), `docs에 평문 노출: ${secretText}`);
  }
  const blob = JSON.parse(read(root, 'docs/secret.json'));
  const data = await decrypt(blob, 'correct-horse-9');
  assert.equal(data.count, 2);
  assert.match(data.html, /연구 고민 일기/);
  assert.match(data.html, /주제를 좁혀라/);
  await assert.rejects(decrypt(blob, 'wrong-pin'));
  assert.doesNotMatch(data.html, /href="t\/diary\.html"/, '비밀 주제 칩은 없는 페이지로 링크하지 않음');
  assert.match(data.html, /href="t\/kt\.html"/, '공개 주제 칩은 링크');
  const search = read(root, 'docs/search.json');
  assert.ok(!search.includes('diary'));
});

test('build: PIN 없으면 비밀글 건너뛰고 경고, 짧은 PIN 경고', () => {
  const noPin = { ...BASIC, '.env.local': '' };
  const r1 = build(makeRoot(noPin), quiet);
  assert.equal(r1.secret, 0);
  assert.ok(r1.warnings.some(w => w.includes('STUDYLOG_PIN이 없어요')));
  const r2 = build(makeRoot({ ...BASIC, '.env.local': 'STUDYLOG_PIN=1234\nSTUDYLOG_PIN_ITER=1000\n' }), quiet);
  assert.ok(r2.warnings.some(w => w.includes('8자 미만')));
});

test('build: 비밀 자료의 assets 파일 금지, 공개 자료→비밀 주제 금지', () => {
  const root = makeRoot({
    ...BASIC,
    'private/items/s2.md': '---\ntitle: S2\nsection: study\ntopics: [kt]\nkind: pdf\nurl: assets/causal-lecture/fig.png\nsecret: true\n---\n',
    'items/leak.md': '---\ntitle: Leak\nsection: study\ntopics: [diary]\nkind: note\n---\n',
  });
  const r = build(root, quiet);
  assert.ok(r.warnings.some(w => w.includes('s2: 비밀글은 assets/')));
  assert.ok(r.warnings.some(w => w.includes('공개 자료가 비밀 주제(diary)')));
  assert.ok(!exists(root, 'docs/i/leak.html'));
});

test('build: 다시 빌드하면 바뀐 파일만 쓰고, 지운 주제의 페이지는 삭제', () => {
  const root = makeRoot(BASIC);
  build(root, quiet);
  const r2 = build(root, quiet);
  assert.equal(r2.written, 1, '바뀐 건 secret.json(매번 새 salt)뿐');
  fs.unlinkSync(path.join(root, 'topics/causal.md'));
  fs.unlinkSync(path.join(root, 'items/causal-lecture.md'));
  const r3 = build(root, quiet);
  assert.ok(!exists(root, 'docs/t/causal.html'));
  assert.ok(!exists(root, 'docs/assets/causal-lecture/index.html'));
  assert.ok(r3.removed >= 3);
});

test('build: indexable 설정', () => {
  const root = makeRoot({ ...BASIC, 'studylog.config.json': JSON.stringify({ indexable: true }) });
  build(root, quiet);
  assert.doesNotMatch(read(root, 'docs/index.html'), /noindex/);
  assert.match(read(root, 'docs/robots.txt'), /Allow/);
});
