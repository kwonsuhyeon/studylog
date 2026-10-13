// 마크다운 원본(frontmatter + 본문) 읽기·쓰기와 HTML 렌더.
// 외부 의존성 없이 studylog에서 쓰는 문법만 다룬다.
//   제목 # ~ ####, 문단, - / 1. 목록, - [ ] 체크리스트, GFM 표, ``` 코드, > 인용, ---
//   인라인: `코드`, **굵게**, *기울임*, [글](url), [[papers:id]], [[papers:id|글]]
//   sh_wiki 공통 규약: -> → , => ⇒ , "<- " ← , "<= " ⇐ (코드 밖에서만)

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- frontmatter ----------

function parseValue(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(x => parseValue(x)).filter(x => x !== '');
  }
  if (v.startsWith('"') && v.endsWith('"')) {
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

function parse(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) data[kv[1]] = parseValue(kv[2]);
  }
  return { data, body: src.slice(m[0].length) };
}

function fmtValue(v) {
  if (Array.isArray(v)) return '[' + v.map(fmtValue).join(', ') + ']';
  if (typeof v === 'boolean') return String(v);
  const s = String(v ?? '');
  if (s === '' || /^[\s]|[\s]$|[:#\[\],"']|^(true|false)$/.test(s)) return JSON.stringify(s);
  return s;
}

function stringify(data, body) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && !(v === '' ))
    .map(([k, v]) => `${k}: ${fmtValue(v)}`);
  const b = String(body || '').replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return `---\n${lines.join('\n')}\n---\n\n${b}\n`;
}

// 본문을 "## 제목" 기준으로 나눈다. 첫 제목 앞 내용은 '' 키.
function sections(body) {
  const out = { '': [] };
  let cur = '';
  for (const line of String(body).replace(/\r\n?/g, '\n').split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1]; out[cur] = []; continue; }
    out[cur].push(line);
  }
  const res = {};
  for (const [k, v] of Object.entries(out)) res[k] = v.join('\n').trim();
  return res;
}

// ---------- 렌더 ----------

function arrows(s) {
  return s.replace(/&lt;-&gt;/g, '↔').replace(/=&gt;/g, '⇒').replace(/-&gt;/g, '→')
    .replace(/&lt;= /g, '⇐ ').replace(/&lt;- /g, '← ');
}

function inline(raw) {
  const codes = [];
  let s = String(raw).replace(/\\\|/g, '|').replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = arrows(s);
  s = s.replace(/\[\[papers:([^\]|]+)\|([^\]]+)\]\]/g, (_, id, t) => `<a class="pw" data-note="${id.trim()}">${t}</a>`);
  s = s.replace(/\[\[papers:([^\]]+)\]\]/g, (_, id) => `<a class="pw" data-note="${id.trim()}">${id.trim()}</a>`);
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\.{0,2}\/|assets\/)[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  return s;
}

// 칸 구분은 이스케이프 안 된 | 만 (\| 는 칸 안의 글자 — 예: [[papers:id\|글]])
function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
}

// opts.checkboxPrefix: 체크박스 id 접두사(있으면 localStorage 저장용 data-key 부여)
function render(md, opts = {}) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0, cb = 0;
  const isBlockStart = l => /^(#{1,4}\s|```|>\s?|\s*[-*]\s|\s*\d+\.\s|\|)/.test(l) || /^---+\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{1,4})\s+(.+)$/))) {
      const lv = Math.min(m[1].length + (opts.headingShift || 0), 6);
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue;
    }
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${render(buf.join('\n'), opts)}</blockquote>`); continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push('<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        let text = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) text += ' ' + lines[i++].trim();
        const c = text.match(/^\[([ xX])\]\s+(.*)$/);
        if (c) {
          const key = opts.checkboxPrefix ? ` data-key="${esc(opts.checkboxPrefix)}:${cb++}"` : '';
          items.push(`<li class="task"><label><input type="checkbox"${c[1] !== ' ' ? ' checked' : ''}${key} disabled> <span>${inline(c[2])}</span></label></li>`);
        } else items.push(`<li>${inline(text)}</li>`);
      }
      const tag = ordered ? 'ol' : 'ul';
      const cls = items.every(x => x.startsWith('<li class="task"')) ? ' class="tasks"' : '';
      out.push(`<${tag}${cls}>${items.join('')}</${tag}>`); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && (buf.length === 0 || !isBlockStart(lines[i]))) buf.push(lines[i++]);
    out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// 체크리스트에서 미완료 항목만 텍스트로
function openTasks(md) {
  return String(md || '').split(/\r?\n/).map(l => l.match(/^\s*[-*]\s+\[ \]\s+(.+)$/)).filter(Boolean).map(m => m[1].trim());
}

// 첫 문단의 일반 텍스트 (요약·검색용)
function plain(md, max = 200) {
  const t = String(md || '').replace(/```[\s\S]*?```/g, '').replace(/^#+\s.*$/gm, '')
    .replace(/\[\[papers:([^\]|]+)(\|([^\]]+))?\]\]/g, (_, id, __, t2) => t2 || id)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<->/g, '↔').replace(/=>/g, '⇒').replace(/->/g, '→').replace(/<= /g, '⇐ ').replace(/<- /g, '← ')
    .replace(/^>\s?/gm, '').replace(/[*`|]/g, '').replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

module.exports = { esc, parse, stringify, sections, render, inline, openTasks, plain };
