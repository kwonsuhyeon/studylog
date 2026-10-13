// node publish.js          — buildwork.kr로 내보낼 내용 미리보기 (Notion을 바꾸지 않음)
// node publish.js --apply  — 실제 반영
const store = require('./lib/store');
const md = require('./lib/md');
const buildwork = require('./lib/buildwork');

async function main() {
  const apply = process.argv.includes('--apply');
  const { valid } = store.validate(store.load());
  const p = await buildwork.plan({ items: valid.items, topics: valid.topics, config: store.loadConfig(), env: store.loadEnv(), md });
  for (const w of p.warnings) console.log(`⚠ ${w}`);
  const lines = buildwork.describe(p.actions);
  console.log(lines.length ? lines.join('\n') : '내보낼 자료가 없어요 (public: true인 자료 없음)');
  if (!apply) { console.log('\n미리보기만 했어요. 반영하려면 node publish.js --apply'); return; }
  const done = await p.apply();
  console.log(`\n✅ Notion 반영 ${done.length}건`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
