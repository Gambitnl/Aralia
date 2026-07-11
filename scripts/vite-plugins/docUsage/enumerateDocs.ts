import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DocFacts } from './types';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'public', '.tmp', 'vendor', '.gemini',
  '.jules', '.antigravitycli', '.claude', '.cursor', '.codex', '.symphony', 'artifacts',
]);

const LIFECYCLE_STATUSES = new Set(['done', 'retired', 'archived', 'superseded']);

function normalizeTarget(rawTarget: string, docRelDir: string): string | null {
  let t = rawTarget.trim().split('#')[0].replace(/\\/g, '/');
  if (!t) return null;
  if (!t.toLowerCase().endsWith('.md')) {
    if (/^[\w./-]+$/.test(t)) t = `${t}.md`; else return null;
  }
  if (t.startsWith('/')) return t.replace(/^\/+/, '');
  const joined = path.posix.normalize(path.posix.join(docRelDir, t));
  return joined.replace(/^(\.\/)+/, '');
}

function extractFacts(relPath: string, content: string, mtimeMs: number): DocFacts {
  const lf = content.replace(/\r\n/g, '\n');
  const contentHash = crypto.createHash('sha256').update(lf).digest('hex');
  const wordCount = (lf.replace(/[#>*_`-]/g, ' ').match(/\S+/g) || []).length;
  const openTaskCount = (lf.match(/^\s*[-*]\s+\[ \]\s+/gm) || []).length;

  const fm = lf.match(/^---\n([\s\S]*?)\n---/);
  let lifecycleStatus: string | null = null;
  if (fm) {
    const s = fm[1].match(/^status:\s*(.+)$/m);
    if (s && LIFECYCLE_STATUSES.has(s[1].trim().toLowerCase())) lifecycleStatus = s[1].trim().toLowerCase();
  }
  if (relPath.endsWith('~.md')) lifecycleStatus = lifecycleStatus || 'renamed-retired';

  const sup = lf.match(/\b(?:superseded by|see)\s+([\w./-]+\.md|\[[^\]]+\]\(([^)]+)\))\s*(?:instead)?/i);
  let supersededBy: string | null = null;
  if (sup) supersededBy = (sup[2] || sup[1]).replace(/^\[[^\]]*\]\(|\)$/g, '').trim();

  const docRelDir = path.posix.dirname(relPath);
  const targets = new Set<string>();
  for (const m of lf.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const n = normalizeTarget(m[1], docRelDir); if (n) targets.add(n);
  }
  for (const m of lf.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const n = normalizeTarget(m[1], docRelDir); if (n) targets.add(n);
  }
  return {
    path: relPath, contentHash, wordCount, openTaskCount, supersededBy,
    outboundLinkTargets: [...targets], lifecycleStatus, mtimeMs,
  };
}

export function enumerateDocs(rootDir: string): DocFacts[] {
  const out: DocFacts[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!IGNORE_DIRS.has(ent.name)) walk(full); continue; }
      if (ent.isFile() && ent.name.endsWith('.md')) {
        const relPath = path.relative(rootDir, full).replace(/\\/g, '/');
        try {
          const content = fs.readFileSync(full, 'utf-8');
          out.push(extractFacts(relPath, content, fs.statSync(full).mtimeMs));
        } catch { /* unreadable — skip */ }
      }
    }
  };
  walk(rootDir);
  return out;
}
