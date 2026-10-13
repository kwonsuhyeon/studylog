// 브라우저 E2E 점검 (수동 실행): node --experimental-websocket test/e2e.js
// 임시 데이터로 테스트 서버(STUDYLOG_E2E_PORT, 기본 4761)를 띄우고, 헤드리스 Chrome을 DevTools 프로토콜로 조종한다.
// 사용자 서버(4750)·사용자 데이터는 건드리지 않는다.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('../serve');
const { makeRoot, BASIC } = require('./helpers');

const PORT = Number(process.env.STUDYLOG_E2E_PORT) || 4761;
const CDP_PORT = 9333;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`); };

async function main() {
  const root = makeRoot({ ...BASIC, 'studylog.config.json': JSON.stringify({ siteTitle: 'E2E 지도', staleDays: 60, scanDirs: [], papersDir: 'pw' }),
    'topics/kt.md': BASIC['topics/kt.md'].replace('parent: la\n', 'parent: la\npapers: [지식추적]\n'),
    'pw/Piech_2015_DKT.md': '---\ntitle: Deep Knowledge Tracing\nauthors: Piech et al.\nyear: 2015\ntags: [지식추적]\npdf: raw/papers/Piech_2015_DKT.pdf\n---\n' });
  const server = createServer({ root });
  server.rebuild();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const O = `http://127.0.0.1:${PORT}`;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'studylog-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${prof}`, '--window-size=1400,1200', 'about:blank'], { stdio: 'ignore' });
  try {
    let tabs;
    for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); break; } catch { await sleep(200); } }
    const page = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0; const waiting = new Map(); const dialogs = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
      if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
    });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    const evalJs = async expr => {
      const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error');
      return r.result?.result?.value;
    };
    const go = async url => { await send('Page.navigate', { url }); await sleep(900); };
    const until = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evalJs(`return !!(${expr})`)) return true; await sleep(150); } return false; };

    // ---------- 홈: 필터·정렬 ----------
    await go(`${O}/`);
    check('홈: 상위 주제 카드 2장 (학습분석·인과효과)', await evalJs(`return document.querySelectorAll('#map .topic').length`) === 2);
    await evalJs(`document.querySelector('.fchip[data-filter=lecture]').click()`);
    let r = await evalJs(`return { url: location.search, hidden: [...document.querySelectorAll('#map .topic')].filter(c=>c.hidden).map(c=>c.dataset.title), courses: !document.querySelector('#courses').hidden, recent: [...document.querySelectorAll('.recent .item')].filter(i=>!i.hidden).length }`);
    check('강의 필터: URL ?filter=lecture', r.url === '?filter=lecture', r.url);
    check('강의 필터: 강의 자료 있는 주제만 (둘 다 강의 1)', r.hidden.length === 0, JSON.stringify(r.hidden));
    check('강의 필터: 과정별 묶음 표시', r.courses);
    check('강의 필터: 최근 자료도 강의만', r.recent === 1, r.recent);
    await evalJs(`document.querySelector('.fchip[data-filter=study]').click()`);
    r = await evalJs(`return [...document.querySelectorAll('#map .topic')].filter(c=>!c.hidden).map(c=>c.dataset.title)`);
    check('공부 필터: 공부 자료 없는 인과효과 숨김', JSON.stringify(r) === JSON.stringify(['학습분석']), JSON.stringify(r));
    await evalJs(`const s=document.querySelector('#sort'); s.value='title'; s.dispatchEvent(new Event('change'))`);
    await go(`${O}/?sort=title`);
    r = await evalJs(`return { order: [...document.querySelectorAll('#map .topic')].map(c=>c.dataset.title), sel: document.querySelector('#sort').value }`);
    check('정렬 유지: ?sort=title 로 다시 열면 이름순', r.sel === 'title' && r.order[0] === '인과효과', JSON.stringify(r));

    // ---------- 카드 전체 클릭 ----------
    await go(`${O}/`);
    r = await evalJs(`const c=document.querySelector('#map .topic[data-title="인과효과"]'); const b=c.getBoundingClientRect(); const el=document.elementFromPoint(b.left+b.width/2, b.bottom-12); return { tag: el.tagName, href: el.closest('a')?.getAttribute('href') }`);
    check('카드 아래쪽 빈 곳을 눌러도 주제 페이지로', r.href === 't/causal.html', JSON.stringify(r));
    r = await evalJs(`const c=document.querySelector('#map .topic[data-title="학습분석"] .chips .chip'); const b=c.getBoundingClientRect(); return document.elementFromPoint(b.left+b.width/2, b.top+b.height/2).closest('a')?.getAttribute('href')`);
    check('카드 안 하위 주제 칩은 칩대로 눌림', r === 't/kt.html' || r === 't/cdm.html', r);
    await go(`${O}/`);
    r = await evalJs(`const it=document.querySelector('.recent .item.linked'); it.scrollIntoView({block:'center', behavior:'instant'}); const b=it.getBoundingClientRect(); const el=document.elementFromPoint(b.left+12, b.top+b.height/2); return { href: el.closest('a')?.getAttribute('href') }`);
    check('자료 카드도 전체 클릭 → 자료 페이지', /^i\//.test(r.href || ''), JSON.stringify(r));

    // ---------- 검색 ----------
    await evalJs(`const q=document.querySelector('#q'); q.value='지식'; q.dispatchEvent(new Event('input'))`);
    await until(`!document.querySelector('#results').hidden`);
    r = await evalJs(`return document.querySelector('#results').innerText`);
    check('검색 "지식": 주제(지식추적) 표시', /지식추적/.test(r), r);
    await evalJs(`const q=document.querySelector('#q'); q.value='없는말zzz'; q.dispatchEvent(new Event('input'))`);
    await sleep(300);
    check('검색 결과 없음 문구', /일치하는 자료가 없습니다/.test(await evalJs(`return document.querySelector('#results').innerText`)));
    await evalJs(`const q=document.querySelector('#q'); q.value='연구 고민'; q.dispatchEvent(new Event('input'))`);
    await sleep(300);
    check('검색에 비밀글 안 나옴', /일치하는 자료가 없습니다/.test(await evalJs(`return document.querySelector('#results').innerText`)));

    // ---------- 🔒 비밀글 ----------
    check('비밀글: 잠긴 상태로 제목 안 보임', !(await evalJs(`return document.body.innerText`)).includes('연구 고민 일기'));
    await evalJs(`document.querySelector('#pin').value='틀린핀1234'; document.querySelector('#pin-form').requestSubmit()`);
    check('비밀글: 틀린 PIN 안내', await until(`document.querySelector('#pin-msg').textContent.includes('맞지 않습니다')`));
    await evalJs(`document.querySelector('#pin').value='correct-horse-9'; document.querySelector('#pin-form').requestSubmit()`);
    check('비밀글: 맞는 PIN이면 열림', await until(`document.querySelector('#secret-body').innerText.includes('연구 고민 일기')`));
    await go(`${O}/`);
    check('비밀글: 새로고침해도 이 탭에선 열린 상태 (sessionStorage)', await until(`!document.querySelector('#secret-body').hidden && document.querySelector('#secret-body').textContent.includes('주제를 좁혀라')`),
      JSON.stringify(await evalJs(`return { ss: sessionStorage.getItem('studylog-pin'), hidden: document.querySelector('#secret-body').hidden, text: document.querySelector('#secret-body').innerText.slice(0, 200), msg: document.querySelector('#pin-msg').textContent }`)));
    await evalJs(`document.querySelector('#relock').click()`);
    await sleep(900);
    check('비밀글: 잠그기 누르면 다시 잠김', await evalJs(`return document.querySelector('#secret-body').hidden && !sessionStorage.getItem('studylog-pin')`));

    // ---------- 주제 페이지 ----------
    await go(`${O}/t/la.html`);
    r = await evalJs(`return { stale: [...document.querySelectorAll('.upd.stale')].map(e=>e.textContent), kids: document.querySelectorAll('.sub-topics .topic').length }`);
    check('주제 페이지: 하위 주제 카드 2장', r.kids === 2, r.kids);
    check('주제 페이지: 60일 넘은 인지진단에 "n일째 수정 없음"', r.stale.some(t => /\d+일째 수정 없음/.test(t)), JSON.stringify(r.stale));
    await go(`${O}/t/kt.html`);
    r = await evalJs(`return { href: document.querySelector('a.pw')?.href, cb: document.querySelectorAll('ul.tasks input[type=checkbox]').length, checked: document.querySelectorAll('ul.tasks input:checked').length }`);
    check('논문 링크: 로컬에선 papers-wiki(4711)로', /127\.0\.0\.1:4711\/#Piech_2015_DKT/.test(r.href || ''), r.href);
    const pr = await evalJs(`const li=document.querySelector('li.paper'); return { note: li.querySelector('a.p-title')?.href, pdf: li.querySelector('a.p-pdf')?.href }`);
    check('관련 논문: 이 PC에선 노트 링크', /127\.0\.0\.1:4711\/#Piech_2015_DKT$/.test(pr.note || ''), JSON.stringify(pr));
    check('관련 논문: 이 PC에선 원문 PDF 링크', /127\.0\.0\.1:4711\/pdf\/Piech_2015_DKT\.pdf$/.test(pr.pdf || ''), JSON.stringify(pr));
    check('이어서 정리할 것: 실제 체크박스 2개(1개 완료)', r.cb === 2 && r.checked === 1, JSON.stringify(r));

    // ---------- 등록 페이지 ----------
    await go(`${O}/admin/`);
    await until(`document.querySelectorAll('#topic-picks input').length > 0`);
    r = await evalJs(`return { course: document.querySelector('.course-field').hidden, upload: getComputedStyle(document.querySelector('#upload')).display }`);
    check('등록: 공부 선택 시 강의 과정명 숨김', r.course === true);
    check('등록: 파일 input 자체는 숨김', r.upload === 'none', r.upload);
    await evalJs(`const l=document.querySelector('input[name=section][value=lecture]'); l.checked=true; l.dispatchEvent(new Event('change'))`);
    check('등록: 강의 선택 시 과정명 칸 표시', await evalJs(`return !document.querySelector('.course-field').hidden`));
    await evalJs(`
      const F=document.querySelector('#item-form');
      F.title.value='E2E 강의 슬라이드'; F.kind.value='note'; F.course.value='E2E 과정'; F.body.value='브라우저에서 등록 -> 확인';
      document.querySelector('#topic-picks input[value=kt]').checked=true;
      F.requestSubmit();`);
    check('등록: 저장하면 목록에 추가', await until(`document.querySelector('#item-list').innerText.includes('E2E 강의 슬라이드')`));
    const saved = fs.readFileSync(path.join(root, 'items', 'e2e-강의-슬라이드.md'), 'utf8');
    check('등록: md 파일 내용 (과정·주제·본문)', /course: E2E 과정/.test(saved) && /topics: \[kt\]/.test(saved) && /브라우저에서 등록 -> 확인/.test(saved), saved);
    check('등록: 사이트에 반영 (자료 페이지 생성)', (await fetch(`${O}/i/${encodeURIComponent('e2e-강의-슬라이드')}.html`)).status === 200);
    // 수정
    await evalJs(`[...document.querySelectorAll('#item-list tr')].find(tr=>tr.innerText.includes('E2E 강의'))?.querySelector('a[data-act=edit]').click()`);
    r = await evalJs(`return { title: document.querySelector('#item-form-title').textContent, course: document.querySelector('#item-form').course.value }`);
    check('수정: 목록에서 누르면 폼에 채워짐', /자료 수정/.test(r.title) && r.course === 'E2E 과정', JSON.stringify(r));
    await evalJs(`const F=document.querySelector('#item-form'); F.title.value='E2E 강의 슬라이드 (수정)'; F.requestSubmit()`);
    check('수정: 같은 id로 저장 (새 파일 안 생김)', await until(`document.querySelector('#item-list').innerText.includes('(수정)')`) && !fs.existsSync(path.join(root, 'items', 'e2e-강의-슬라이드-수정.md')));
    // 삭제 (confirm 자동 수락)
    await evalJs(`[...document.querySelectorAll('#item-list tr')].find(tr=>tr.innerText.includes('E2E 강의'))?.querySelector('a[data-act=del]').click()`);
    check('삭제: 확인창 뜬 뒤 삭제', await until(`!document.querySelector('#item-list').innerText.includes('E2E 강의')`) && dialogs.some(d => d.includes('삭제할까요')));

    // 주제 관리
    await evalJs(`document.querySelector('.tab[data-tab=topics]').click()`);
    await evalJs(`document.querySelector('#topic-tree li[data-id=kt]').click()`);
    r = await evalJs(`const T=document.querySelector('#topic-form'); return { title: T.title.value, parent: T.parent.value, p2: T.p2.value, ro: T.id.readOnly }`);
    check('주제 편집: 기존 값 채워짐 (상위=학습분석, 체크리스트)', r.title === '지식추적' && r.parent === 'la' && /AKT 읽기/.test(r.p2) && r.ro, JSON.stringify(r));
    await evalJs(`const T=document.querySelector('#topic-form'); T.p2.value += '\\n- [ ] E2E 추가 과제'; T.requestSubmit()`);
    await sleep(1200);
    check('주제 편집: 저장하면 사이트 주제 페이지에 반영', (await (await fetch(`${O}/t/kt.html`)).text()).includes('E2E 추가 과제'));
    await evalJs(`document.querySelector('#topic-new').click(); const T=document.querySelector('#topic-form'); T.title.value='에러 주제'; T.id.value='err'; T.parent.value='la'; T.requestSubmit()`);
    await sleep(800);
    check('주제 추가: 하위 주제로 만들기 성공', fs.existsSync(path.join(root, 'topics', 'err.md')));
    r = await evalJs(`return [...document.querySelectorAll('#topic-form select[name=parent] option')].map(o=>o.value)`);
    check('상위 주제 선택지에 하위 주제(kt)는 없음 (2단계 제한)', !r.includes('kt'), JSON.stringify(r));
  } finally {
    chrome.kill();
    server.closeAllConnections(); server.close();
  }
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
