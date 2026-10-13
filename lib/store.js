// topics/·items/(공개)와 private/topics·private/items(비밀글) 읽기·검증·저장.
const fs = require('fs');
const path = require('path');
const md = require('./md');
const { writeIfChanged, removeFile, listFiles } = require('./fsutil');

const ROOT = process.env.STUDYLOG_ROOT ? path.resolve(process.env.STUDYLOG_ROOT) : path.resolve(__dirname, '..');

const SECTIONS = ['study', 'lecture'];
const KINDS = ['site', 'slide', 'repo', 'pdf', 'note'];
const SECTION_LABEL = { study: '📚 공부', lecture: '🎓 강의' };
const KIND_LABEL = { site: '🌐 사이트', slide: '🖼 슬라이드', repo: '💻 저장소', pdf: '📄 PDF', note: '📝 노트' };
const TOPIC_PARTS = ['한 줄 정의', '지금까지 정리한 것', '이어서 정리할 것'];

const DEFAULT_CONFIG = {
  siteTitle: 'studylog',
  siteUrl: 'https://kwonsuhyeon.github.io/studylog/',
  githubUser: 'kwonsuhyeon',
  papersWiki: 'http://127.0.0.1:4711',
  staleDays: 60,
  indexable: false,
  scanDirs: [],
  scanSkip: ['node_modules', '.git', '.next', 'dist', '.cache', 'raw', 'sources', '__pycache__', '.venv', 'venv', 'AI_Data', 'data'],
  scanDepth: 4,
  scanMaxFiles: 3000,
  excludeRepos: ['test', 'test.github.io', 'file-upload-test', 'file-upload-test2', 'studylog'],
};

const paths = (root = ROOT) => ({
  root,
  topics: path.join(root, 'topics'),
  items: path.join(root, 'items'),
  privTopics: path.join(root, 'private', 'topics'),
  privItems: path.join(root, 'private', 'items'),
  assets: path.join(root, 'assets'),
  docs: path.join(root, 'docs'),
  config: path.join(root, 'studylog.config.json'),
  env: path.join(root, '.env.local'),
});

function loadConfig(root = ROOT) {
  const p = paths(root).config;
  let user = {};
  if (fs.existsSync(p)) user = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  return { ...DEFAULT_CONFIG, ...user };
}

