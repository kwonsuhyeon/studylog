// 등록 후보: GitHub Pages 저장소 + 로컬 폴더의 .html/.pdf
// 로컬 스캔은 깊이·파일 수·시간을 제한한다 (2026_phd처럼 큰 Dropbox 폴더 대비).
const fs = require('fs');
const path = require('path');

const CACHE_MS = 10 * 60 * 1000;
let ghCache = { at: 0, user: '', data: null };
let localCache = { at: 0, key: '', data: null };

async function githubPages(config, { fetchImpl = globalThis.fetch, force = false } = {}) {
  const now = Date.now();
  if (!force && ghCache.data && ghCache.user === config.githubUser && now - ghCache.at < CACHE_MS) return ghCache.data;
  const res = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(config.githubUser)}/repos?per_page=100&sort=updated`, {
    headers: { 'User-Agent': 'studylog', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const repos = await res.json();
  const skip = new Set(config.excludeRepos || []);
  const data = repos.filter(r => r.has_pages).map(r => ({
    source: 'github',
    name: r.name,
    title: r.description && !/업로드 테스트/.test(r.description) ? r.description : r.name,
    url: r.name.toLowerCase() === `${config.githubUser}.github.io`.toLowerCase()
      ? `https://${config.githubUser}.github.io/` : `https://${config.githubUser}.github.io/${r.name}/`,
    repo: r.html_url,
    date: (r.pushed_at || r.updated_at || '').slice(0, 10),
    kind: 'site',
    excluded: skip.has(r.name) || /^test|upload-test/i.test(r.name),
  }));
  ghCache = { at: now, user: config.githubUser, data };
  return data;
}

async function scanLocal(config, { force = false, budgetMs = 15000 } = {}) {
  const dirs = (config.scanDirs || []).filter(Boolean);
  const key = JSON.stringify([dirs, config.scanSkip, config.scanDepth]);
  const now = Date.now();
  if (!force && localCache.data && localCache.key === key && now - localCache.at < CACHE_MS) return localCache.data;
  const skip = new Set((config.scanSkip || []).map(s => s.toLowerCase()));
  const maxDepth = config.scanDepth ?? 4;
  const maxFiles = config.scanMaxFiles ?? 3000;
  const deadline = now + budgetMs;
  const files = [];
  let truncated = false;

  async function walk(dir, depth, rootDir) {
    if (files.length >= maxFiles || Date.now() > deadline) { truncated = true; return; }
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= maxFiles || Date.now() > deadline) { truncated = true; return; }
      if (e.name.startsWith('.') && e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name.toLowerCase()) && depth < maxDepth) await walk(p, depth + 1, rootDir);
      } else if (/\.(html?|pdf)$/i.test(e.name)) {
        let st; try { st = await fs.promises.stat(p); } catch { continue; }
        files.push({
          source: 'local',
          name: e.name,
          title: e.name.replace(/\.(html?|pdf)$/i, '').replace(/[_-]+/g, ' ').trim(),
          path: p,
          rel: path.relative(path.dirname(rootDir), p).split(path.sep).join('/'),
          date: new Date(st.mtimeMs).toISOString().slice(0, 10),
          size: st.size,
          kind: /\.pdf$/i.test(e.name) ? 'pdf' : 'slide',
        });
      }
    }
  }
  for (const d of dirs) await walk(path.resolve(d), 1, path.resolve(d));
  files.sort((a, b) => b.date.localeCompare(a.date));
  const data = { files, truncated, scannedAt: new Date().toISOString() };
  localCache = { at: now, key, data };
  return data;
}

// HTML 안의 상대 경로 리소스(src·href) — 같은 폴더 기준으로 함께 복사할 파일 목록
function htmlRelatedFiles(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dir = path.dirname(htmlPath);
  const out = new Set();
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)) {
    const ref = m[1].trim();
    if (!ref || /^(?:[a-z]+:|\/\/|\/)/i.test(ref)) continue;
    const abs = path.resolve(dir, decodeURI(ref));
    if (!abs.startsWith(dir + path.sep)) continue; // 상위 폴더로 나가는 경로는 제외
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(path.relative(dir, abs));
  }
  return [...out];
}

function clearCache() { ghCache = { at: 0, user: '', data: null }; localCache = { at: 0, key: '', data: null }; }

module.exports = { githubPages, scanLocal, htmlRelatedFiles, clearCache };
