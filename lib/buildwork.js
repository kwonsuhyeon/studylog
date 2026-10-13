// public: true 자료를 buildwork.kr 강의자료 Notion DB로 내보내기.
// buildwork 쪽 속성: 제목(title) · 내용(rich_text) · 발행일(date) · 공개여부(checkbox) · 썸네일(url)
// 중복 방지 키: DB에 rich_text 속성 "studylog_id"가 있으면 그걸로, 없으면 제목으로 맞춘다.
// 삭제는 하지 않는다 — public이 꺼진 자료는 공개여부만 해제.
const NOTION = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const ID_PROP = 'studylog_id';

const normId = s => String(s || '').replace(/^.*([0-9a-f]{32}).*$/i, '$1').replace(/-/g, '');
const text = s => [{ type: 'text', text: { content: String(s).slice(0, 1900) } }];
const plainOf = rt => (rt || []).map(r => r.plain_text || r.text?.content || '').join('');

function absUrl(it, config) {
  if (!it.url) return `${config.siteUrl}i/${encodeURIComponent(it.id)}.html`;
  return /^https?:/.test(it.url) ? it.url : config.siteUrl + it.url;
}

function summaryOf(it, topicTitle, md) {
  const topics = it.topics.map(topicTitle).join(' · ');
  const desc = md.plain(it.body, 300);
  return [desc, topics ? `주제: ${topics}` : ''].filter(Boolean).join('\n');
}

async function plan({ items, topics, config, env, fetchImpl = globalThis.fetch, md }) {
  const key = env.NOTION_API_KEY;
  const db = normId(env.NOTION_RESOURCES_DB_ID);
  if (!key || !db) throw new Error('.env.local에 NOTION_API_KEY와 NOTION_RESOURCES_DB_ID가 필요해요');
  const headers = { Authorization: `Bearer ${key}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' };
  const call = async (method, url, body) => {
    const r = await fetchImpl(NOTION + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Notion ${r.status}: ${j.message || r.statusText}`);
    return j;
  };

  const schema = await call('GET', `/databases/${db}`);
  const hasIdProp = schema.properties?.[ID_PROP]?.type === 'rich_text';
  const pages = [];
  let cursor;
  do {
    const j = await call('POST', `/databases/${db}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    pages.push(...j.results); cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);

  const keyOf = p => hasIdProp ? plainOf(p.properties[ID_PROP]?.rich_text) : plainOf(p.properties['제목']?.title);
  const existing = new Map(pages.map(p => [keyOf(p), p]).filter(([k]) => k));
  const topicTitle = id => topics.find(t => t.id === id)?.title || id;

  const actions = [];
  const warnings = [];
  if (!hasIdProp) warnings.push(`Notion DB에 "${ID_PROP}"(텍스트) 속성이 없어 제목으로 맞춰요 — 제목을 바꾸면 새 항목이 생겨요`);

  for (const it of items) {
    if (it.secret) { if (it.public) warnings.push(`${it.id}: 비밀글은 public이어도 내보내지 않아요`); continue; }
    const k = hasIdProp ? it.id : it.title;
    const page = existing.get(k);
    if (!it.public) {
      if (page && page.properties['공개여부']?.checkbox) actions.push({ op: 'hide', id: it.id, title: it.title, pageId: page.id });
      continue;
    }
    const props = {
      '제목': { title: text(it.title) },
      '내용': { rich_text: text(summaryOf(it, topicTitle, md)) },
      '공개여부': { checkbox: true },
      ...(it.date ? { '발행일': { date: { start: it.date } } } : {}),
      ...(hasIdProp ? { [ID_PROP]: { rich_text: text(it.id) } } : {}),
    };
    const url = absUrl(it, config);
    if (!page) { actions.push({ op: 'create', id: it.id, title: it.title, props, url }); continue; }
    const same = plainOf(page.properties['제목']?.title) === it.title
      && plainOf(page.properties['내용']?.rich_text) === props['내용'].rich_text[0].text.content
      && page.properties['공개여부']?.checkbox === true
      && (page.properties['발행일']?.date?.start || '') === (it.date || '');
    actions.push({ op: same ? 'keep' : 'update', id: it.id, title: it.title, props, url, pageId: page.id });
  }

  const apply = async () => {
    const done = [];
    for (const a of actions) {
      if (a.op === 'create') {
        await call('POST', '/pages', {
          parent: { database_id: db }, properties: a.props,
          children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '자료 열기 ↗', link: { url: a.url } } }] } }],
        });
      } else if (a.op === 'update') await call('PATCH', `/pages/${a.pageId}`, { properties: a.props });
      else if (a.op === 'hide') await call('PATCH', `/pages/${a.pageId}`, { properties: { '공개여부': { checkbox: false } } });
      else continue;
      done.push(a);
    }
    return done;
  };
  return { actions, warnings, apply };
}

function describe(actions) {
  const label = { create: '새로 만듦', update: '수정', keep: '그대로', hide: '공개 해제' };
  return actions.map(a => `${label[a.op].padEnd(5)}  ${a.title}`);
}

module.exports = { plan, describe, ID_PROP };