// .env.local (KEY=VALUE) — 전역 환경변수는 건드리지 않고 객체로만 돌려준다
function loadEnv(root = ROOT) {
  const p = paths(root).env;
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function slugify(title) {
  const s = String(title || '').toLowerCase().normalize('NFC')
    .replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return s || 'item';
}

const isId = id => /^[a-z0-9가-힣][a-z0-9가-힣_-]*$/.test(String(id || ''));

function readDir(dir, secret) {
  return listFiles(dir, '.md').map(file => {
    const { data, body } = md.parse(fs.readFileSync(file, 'utf8'));
    const id = path.basename(file, '.md');
    return { ...data, id, body, secret: secret || data.secret === true, _file: file };
  });
}

function load(root = ROOT) {
  const P = paths(root);
  const topics = [...readDir(P.topics, false), ...readDir(P.privTopics, true)];
  const items = [...readDir(P.items, false), ...readDir(P.privItems, true)];
  for (const t of topics) {
    t.title = t.title || t.id;
    t.parent = t.parent || '';
    t.parts = md.sections(t.body);
  }
  for (const it of items) {
    it.topics = Array.isArray(it.topics) ? it.topics : (it.topics ? [it.topics] : []);
    it.tags = Array.isArray(it.tags) ? it.tags : (it.tags ? [it.tags] : []);
    it.public = it.public === true;
  }
  return { topics, items };
}

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// 검증: { errors: [{file, msg}], valid: {topics, items} }
function validate(state, root = ROOT) {
  const errors = [];
  const err = (o, msg) => errors.push({ file: path.relative(root, o._file || o.id).split(path.sep).join('/'), id: o.id, msg });
  const topicIds = new Map(state.topics.map(t => [t.id, t]));
  const seen = new Set();
  const badTopics = new Set();

  for (const t of state.topics) {
    if (seen.has('t:' + t.id)) { err(t, `주제 id 중복: ${t.id}`); badTopics.add(t); }
    seen.add('t:' + t.id);
    if (!isId(t.id)) { err(t, `주제 id는 영문 소문자·숫자·한글·-·_만: ${t.id}`); badTopics.add(t); }
    if (t.parent) {
      const p = topicIds.get(t.parent);
      if (!p) { err(t, `없는 상위 주제: ${t.parent}`); badTopics.add(t); }
      else if (p.parent) { err(t, `주제는 2단계까지: ${t.parent}도 상위 주제(${p.parent})가 있음`); badTopics.add(t); }
      else if (p.id === t.id) { err(t, '자기 자신을 상위 주제로 지정'); badTopics.add(t); }
      else if (p.secret && !t.secret) { err(t, `공개 주제의 상위 주제(${p.id})가 비밀글`); badTopics.add(t); }
    }
    if (t.updated && !isDate(t.updated)) err(t, `updated 형식은 YYYY-MM-DD: ${t.updated}`);
  }
  const okTopicIds = new Set(state.topics.filter(t => !badTopics.has(t)).map(t => t.id));

  const badItems = new Set();
  for (const it of state.items) {
    const bad = msg => { err(it, msg); badItems.add(it); };
    if (seen.has('i:' + it.id)) bad(`자료 id 중복: ${it.id}`);
    seen.add('i:' + it.id);
    if (!it.title) bad('title 없음');
    if (!SECTIONS.includes(it.section)) bad(`section은 ${SECTIONS.join(' | ')}: ${it.section ?? '(없음)'}`);
    if (!it.topics.length) bad('topics가 비어 있음 (1개 이상)');
    for (const tid of it.topics) {
      if (!okTopicIds.has(tid)) bad(`없는 주제 id: ${tid}`);
      else if (!it.secret && topicIds.get(tid).secret) bad(`공개 자료가 비밀 주제(${tid})에 연결됨`);
    }
    if (it.kind && !KINDS.includes(it.kind)) bad(`kind는 ${KINDS.join(' | ')}: ${it.kind}`);
    if (it.date && !isDate(it.date)) bad(`date 형식은 YYYY-MM-DD: ${it.date}`);
    if (it.url && String(it.url).startsWith('assets/')) {
      const f = path.join(paths(root).assets, String(it.url).slice('assets/'.length));
      if (!fs.existsSync(f)) bad(`파일 없음: ${it.url}`);
    }
    if (!it.url && it.kind && it.kind !== 'note') bad(`kind=${it.kind}인데 url 없음`);
  }
  return {
    errors,
    valid: { topics: state.topics.filter(t => !badTopics.has(t)), items: state.items.filter(i => !badItems.has(i)) },
  };
}

// ---------- 저장 ----------

const ITEM_KEYS = ['title', 'section', 'topics', 'kind', 'url', 'date', 'course', 'tags', 'public', 'secret', 'source'];
const TOPIC_KEYS = ['title', 'parent', 'updated', 'color', 'secret'];

function pick(obj, keys) {
  const o = {};
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'secret' && v !== true) continue;
    o[k] = v;
  }
  return o;
}

function fileFor(kind, id, secret, root = ROOT) {
  const P = paths(root);
  const dir = kind === 'topic' ? (secret ? P.privTopics : P.topics) : (secret ? P.privItems : P.items);
  return path.join(dir, id + '.md');
}

// 저장 위치가 공개<->비밀로 바뀌면 반대쪽 파일을 지운다
function saveDoc(kind, id, data, body, root = ROOT) {
  if (!isId(id)) throw new Error(`id 형식 오류: ${id}`);
  const secret = data.secret === true;
  const keys = kind === 'topic' ? TOPIC_KEYS : ITEM_KEYS;
  const file = fileFor(kind, id, secret, root);
  writeIfChanged(file, md.stringify(pick(data, keys), body));
  removeFile(fileFor(kind, id, !secret, root));
  return file;
}

function deleteDoc(kind, id, root = ROOT) {
  if (!isId(id)) throw new Error(`id 형식 오류: ${id}`);
  const a = removeFile(fileFor(kind, id, false, root));
  const b = removeFile(fileFor(kind, id, true, root));
  return a || b;
}

function uniqueId(base, taken) {
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

function topicBody(parts) {
  return TOPIC_PARTS.map(h => `## ${h}\n\n${(parts[h] || '').trim()}`).join('\n\n');
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

module.exports = {
  ROOT, SECTIONS, KINDS, SECTION_LABEL, KIND_LABEL, TOPIC_PARTS, DEFAULT_CONFIG,
  paths, loadConfig, loadEnv, slugify, isId, load, validate, saveDoc, deleteDoc, uniqueId, topicBody, today,
};
