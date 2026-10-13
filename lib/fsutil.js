// Dropbox 폴더 안에서 쓰기 때문에 동기화 중 잠금(EBUSY·EPERM)을 재시도로 넘긴다.
const fs = require('fs');
const path = require('path');

const RETRY = new Set(['EBUSY', 'EPERM', 'EACCES']);
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function withRetry(fn, label, tries = 5) {
  for (let n = 1; ; n++) {
    try { return fn(); } catch (e) {
      if (!RETRY.has(e.code) || n >= tries) { e.message = `${label}: ${e.message}`; throw e; }
      sleepSync(500);
    }
  }
}

// 내용이 같으면 쓰지 않는다 (불필요한 Dropbox 동기화·잠금 충돌을 줄임). 썼으면 true.
function writeIfChanged(file, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  try {
    const old = fs.readFileSync(file);
    if (old.equals(buf)) return false;
  } catch { /* 없음 */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  withRetry(() => fs.writeFileSync(file, buf), file);
  return true;
}

function copyIfChanged(src, dest) {
  return writeIfChanged(dest, fs.readFileSync(src));
}

function removeFile(file) {
  if (!fs.existsSync(file)) return false;
  withRetry(() => fs.unlinkSync(file), file);
  return true;
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => !ext || f.endsWith(ext)).map(f => path.join(dir, f));
}

// dir 아래 모든 파일 (상대 경로)
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

module.exports = { withRetry, writeIfChanged, copyIfChanged, removeFile, listFiles, walk };
