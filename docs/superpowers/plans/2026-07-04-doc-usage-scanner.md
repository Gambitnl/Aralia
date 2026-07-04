# Doc Usage Scanner — Implementation Plan (Feature A, Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cached `/api/docs/usage` backend that, for every project `.md` file, computes a "dead/unused" confidence model from four signal bundles (consumption, linkage, recency, lifecycle) plus duplicate grouping and Atlas-sourced role, and returns it as one JSON payload.

**Architecture:** A set of small pure modules under `scripts/vite-plugins/docUsage/` (enumerate docs, scan code/data/build references, git recency, Atlas roles, confidence combiner, orchestrator), wired into a new route in the existing `devHubApiManager` Vite plugin. Pure modules take plain inputs and return plain data so they unit-test against fixtures with no dev server. The route just calls the orchestrator, caches the result in module scope, and serves it.

**Tech Stack:** Node (CJS-compatible ESM in `scripts/`), TypeScript, Vitest, Node `crypto`/`child_process`, the existing `devHubApiManager` connect-middleware.

## Global Constraints

- **No fallbacks (Remy's directive):** role comes ONLY from the Atlas `docRole` export. If the Atlas export is missing or a doc is unclassified, the scanner sets `diagnostics.atlasMissing = true` and the affected docs get `role: null` — it never guesses role from the path. No silent degradation.
- **False-negative safety:** directory-prefix consumption is inclusive; the "unused" set must err toward under-listing (never mark a consumed doc as unused).
- **Do NOT `git commit`:** the repo auto-commits via a 2 a.m. snapshot. Leave work in the tree; each task ends at "tests green," not a commit.
- **Paths:** every doc/reference path is repo-relative with forward slashes (`/`), matching `/api/docs/list`.
- **Doc set + ignore list:** reuse the exact enumeration of `/api/docs/list` (recursive walk from `process.cwd()`, skipping `node_modules`, `.git`, `dist`, `public`, `.tmp`, `vendor`, `.gemini`, `.jules`, `.antigravitycli`, `.claude`, `.cursor`, `.codex`, `.symphony`, `artifacts`).
- **Test command:** `npx vitest run <path>` (Vitest 4.x; `globals: true` — do not import `afterEach`/`describe`/`it` from vitest in setup files).
- **Stale threshold:** `STALE_DAYS = 180`. **Empty threshold:** `wordCount < 20`.

---

## File Structure

- `scripts/vite-plugins/docUsage/types.ts` — shared interfaces (Task 1).
- `scripts/vite-plugins/docUsage/enumerateDocs.ts` — walk + per-doc facts (Task 1).
- `scripts/vite-plugins/docUsage/scanReferences.ts` — code/data/build reference index (Task 2).
- `scripts/vite-plugins/docUsage/gitRecency.ts` — last-content-commit ages (Task 3).
- `scripts/vite-plugins/docUsage/atlasRoles.ts` — Atlas `docRole` map, loud on absence (Task 4).
- `scripts/vite-plugins/docUsage/confidence.ts` — pure signal combiner (Task 5).
- `scripts/vite-plugins/docUsage/buildDocUsage.ts` — orchestrator producing the payload (Task 6).
- `scripts/vite-plugins/devHubApiManager.ts` — new `/api/docs/usage` route + cache (Task 7).
- `scripts/vite-plugins/__tests__/docUsage.*.test.ts` — one test file per module.

---

### Task 1: Shared types + doc enumerator

**Files:**
- Create: `scripts/vite-plugins/docUsage/types.ts`
- Create: `scripts/vite-plugins/docUsage/enumerateDocs.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.enumerate.test.ts`

**Interfaces:**
- Produces: `enumerateDocs(rootDir: string): DocFacts[]` and all shared types below.

```ts
// types.ts
export interface DocFacts {
  path: string;                    // repo-relative, forward slashes
  contentHash: string;             // sha256 hex of content with CRLF normalized to LF
  wordCount: number;
  openTaskCount: number;           // count of unchecked "- [ ]" list items
  supersededBy: string | null;     // first "superseded by X" / "see X instead" target, else null
  outboundLinkTargets: string[];   // .md targets THIS doc links to (md links + wikilinks), repo-relative-ish
  lifecycleStatus: string | null;  // frontmatter status in {done,retired,archived,superseded} OR "renamed-retired" for ~.md files
  mtimeMs: number;
}

export type RefKind = 'file' | 'dir' | 'data' | 'build';

export interface ReferenceIndex {
  fileRefs: Map<string, Set<string>>;      // exact repo-rel path -> app labels
  basenameRefs: Map<string, Set<string>>;  // basename (e.g. "foo.md") -> app labels
  dirRefs: Array<{ prefix: string; app: string }>; // templated dir prefixes ("docs/x/y/")
  dataRefs: Map<string, Set<string>>;      // path found in a data/config file -> app labels
  buildRefs: Set<string>;                  // paths referenced by build entries
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[] };
}

export interface Candidate {
  isCandidate: boolean;
  reasons: string[];               // human-readable matched signals
  confidence: 'authoritative' | 'high' | 'low' | 'none';
}

export interface DocUsageEntry {
  path: string;
  consumedBy: string[];
  consumedVia: RefKind | null;
  contentHash: string;
  duplicateGroupId: number | null;
  role: string | null;             // from Atlas; null if unclassified/atlas-missing
  ageDays: number;                 // from mtime
  gitAgeDays: number | null;       // last content commit; null if no git history
  wordCount: number;
  openTaskCount: number;
  inboundLinks: number;            // # of OTHER docs whose outboundLinkTargets include this doc
  lifecycle: string | null;
  supersededBy: string | null;
  candidate: Candidate;
}

export interface DocUsagePayload {
  generatedAt: string;
  docs: DocUsageEntry[];
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[]; atlasMissing: boolean };
}
```

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.enumerate.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { enumerateDocs } from '../docUsage/enumerateDocs';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'docenum-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'skip.md'), '# nope');
  fs.writeFileSync(path.join(root, 'docs', 'a.md'),
    '---\nstatus: done\n---\n# A\nsee b.md instead\n- [ ] open one\n- [x] closed\n[link](./c.md)\n');
  fs.writeFileSync(path.join(root, 'docs', 'b.md'), '# B\n[[c]] and [x](d.md)\n');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('enumerateDocs', () => {
  it('skips ignored dirs and captures per-doc facts', () => {
    const facts = enumerateDocs(root);
    const byPath = Object.fromEntries(facts.map(f => [f.path, f]));
    expect(Object.keys(byPath).sort()).toEqual(['docs/a.md', 'docs/b.md']);
    const a = byPath['docs/a.md'];
    expect(a.openTaskCount).toBe(1);
    expect(a.lifecycleStatus).toBe('done');
    expect(a.supersededBy).toBe('b.md');
    expect(a.outboundLinkTargets).toContain('docs/c.md');
    expect(typeof a.contentHash).toBe('string');
    expect(a.contentHash.length).toBe(64);
    expect(byPath['docs/b.md'].outboundLinkTargets.sort()).toEqual(['docs/c.md', 'docs/d.md']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.enumerate.test.ts`
Expected: FAIL — cannot find module `../docUsage/enumerateDocs`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/enumerateDocs.ts
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
    // wikilink [[slug]] with no extension — treat as <slug>.md
    if (/^[\w./-]+$/.test(t)) t = `${t}.md`; else return null;
  }
  if (t.startsWith('/')) return t.replace(/^\/+/, '');
  // resolve relative to the doc's directory
  const joined = path.posix.normalize(path.posix.join(docRelDir, t));
  return joined.replace(/^(\.\/)+/, '');
}

function extractFacts(relPath: string, content: string, mtimeMs: number): DocFacts {
  const lf = content.replace(/\r\n/g, '\n');
  const contentHash = crypto.createHash('sha256').update(lf).digest('hex');
  const wordCount = (lf.replace(/[#>*_`\-]/g, ' ').match(/\S+/g) || []).length;
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
        } catch { /* unreadable file — skip, matches list handler's tolerance */ }
      }
    }
  };
  walk(rootDir);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.enumerate.test.ts`
Expected: PASS (1 test).

---

### Task 2: Code / data / build reference scanner

**Files:**
- Create: `scripts/vite-plugins/docUsage/scanReferences.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.scanRefs.test.ts`

**Interfaces:**
- Consumes: `ReferenceIndex`, `RefKind` from `types.ts`.
- Produces: `scanReferences(rootDir: string): ReferenceIndex`. Classifies each quoted `.md` token in code/data/build files as literal (exact path or basename), templated (→ literal dir prefix), data (found in `.json/.yaml`), or build (found in `vite.config.ts`/`.claude/launch.json`/`*.html`). App label = second path segment of the referencing file (or its top dir).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.scanRefs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { scanReferences } from '../docUsage/scanReferences';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scanref-'));
  fs.mkdirSync(path.join(root, 'src', 'grill'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'spells'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'grill', 'load.ts'),
    `fetch('docs/prompts/grill.md'); const p = 'stray.md';`);
  fs.writeFileSync(path.join(root, 'src', 'spells', 'load.ts'),
    'const u = `docs/spells/reference/${spellId}.md`;');
  fs.writeFileSync(path.join(root, 'src', 'spells', 'data.json'),
    JSON.stringify({ doc: 'docs/data/manifest.md' }));
  fs.writeFileSync(path.join(root, 'vite.config.ts'), `input: 'misc/agent_docs.md'`);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('scanReferences', () => {
  it('classifies literal, templated-dir, data, and build refs', () => {
    const idx = scanReferences(root);
    expect(idx.fileRefs.has('docs/prompts/grill.md')).toBe(true);
    expect([...idx.fileRefs.get('docs/prompts/grill.md')!]).toContain('grill');
    expect(idx.dirRefs.some(d => d.prefix === 'docs/spells/reference/' && d.app === 'spells')).toBe(true);
    expect(idx.dataRefs.has('docs/data/manifest.md')).toBe(true);
    expect(idx.buildRefs.has('misc/agent_docs.md')).toBe(true);
    // "stray.md" is a bare basename with no path -> basenameRefs, not fileRefs
    expect(idx.basenameRefs.has('stray.md')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.scanRefs.test.ts`
