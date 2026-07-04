import fs from 'fs';
import path from 'path';
import type { ReferenceIndex } from './types';

const SCAN_ROOTS = ['src', 'misc', 'scripts', 'public', 'devtools'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);
const DATA_EXT = new Set(['.json', '.yaml', '.yml']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '__tests__']);
const BUILD_FILES = new Set(['vite.config.ts', 'launch.json']);
const MD_TOKEN = /['"`]([^'"`]*\.md)['"`]|`([^`]*\$\{[^`]*\}[^`]*\.md)`/g;

function appLabel(relFile: string): string {
  const parts = relFile.split('/');
  return parts.length > 1 ? parts[1] : parts[0];
}

function isTemplated(token: string): boolean {
  return token.includes('${') || token.includes('*') || token === '.md';
}

function dirPrefix(token: string): string | null {
  const firstDyn = token.search(/\$\{|\*/);
  const head = firstDyn === -1 ? token : token.slice(0, firstDyn);
  const slash = head.lastIndexOf('/');
  if (slash === -1) return null;
  return head.slice(0, slash + 1).replace(/^(\.\/)+/, '');
}

function add(map: Map<string, Set<string>>, key: string, app: string) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(app);
}

export function scanReferences(rootDir: string): ReferenceIndex {
  const idx: ReferenceIndex = {
    fileRefs: new Map(), basenameRefs: new Map(), dirRefs: [],
    dataRefs: new Map(), buildRefs: new Set(),
    diagnostics: { ambiguousRefs: [], unresolvedRefs: [] },
  };
  const seenDir = new Set<string>();

  const handleToken = (raw: string, relFile: string, ext: string) => {
    const token = raw.replace(/^(\.\/)+/, '');
    const app = appLabel(relFile);
    const isBuild = BUILD_FILES.has(path.basename(relFile)) || ext === '.html';
    if (isTemplated(token)) {
      const prefix = dirPrefix(token);
      if (prefix) { const k = `${prefix}::${app}`; if (!seenDir.has(k)) { seenDir.add(k); idx.dirRefs.push({ prefix, app }); } }
      else idx.diagnostics.unresolvedRefs.push(`${relFile}: ${raw}`);
      return;
    }
    if (isBuild) { idx.buildRefs.add(token); return; }
    if (DATA_EXT.has(ext)) { add(idx.dataRefs, token, app); return; }
    if (token.includes('/')) add(idx.fileRefs, token, app);
    else add(idx.basenameRefs, token, app);
  };

  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!IGNORE_DIRS.has(ent.name)) walk(full); continue; }
      const ext = path.extname(ent.name);
      if (!CODE_EXT.has(ext) && !DATA_EXT.has(ext)) continue;
      if (ent.name.includes('.test.') || ent.name.includes('.spec.')) continue;
      const relFile = path.relative(rootDir, full).replace(/\\/g, '/');
      let content: string;
      try { content = fs.readFileSync(full, 'utf-8'); } catch { continue; }
      for (const m of content.matchAll(MD_TOKEN)) handleToken(m[1] || m[2], relFile, ext);
    }
  };

  for (const f of ['vite.config.ts', '.claude/launch.json']) {
    const full = path.join(rootDir, f);
    if (fs.existsSync(full)) {
      const rel = f.replace(/\\/g, '/');
      const content = fs.readFileSync(full, 'utf-8');
      const ext = path.extname(f);
      for (const m of content.matchAll(MD_TOKEN)) handleToken(m[1] || m[2], rel, ext);
    }
  }
  for (const r of SCAN_ROOTS) { const full = path.join(rootDir, r); if (fs.existsSync(full)) walk(full); }
  return idx;
}
