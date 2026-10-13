// node check.js — 원본 검증만 (파일을 쓰지 않음). 오류가 있으면 종료 코드 1.
const store = require('./lib/store');

const { errors, valid } = store.validate(store.load());
if (!errors.length) {
  console.log(`✅ 검증 통과 — 주제 ${valid.topics.length} · 자료 ${valid.items.length}`);
} else {
  for (const e of errors) console.log(`❌ ${e.file}: ${e.msg}`);
  console.log(`\n오류 ${errors.length}건`);
  process.exit(1);
}
