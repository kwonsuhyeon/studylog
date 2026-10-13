// 테스트용 임시 studylog 루트 만들기
const fs = require('fs');
const os = require('os');
const path = require('path');

function makeRoot(files = {}) {
  const root = fs.mkdtempSync(path.join(process.env.STUDYLOG_TEST_TMP || os.tmpdir(), 'studylog-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return root;
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));

// 기본 시나리오: 학습분석 > 지식추적 · 인지진단, 인과효과, 비밀 주제 1, 자료 여러 개
const BASIC = {
  'studylog.config.json': JSON.stringify({ siteTitle: '테스트 지도', staleDays: 60 }),
  'topics/la.md': '---\ntitle: 학습분석\n---\n\n## 한 줄 정의\n\n학습 데이터를 분석해 학습을 돕는 분야\n\n## 지금까지 정리한 것\n\n\n## 이어서 정리할 것\n\n- [ ] 상위 개념도 그리기\n',
  'topics/kt.md': '---\ntitle: 지식추적\nparent: la\nupdated: 2026-10-01\n---\n\n## 한 줄 정의\n\n학습자의 지식 상태를 시간에 따라 추정\n\n## 지금까지 정리한 것\n\nBKT -> DKT 흐름, [[papers:Piech_2015_DKT]]\n\n## 이어서 정리할 것\n\n- [x] BKT 정리\n- [ ] AKT 읽기\n',
  'topics/cdm.md': '---\ntitle: 인지진단\nparent: la\nupdated: 2026-01-01\n---\n\n## 한 줄 정의\n\n속성 숙달 여부 진단\n',
  'topics/causal.md': '---\ntitle: 인과효과\nupdated: 2026-10-10\n---\n\n## 한 줄 정의\n\n개입의 효과 추정\n\n## 이어서 정리할 것\n\n- [ ] 나쁜 통제 사례집\n',
  'private/topics/diary.md': '---\ntitle: 연구 고민 일기\nsecret: true\n---\n\n## 한 줄 정의\n\n비밀스러운 박사 진로 고민\n',
  'items/dkt-site.md': '---\ntitle: DKT 정리 사이트\nsection: study\ntopics: [kt]\nkind: site\nurl: https://kwonsuhyeon.github.io/aigex/\ndate: 2026-10-05\npublic: true\n---\n\nDKT 구조를 그림으로 정리\n',
  'items/causal-lecture.md': '---\ntitle: 인과추론 특강 슬라이드\nsection: lecture\ntopics: [causal, la]\nkind: slide\nurl: assets/causal-lecture/index.html\ndate: 2026-10-12\ncourse: SEM 연구자 특강\n---\n\nSCM 기초 3차시\n',
  'assets/causal-lecture/index.html': '<html><body><img src="fig.png">slide</body></html>',
  'assets/causal-lecture/fig.png': 'PNG',
  'assets/unused/orphan.pdf': 'PDF',
  'private/items/secret-memo.md': '---\ntitle: 지도교수 피드백 메모\nsection: study\ntopics: [diary, kt]\nkind: note\ndate: 2026-10-11\nsecret: true\n---\n\n교수님 말씀: 주제를 좁혀라\n',
  '.env.local': 'STUDYLOG_PIN=correct-horse-9\nSTUDYLOG_PIN_ITER=1000\n',
};

module.exports = { makeRoot, read, exists, BASIC };
