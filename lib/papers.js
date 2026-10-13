// papers-wiki 논문 노트 읽기 (빌드 시). 주제의 `papers` 태그와 노트 `tags`가 겹치면 관련 논문으로 연결한다.
// 공개 사이트에는 제목·저자·연도만 싣는다. 노트 내용·PDF는 싣지 않는다 (저작권).
// 이 PC에서 열 때만 site/app.js가 papers-wiki 노트와 원문 PDF 링크를 붙인다.
const fs = require('fs');
const path = require('path');
const md = require('./md');

function loadPapers(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const { data } = md.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
    return {
      id: f.slice(0, -3),
      title: String(data.title || f.slice(0, -3)),
      authors: String(data.authors || ''),
      year: String(data.year || ''),
      tags: tags.map(String),
      pdf: data.pdf ? path.basename(String(data.pdf)) : '',
    };
  });
}

// 주제(하위 주제 포함)의 papers 태그와 겹치는 노트. 연도 내림차순.
function papersFor(topicList, papers) {
  const want = new Set(topicList.flatMap(t => Array.isArray(t.papers) ? t.papers : (t.papers ? [t.papers] : [])).map(String));
  if (!want.size) return [];
  return papers.filter(p => p.tags.some(g => want.has(g)))
    .sort((a, b) => (b.year || '').localeCompare(a.year || '') || a.title.localeCompare(b.title));
}

module.exports = { loadPapers, papersFor };