Expected: FAIL — cannot find module `../docUsage/scanReferences`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/scanReferences.ts
import fs from 'fs';
import path from 'path';
import type { ReferenceIndex } from './types';

const SCAN_ROOTS = ['src', 'misc', 'scripts', 'public', 'devtools'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);
const DATA_EXT = new Set(['.json', '.yaml', '.yml']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '__tests__']);
const BUILD_FILES = new Set(['vite.config.ts', 'launch.json']);
// token ending in .md inside quotes/backticks; capture the raw token
const MD_TOKEN = /['"`]([^'"`]*\.md)['"`]|`([^`]*\$\{[^`]*\}[^`]*\.md)`/g;

function appLabel(relFile: string): string {
  const parts = relFile.split('/');
  return parts.length > 1 ? parts[1] : parts[0];
}

function isTemplated(token: string): boolean {
  return token.includes('${') || token.includes('*') || token === '.md';
}

function dirPrefix(token: string): string | null {
  // literal directory portion before the first dynamic segment
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

  // build files that live at the repo root
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.scanRefs.test.ts`
Expected: PASS (1 test).

---

### Task 3: Git recency

**Files:**
- Create: `scripts/vite-plugins/docUsage/gitRecency.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.gitRecency.test.ts`

**Interfaces:**
- Produces: `gitAgeDays(rootDir: string, relPaths: string[], now?: number): Map<string, number | null>`. Uses one `git log` per path via `--format=%ct` (last commit unix seconds); returns age in whole days, or `null` when the file has no git history.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.gitRecency.test.ts
import { describe, it, expect } from 'vitest';
import { computeAgeDays } from '../docUsage/gitRecency';

describe('computeAgeDays', () => {
  it('converts a commit timestamp to whole days old', () => {
    const now = 1_000 * 86400 * 1000; // day 1000 in ms
    expect(computeAgeDays(998 * 86400, now)).toBe(2);
    expect(computeAgeDays(null, now)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.gitRecency.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/gitRecency.ts
import { execFileSync } from 'child_process';

export function computeAgeDays(commitSec: number | null, nowMs: number): number | null {
  if (commitSec == null) return null;
  return Math.floor((nowMs - commitSec * 1000) / 86_400_000);
}

export function gitAgeDays(
  rootDir: string, relPaths: string[], now: number = Date.now(),
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const rel of relPaths) {
    let sec: number | null = null;
    try {
      const raw = execFileSync('git', ['log', '-1', '--format=%ct', '--', rel],
        { cwd: rootDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      sec = raw ? parseInt(raw, 10) : null;
    } catch { sec = null; }
    out.set(rel, computeAgeDays(sec, now));
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.gitRecency.test.ts`
Expected: PASS.

---

### Task 4: Atlas role loader (loud on absence)

**Files:**
- Create: `scripts/vite-plugins/docUsage/atlasRoles.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.atlasRoles.test.ts`

**Interfaces:**
- Produces: `loadAtlasRoles(exportPath: string): { roles: Map<string, string>; atlasMissing: boolean }`. Reads the reconciled Atlas knowledge-tree JSON (array `documents[]` with `relativePath` + `docRole`). If the file is absent/unreadable, returns `atlasMissing: true` and an empty map — the orchestrator then leaves `role: null` and surfaces the diagnostic. No path-based guessing.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.atlasRoles.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { loadAtlasRoles } from '../docUsage/atlasRoles';

describe('loadAtlasRoles', () => {
  it('maps relativePath -> docRole from the export', () => {
    const f = path.join(os.tmpdir(), `atlas-${Date.now()}.json`);
    fs.writeFileSync(f, JSON.stringify({ documents: [
      { relativePath: 'docs/x/plan.md', docRole: 'plan' },
      { relativePath: 'README.md', docRole: 'reference' },
    ]}));
    const { roles, atlasMissing } = loadAtlasRoles(f);
    expect(atlasMissing).toBe(false);
    expect(roles.get('docs/x/plan.md')).toBe('plan');
    fs.rmSync(f);
  });
  it('flags atlasMissing when the export is absent (no path fallback)', () => {
    const { roles, atlasMissing } = loadAtlasRoles('/no/such/atlas.json');
    expect(atlasMissing).toBe(true);
    expect(roles.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.atlasRoles.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/atlasRoles.ts
import fs from 'fs';

export function loadAtlasRoles(exportPath: string): { roles: Map<string, string>; atlasMissing: boolean } {
  const roles = new Map<string, string>();
  let raw: string;
  try { raw = fs.readFileSync(exportPath, 'utf-8'); } catch { return { roles, atlasMissing: true }; }
  try {
    const parsed = JSON.parse(raw);
    for (const d of parsed.documents || []) {
      if (d && d.relativePath && d.docRole) roles.set(String(d.relativePath).replace(/\\/g, '/'), String(d.docRole));
    }
  } catch { return { roles, atlasMissing: true }; }
  return { roles, atlasMissing: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.atlasRoles.test.ts`
Expected: PASS (2 tests).

---

### Task 5: Confidence combiner (pure)

**Files:**
- Create: `scripts/vite-plugins/docUsage/confidence.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.confidence.test.ts`

**Interfaces:**
- Consumes: `Candidate` from `types.ts`.
- Produces:
  ```ts
  export interface ConfidenceInput {
    consumed: boolean; inboundLinks: number; gitAgeDays: number | null;
    wordCount: number; isDuplicate: boolean; supersededBy: string | null;
    lifecycle: string | null; inLedger: boolean;
  }
  export function combineConfidence(i: ConfidenceInput): Candidate;
  ```
- Rules (from the spec): authoritative when `lifecycle` set or `inLedger`. `high` when empty (`wordCount < 20`) or `isDuplicate` or `supersededBy`. Candidate (`high`) when `!consumed && (inboundLinks === 0 || (gitAgeDays ?? 0) > 180)`. `!consumed` alone (with inbound links and fresh) → `isCandidate:false, confidence:'low'`, reason listed. Otherwise `none`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.confidence.test.ts
import { describe, it, expect } from 'vitest';
import { combineConfidence } from '../docUsage/confidence';

const base = { consumed: true, inboundLinks: 3, gitAgeDays: 10, wordCount: 500,
  isDuplicate: false, supersededBy: null, lifecycle: null, inLedger: false };

describe('combineConfidence', () => {
  it('lifecycle marker is authoritative', () => {
    const c = combineConfidence({ ...base, lifecycle: 'retired' });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('authoritative');
  });
  it('unused + orphan is a high candidate', () => {
    const c = combineConfidence({ ...base, consumed: false, inboundLinks: 0 });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('high');
    expect(c.reasons.join(' ')).toMatch(/no app|orphan/i);
  });
  it('unused but linked and fresh is low-confidence, not a candidate', () => {
    const c = combineConfidence({ ...base, consumed: false });
    expect(c.isCandidate).toBe(false); expect(c.confidence).toBe('low');
  });
  it('empty doc is a high candidate', () => {
    const c = combineConfidence({ ...base, wordCount: 5 });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('high');
  });
  it('consumed, linked, fresh, non-empty is none', () => {
    expect(combineConfidence(base).confidence).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.confidence.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/confidence.ts
import type { Candidate } from './types';

const STALE_DAYS = 180;
const EMPTY_WORDS = 20;

export interface ConfidenceInput {
  consumed: boolean; inboundLinks: number; gitAgeDays: number | null;
  wordCount: number; isDuplicate: boolean; supersededBy: string | null;
  lifecycle: string | null; inLedger: boolean;
}

export function combineConfidence(i: ConfidenceInput): Candidate {
  const reasons: string[] = [];

  if (i.lifecycle) reasons.push(`marked ${i.lifecycle}`);
  if (i.inLedger) reasons.push('in retirement ledger');
  if (reasons.length) return { isCandidate: true, reasons, confidence: 'authoritative' };

  if (i.wordCount < EMPTY_WORDS) reasons.push('empty/near-empty');
  if (i.isDuplicate) reasons.push('duplicate content');
  if (i.supersededBy) reasons.push(`superseded by ${i.supersededBy}`);
  if (reasons.length) return { isCandidate: true, reasons, confidence: 'high' };

  const stale = (i.gitAgeDays ?? 0) > STALE_DAYS;
  if (!i.consumed && (i.inboundLinks === 0 || stale)) {
    reasons.push('no app consumes it');
    if (i.inboundLinks === 0) reasons.push('orphan (no inbound links)');
    if (stale) reasons.push(`git-stale (${i.gitAgeDays}d)`);
    return { isCandidate: true, reasons, confidence: 'high' };
  }
  if (!i.consumed) return { isCandidate: false, reasons: ['no app consumes it'], confidence: 'low' };
  return { isCandidate: false, reasons: [], confidence: 'none' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.confidence.test.ts`
Expected: PASS (5 tests).

---

### Task 6: Orchestrator — `buildDocUsage`

**Files:**
- Create: `scripts/vite-plugins/docUsage/buildDocUsage.ts`
- Test: `scripts/vite-plugins/__tests__/docUsage.build.test.ts`

**Interfaces:**
- Consumes: `enumerateDocs`, `scanReferences`, `gitAgeDays`, `loadAtlasRoles`, `combineConfidence`, all `types.ts`.
- Produces: `buildDocUsage(rootDir: string, opts?: { atlasPath?: string; ledgerPath?: string; now?: number }): DocUsagePayload`. Resolves consumption per doc (file → dir-prefix → data → build; basename only if unique across the doc set), inverts `outboundLinkTargets` into per-doc `inboundLinks`, groups duplicates by `contentHash`, reads the ledger membership set, joins Atlas roles, and runs the combiner.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/vite-plugins/__tests__/docUsage.build.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { buildDocUsage } from '../docUsage/buildDocUsage';

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'docbuild-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'spells'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'orphans'), { recursive: true });
  // one spell doc consumed via template; one orphan; one dup pair
  fs.writeFileSync(path.join(root, 'src', 'spells.ts'), 'const u = `docs/spells/${id}.md`;');
  fs.writeFileSync(path.join(root, 'docs', 'spells', 'fireball.md'), '# Fireball\n'.repeat(30));
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'lonely.md'), '# Lonely doc with enough words '.repeat(10));
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'dupe1.md'), 'identical body identical body identical');
  fs.writeFileSync(path.join(root, 'docs', 'orphans', 'dupe2.md'), 'identical body identical body identical');
  const atlas = path.join(root, 'atlas.json');
  fs.writeFileSync(atlas, JSON.stringify({ documents: [
    { relativePath: 'docs/spells/fireball.md', docRole: 'reference' },
  ]}));
  (buildDocUsage as any)._atlas = atlas;
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('buildDocUsage', () => {
  it('resolves consumption, duplicates, inbound, roles, candidacy', () => {
    const p = buildDocUsage(root, { atlasPath: path.join(root, 'atlas.json'), now: Date.now() });
    const byPath = Object.fromEntries(p.docs.map(d => [d.path, d]));
    // spell doc: consumed via dir template -> not a candidate
    expect(byPath['docs/spells/fireball.md'].consumedVia).toBe('dir');
    expect(byPath['docs/spells/fireball.md'].candidate.isCandidate).toBe(false);
    expect(byPath['docs/spells/fireball.md'].role).toBe('reference');
    // orphan: not consumed, no inbound -> high candidate
    expect(byPath['docs/orphans/lonely.md'].candidate.confidence).toBe('high');
    // duplicates share a group id
    const g1 = byPath['docs/orphans/dupe1.md'].duplicateGroupId;
    expect(g1).not.toBeNull();
    expect(byPath['docs/orphans/dupe2.md'].duplicateGroupId).toBe(g1);
    // atlas covered only fireball -> others null, diagnostic not "missing" (file existed)
    expect(byPath['docs/orphans/lonely.md'].role).toBeNull();
    expect(p.diagnostics.atlasMissing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.build.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/vite-plugins/docUsage/buildDocUsage.ts
import fs from 'fs';
import path from 'path';
import type { DocUsagePayload, DocUsageEntry, RefKind, ReferenceIndex } from './types';
import { enumerateDocs } from './enumerateDocs';
import { scanReferences } from './scanReferences';
import { gitAgeDays } from './gitRecency';
import { loadAtlasRoles } from './atlasRoles';
import { combineConfidence } from './confidence';

const DEFAULT_ATLAS = '.agent/atlas/knowledge-tree.json';
const DEFAULT_LEDGER = 'docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md';

function resolveConsumption(
  docPath: string, idx: ReferenceIndex, basenameUnique: Set<string>,
): { consumedBy: string[]; via: RefKind | null } {
  const base = path.posix.basename(docPath);
  if (idx.fileRefs.has(docPath)) return { consumedBy: [...idx.fileRefs.get(docPath)!], via: 'file' };
  const dir = idx.dirRefs.filter(d => docPath.startsWith(d.prefix));
  if (dir.length) return { consumedBy: [...new Set(dir.map(d => d.app))], via: 'dir' };
  if (idx.dataRefs.has(docPath)) return { consumedBy: [...idx.dataRefs.get(docPath)!], via: 'data' };
  if (idx.buildRefs.has(docPath)) return { consumedBy: ['build'], via: 'build' };
  if (basenameUnique.has(base) && idx.basenameRefs.has(base))
    return { consumedBy: [...idx.basenameRefs.get(base)!], via: 'file' };
  return { consumedBy: [], via: null };
}

function loadLedger(rootDir: string, ledgerRel: string): Set<string> {
  const set = new Set<string>();
  try {
    const raw = fs.readFileSync(path.join(rootDir, ledgerRel), 'utf-8');
    for (const m of raw.matchAll(/([\w./-]+\.md)/g)) set.add(m[1].replace(/^(\.\/)+/, ''));
  } catch { /* no ledger yet */ }
  return set;
}

export function buildDocUsage(
  rootDir: string, opts: { atlasPath?: string; ledgerPath?: string; now?: number } = {},
): DocUsagePayload {
  const now = opts.now ?? Date.now();
  const facts = enumerateDocs(rootDir);
  const idx = scanReferences(rootDir);
  const { roles, atlasMissing } = loadAtlasRoles(path.isAbsolute(opts.atlasPath || '')
    ? opts.atlasPath! : path.join(rootDir, opts.atlasPath || DEFAULT_ATLAS));
  const ledger = loadLedger(rootDir, opts.ledgerPath || DEFAULT_LEDGER);
  const ages = gitAgeDays(rootDir, facts.map(f => f.path), now);

  // basename uniqueness across the doc set
  const baseCount = new Map<string, number>();
  for (const f of facts) { const b = path.posix.basename(f.path); baseCount.set(b, (baseCount.get(b) || 0) + 1); }
  const basenameUnique = new Set([...baseCount].filter(([, n]) => n === 1).map(([b]) => b));

  // duplicate groups by content hash
  const hashGroups = new Map<string, string[]>();
  for (const f of facts) { if (!hashGroups.has(f.contentHash)) hashGroups.set(f.contentHash, []); hashGroups.get(f.contentHash)!.push(f.path); }
  const dupGroupId = new Map<string, number>();
  let gid = 0;
  for (const [, members] of hashGroups) { if (members.length > 1) { gid += 1; for (const m of members) dupGroupId.set(m, gid); } }

  // inbound link counts (invert outboundLinkTargets)
  const docPaths = new Set(facts.map(f => f.path));
  const inbound = new Map<string, number>();
  for (const f of facts) for (const t of f.outboundLinkTargets)
    if (docPaths.has(t) && t !== f.path) inbound.set(t, (inbound.get(t) || 0) + 1);

  const docs: DocUsageEntry[] = facts.map((f) => {
    const { consumedBy, via } = resolveConsumption(f.path, idx, basenameUnique);
    const inboundLinks = inbound.get(f.path) || 0;
    const gitAge = ages.get(f.path) ?? null;
    const dup = dupGroupId.get(f.path) ?? null;
    const candidate = combineConfidence({
      consumed: consumedBy.length > 0, inboundLinks, gitAgeDays: gitAge,
      wordCount: f.wordCount, isDuplicate: dup != null, supersededBy: f.supersededBy,
      lifecycle: f.lifecycleStatus, inLedger: ledger.has(f.path),
    });
    return {
      path: f.path, consumedBy, consumedVia: via, contentHash: f.contentHash,
      duplicateGroupId: dup, role: roles.get(f.path) ?? null,
      ageDays: Math.floor((now - f.mtimeMs) / 86_400_000), gitAgeDays: gitAge,
      wordCount: f.wordCount, openTaskCount: f.openTaskCount, inboundLinks,
      lifecycle: f.lifecycleStatus, supersededBy: f.supersededBy, candidate,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    docs,
    diagnostics: { ...idx.diagnostics, atlasMissing },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.build.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the whole scanner suite**

Run: `npx vitest run scripts/vite-plugins/__tests__/docUsage.`
Expected: PASS — all six test files green.

---

### Task 7: Wire the `/api/docs/usage` route + cache

**Files:**
- Modify: `scripts/vite-plugins/devHubApiManager.ts` (add a route block beside the existing `/api/docs/list` at ~line 1190; add a module-scope cache near the top of the file, before `export const devHubApiManager`).

**Interfaces:**
- Consumes: `buildDocUsage` from `./docUsage/buildDocUsage`.
- Produces: HTTP `GET /api/docs/usage` → `DocUsagePayload` (cached); `GET /api/docs/usage?refresh=1` recomputes.

- [ ] **Step 1: Add the import and module-scope cache**

At the top of `scripts/vite-plugins/devHubApiManager.ts`, after the existing imports, add:

```ts
import { buildDocUsage } from './docUsage/buildDocUsage';

let _docUsageCache: { generatedAt: string; payload: unknown } | null = null;
```

- [ ] **Step 2: Add the route handler**

Immediately BEFORE the `if (urlPath === '/api/docs/list') {` block (devHubApiManager.ts:1190), insert:

```ts
      if (urlPath === '/api/docs/usage') {
        try {
          const refresh = /[?&]refresh=1\b/.test(req.url || '');
          if (refresh || !_docUsageCache) {
            const payload = buildDocUsage(process.cwd());
            _docUsageCache = { generatedAt: payload.generatedAt, payload };
          }
          json(_docUsageCache.payload);
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }
```

- [ ] **Step 3: Manual verification — start devhub and hit the route**

Run (with a dev server on 3030 already up, or start `npm run dev:hub`):
`curl -s "http://localhost:3030/api/docs/usage" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('docs:',j.docs.length,'| atlasMissing:',j.diagnostics.atlasMissing,'| candidates:',j.docs.filter(d=>d.candidate.isCandidate).length)})"`

Expected: prints a doc count in the thousands, an `atlasMissing` boolean, and a candidate count. If `atlasMissing: true`, that is correct behavior until `npm run atlas -- reconcile` has produced `.agent/atlas/knowledge-tree.json` — the tool reports it rather than guessing roles.

- [ ] **Step 4: Verify the cache + refresh**

Run: `curl -s "http://localhost:3030/api/docs/usage" -o /dev/null -w "%{time_total}\n"` twice, then `curl -s "http://localhost:3030/api/docs/usage?refresh=1" -o /dev/null -w "%{time_total}\n"`.
Expected: the second (cached) call is markedly faster than the first; the `?refresh=1` call is slow again (recomputed).

---

## Self-Review

**Spec coverage (Feature A backend):**
- Bundle 1 Consumption (literal/templated/data/build) → Task 2 + Task 6 `resolveConsumption`. ✓
- Bundle 2 Linkage (inbound links; registry membership via markdown links in registry docs) → Task 1 `outboundLinkTargets` + Task 6 inbound inversion. ✓ (Registry docs' links are ordinary outbound links, so membership is captured without special-casing.)
- Bundle 3 Recency + content (git age, empty, duplicate, superseded) → Task 3 + Task 1 (wordCount/supersededBy/hash) + Task 6 (dup groups). ✓
- Bundle 4 Lifecycle + open-tasks (frontmatter status, `~.md`, ledger, open-task count) → Task 1 + Task 6 `loadLedger`. ✓
- Confidence combiner (never single-signal; authoritative/high/low) → Task 5. ✓
- Role from Atlas, no fallback, fail loud → Task 4 + `atlasMissing` diagnostic. ✓
- Duplicate grouping → Task 6. ✓
- Cached endpoint + refresh → Task 7. ✓
- Diagnostics (ambiguous/unresolved/atlasMissing) → Task 2 + Task 6. ✓

**Placeholder scan:** none — every step ships real code and a runnable command.

**Type consistency:** `DocFacts`, `ReferenceIndex`, `Candidate`, `DocUsageEntry`, `DocUsagePayload`, `ConfidenceInput` are defined once (Tasks 1/5) and referenced with the same field names throughout Task 6. `combineConfidence` signature matches its call site. `resolveConsumption` returns `{ consumedBy, via }` consumed verbatim.

## Out of scope (Plan 2 — the UI)
Folder-tree view, per-doc badges, the used/unused/role/duplicate/confidence filters, headline counts, Rescan button, and diagnostics disclosure in `PreviewMdLibrary.tsx`. Consumes this plan's `/api/docs/usage` payload unchanged.
