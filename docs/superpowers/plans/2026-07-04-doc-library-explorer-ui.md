# Doc Library Explorer UI — Implementation Plan (Feature A, Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a folder-tree view, per-doc badges (role / age / consumed-by-app / duplicate / open-tasks / retirement-candidate), the four new filters (consumed, role, duplicate, confidence), a headline count bar, a Rescan button, and a diagnostics disclosure to the Doc Library — all driven by the `/api/docs/usage` payload from Plan 1.

**Architecture:** Three small pure helper modules (a typed client, a tree builder, a filter predicate) hold the testable logic; `PreviewMdLibrary.tsx` gains state + effects that fetch `/api/docs/usage`, merge it onto the existing `DocFile[]` by `path`, and render the new controls/badges/tree. The existing flat list, editor, category/status filters, and safe-delete flow are untouched and keep working.

**Tech Stack:** React 18 + TypeScript, Vitest (pure utils), Tailwind classes (match existing), the running Doc Library dev server for live verification.

## Global Constraints

- **Depends on Plan 1:** consumes `GET /api/docs/usage` → `DocUsagePayload` unchanged. Do not modify the backend here.
- **Additive only:** the flat list, editor, and delete flow must keep working. New view is a toggle, new filters default to "all".
- **Do NOT `git commit`:** the 2 a.m. snapshot handles commits. Each task ends at "tests green" / "eyeballed working".
- **Verify UI changes live (Remy's visual-inspection rule):** component tasks end with a real browser check via the preview tools, not just a screenshot. Serve the Doc Library at `misc/md_library.html` on a full dev server (`npm run dev:hub`, port 3030) — `/api/docs/usage` only exists there, not on the static planmap server.
- **Paths** are repo-relative with `/`. **Test command:** `npx vitest run <path>`.
- **Merge key:** `DocFile.path` === `DocUsageEntry.path` (both from the same enumeration).

## File Structure

- `src/components/DesignPreview/steps/docLibrary/docUsageClient.ts` — client type + `fetchDocUsage()` + `indexByPath()` (Task 1).
- `src/components/DesignPreview/steps/docLibrary/buildDocTree.ts` — pure flat-paths → tree (Task 2).
- `src/components/DesignPreview/steps/docLibrary/docUsageFilter.ts` — pure filter predicate (Task 3).
- `src/components/DesignPreview/steps/PreviewMdLibrary.tsx` — state/effects/render wiring (Tasks 4-8).
- `src/components/DesignPreview/steps/docLibrary/__tests__/*.test.ts` — util tests.

---

### Task 1: Typed usage client + path index

**Files:**
- Create: `src/components/DesignPreview/steps/docLibrary/docUsageClient.ts`
- Test: `src/components/DesignPreview/steps/docLibrary/__tests__/docUsageClient.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DocUsage {
    path: string; consumedBy: string[]; consumedVia: 'file'|'dir'|'data'|'build'|null;
    duplicateGroupId: number|null; role: string|null; ageDays: number; gitAgeDays: number|null;
    wordCount: number; openTaskCount: number; inboundLinks: number;
    lifecycle: string|null; supersededBy: string|null;
    candidate: { isCandidate: boolean; reasons: string[]; confidence: 'authoritative'|'high'|'low'|'none' };
  }
  export interface DocUsageResponse {
    generatedAt: string; docs: DocUsage[];
    diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[]; atlasMissing: boolean };
  }
  export function indexByPath(docs: DocUsage[]): Record<string, DocUsage>;
  export function fetchDocUsage(refresh?: boolean): Promise<DocUsageResponse>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// docUsageClient.test.ts
import { describe, it, expect } from 'vitest';
import { indexByPath, type DocUsage } from '../docUsageClient';

const mk = (p: string): DocUsage => ({
  path: p, consumedBy: [], consumedVia: null, duplicateGroupId: null, role: null,
  ageDays: 0, gitAgeDays: null, wordCount: 100, openTaskCount: 0, inboundLinks: 0,
  lifecycle: null, supersededBy: null, candidate: { isCandidate: false, reasons: [], confidence: 'none' },
});

describe('indexByPath', () => {
  it('keys entries by path', () => {
    const idx = indexByPath([mk('docs/a.md'), mk('docs/b.md')]);
    expect(idx['docs/a.md'].path).toBe('docs/a.md');
    expect(Object.keys(idx)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/__tests__/docUsageClient.test.ts`
Expected: FAIL — cannot find module `../docUsageClient`.

- [ ] **Step 3: Write minimal implementation**

```ts
// docUsageClient.ts
export interface DocUsage {
  path: string; consumedBy: string[]; consumedVia: 'file'|'dir'|'data'|'build'|null;
  duplicateGroupId: number|null; role: string|null; ageDays: number; gitAgeDays: number|null;
  wordCount: number; openTaskCount: number; inboundLinks: number;
  lifecycle: string|null; supersededBy: string|null;
  candidate: { isCandidate: boolean; reasons: string[]; confidence: 'authoritative'|'high'|'low'|'none' };
}
export interface DocUsageResponse {
  generatedAt: string; docs: DocUsage[];
  diagnostics: { ambiguousRefs: string[]; unresolvedRefs: string[]; atlasMissing: boolean };
}
export function indexByPath(docs: DocUsage[]): Record<string, DocUsage> {
  const out: Record<string, DocUsage> = {};
  for (const d of docs) out[d.path] = d;
  return out;
}
export async function fetchDocUsage(refresh = false): Promise<DocUsageResponse> {
  const res = await fetch(`/api/docs/usage${refresh ? '?refresh=1' : ''}`);
  if (!res.ok) throw new Error(`doc usage load failed (${res.status})`);
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/__tests__/docUsageClient.test.ts`
Expected: PASS.

---

### Task 2: Pure folder-tree builder

**Files:**
- Create: `src/components/DesignPreview/steps/docLibrary/buildDocTree.ts`
- Test: `src/components/DesignPreview/steps/docLibrary/__tests__/buildDocTree.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TreeNode {
    name: string; path: string; isDir: boolean;
    children: TreeNode[]; docCount: number;   // # of leaf docs at/under this node
  }
  export function buildDocTree(paths: string[]): TreeNode;  // returns a synthetic root
  ```
  Directories sort before files; both alphabetical. `docCount` on a dir = total leaf docs beneath it.

- [ ] **Step 1: Write the failing test**

```ts
// buildDocTree.test.ts
import { describe, it, expect } from 'vitest';
import { buildDocTree } from '../buildDocTree';

describe('buildDocTree', () => {
  it('nests paths into dirs+files with counts', () => {
    const root = buildDocTree(['docs/a/x.md', 'docs/a/y.md', 'docs/b.md']);
    expect(root.docCount).toBe(3);
    const docs = root.children.find(c => c.name === 'docs')!;
    expect(docs.isDir).toBe(true);
    expect(docs.docCount).toBe(3);
    const dirA = docs.children.find(c => c.name === 'a')!;
    expect(dirA.isDir).toBe(true);
    expect(dirA.docCount).toBe(2);
    // dirs before files within docs/
    expect(docs.children.map(c => c.name)).toEqual(['a', 'b.md']);
    expect(dirA.children.map(c => c.path)).toEqual(['docs/a/x.md', 'docs/a/y.md']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/__tests__/buildDocTree.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// buildDocTree.ts
export interface TreeNode {
  name: string; path: string; isDir: boolean; children: TreeNode[]; docCount: number;
}

export function buildDocTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [], docCount: 0 };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isDir = i < parts.length - 1;
      let child = node.children.find(c => c.name === part && c.isDir === isDir);
      if (!child) { child = { name: part, path: acc, isDir, children: [], docCount: 0 }; node.children.push(child); }
      node = child;
    });
  }
  const count = (n: TreeNode): number => {
    if (!n.isDir) { n.docCount = 1; return 1; }
    n.docCount = n.children.reduce((s, c) => s + count(c), 0);
    n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return n.docCount;
  };
  count(root);
  return root;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/__tests__/buildDocTree.test.ts`
Expected: PASS.

---

### Task 3: Pure usage-filter predicate

**Files:**
- Create: `src/components/DesignPreview/steps/docLibrary/docUsageFilter.ts`
- Test: `src/components/DesignPreview/steps/docLibrary/__tests__/docUsageFilter.test.ts`

**Interfaces:**
- Consumes: `DocUsage` from `docUsageClient.ts`.
- Produces:
  ```ts
  export interface UsageFilterState {
    consumed: 'all'|'used'|'unused';
    role: 'all'|string;            // e.g. 'plan'
    duplicate: 'all'|'dupes';
    confidence: 'all'|'candidate'; // candidate = candidate.isCandidate
  }
  export function matchesUsageFilters(u: DocUsage | undefined, f: UsageFilterState): boolean;
  ```
  A doc with no usage entry (`undefined`) passes only when all four filters are "all" (so a missing scan never hides docs silently under an active filter — it fails visibly by dropping out).

- [ ] **Step 1: Write the failing test**

```ts
// docUsageFilter.test.ts
import { describe, it, expect } from 'vitest';
import { matchesUsageFilters, type UsageFilterState } from '../docUsageFilter';
import type { DocUsage } from '../docUsageClient';

const ALL: UsageFilterState = { consumed: 'all', role: 'all', duplicate: 'all', confidence: 'all' };
const u = (o: Partial<DocUsage>): DocUsage => ({
  path: 'x.md', consumedBy: [], consumedVia: null, duplicateGroupId: null, role: null,
  ageDays: 0, gitAgeDays: null, wordCount: 100, openTaskCount: 0, inboundLinks: 0,
  lifecycle: null, supersededBy: null, candidate: { isCandidate: false, reasons: [], confidence: 'none' }, ...o,
});

describe('matchesUsageFilters', () => {
  it('all-all passes everything, including missing usage', () => {
    expect(matchesUsageFilters(undefined, ALL)).toBe(true);
    expect(matchesUsageFilters(u({}), ALL)).toBe(true);
  });
  it('unused hides consumed docs', () => {
    expect(matchesUsageFilters(u({ consumedBy: ['grill'] }), { ...ALL, consumed: 'unused' })).toBe(false);
    expect(matchesUsageFilters(u({ consumedBy: [] }), { ...ALL, consumed: 'unused' })).toBe(true);
  });
  it('role filter matches role', () => {
    expect(matchesUsageFilters(u({ role: 'plan' }), { ...ALL, role: 'plan' })).toBe(true);
    expect(matchesUsageFilters(u({ role: 'reference' }), { ...ALL, role: 'plan' })).toBe(false);
  });
  it('dupes + candidate filters', () => {
    expect(matchesUsageFilters(u({ duplicateGroupId: 3 }), { ...ALL, duplicate: 'dupes' })).toBe(true);
    expect(matchesUsageFilters(u({ candidate: { isCandidate: true, reasons: [], confidence: 'high' } }), { ...ALL, confidence: 'candidate' })).toBe(true);
    expect(matchesUsageFilters(u({}), { ...ALL, confidence: 'candidate' })).toBe(false);
  });
  it('missing usage fails any active filter', () => {
    expect(matchesUsageFilters(undefined, { ...ALL, consumed: 'unused' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/__tests__/docUsageFilter.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// docUsageFilter.ts
import type { DocUsage } from './docUsageClient';

export interface UsageFilterState {
  consumed: 'all'|'used'|'unused';
  role: 'all'|string;
  duplicate: 'all'|'dupes';
  confidence: 'all'|'candidate';
}

export function matchesUsageFilters(u: DocUsage | undefined, f: UsageFilterState): boolean {
  const allDefault = f.consumed === 'all' && f.role === 'all' && f.duplicate === 'all' && f.confidence === 'all';
  if (!u) return allDefault;
  if (f.consumed === 'used' && u.consumedBy.length === 0) return false;
  if (f.consumed === 'unused' && u.consumedBy.length > 0) return false;
  if (f.role !== 'all' && u.role !== f.role) return false;
  if (f.duplicate === 'dupes' && u.duplicateGroupId == null) return false;
  if (f.confidence === 'candidate' && !u.candidate.isCandidate) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes + whole util suite**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/`
Expected: PASS — three util test files green.

---

### Task 4: Wire usage data + headline into `PreviewMdLibrary`

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`

**Interfaces:**
- Consumes: `fetchDocUsage`, `indexByPath`, `DocUsage`, `DocUsageResponse` (Task 1); `UsageFilterState`, `matchesUsageFilters` (Task 3).
- Produces: `usageByPath: Record<string, DocUsage>`, `usageDiag`, `usageFilters` state consumed by Tasks 5-8.

- [ ] **Step 1: Add imports**

At the top of `PreviewMdLibrary.tsx`, after the existing imports, add:

```ts
import { fetchDocUsage, indexByPath, type DocUsage, type DocUsageResponse } from './docLibrary/docUsageClient';
import { matchesUsageFilters, type UsageFilterState } from './docLibrary/docUsageFilter';
import { buildDocTree, type TreeNode } from './docLibrary/buildDocTree';
```

- [ ] **Step 2: Add state**

Immediately after the line `const [filterStatus, setFilterStatus] = useState<string>('all');`, add:

```ts
  const [usageByPath, setUsageByPath] = useState<Record<string, DocUsage>>({});
  const [usageDiag, setUsageDiag] = useState<DocUsageResponse['diagnostics'] | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<'list' | 'tree'>('list');
  const [usageFilters, setUsageFilters] = useState<UsageFilterState>({
    consumed: 'all', role: 'all', duplicate: 'all', confidence: 'all',
  });
```

- [ ] **Step 3: Add the usage loader (and a reusable function)**

Immediately after the existing `const loadFileList = async () => { ... };` block, add:

```ts
  const loadUsage = async (refresh = false) => {
    setIsLoadingUsage(true);
    try {
      const data = await fetchDocUsage(refresh);
      setUsageByPath(indexByPath(data.docs));
      setUsageDiag(data.diagnostics);
    } catch (e) {
      setUsageDiag({ ambiguousRefs: [], unresolvedRefs: [`usage load failed: ${String(e)}`], atlasMissing: false });
    } finally {
      setIsLoadingUsage(false);
    }
  };
```

Then, in the existing mount effect that calls `loadFileList();`, add `loadUsage();` on the next line.

- [ ] **Step 4: Extend `filteredFiles` to apply usage filters**

In the `filteredFiles` useMemo (currently filtering by category/status/search), add a usage-filter check before the final `return true;`, and add the dependencies:

```ts
      // usage filters (consumed / role / duplicate / confidence)
      if (!matchesUsageFilters(usageByPath[file.path], usageFilters)) {
        return false;
      }
```

Change the dependency array from `[files, searchQuery, filterCategory, filterStatus]` to `[files, searchQuery, filterCategory, filterStatus, usageByPath, usageFilters]`.

- [ ] **Step 5: Add a headline count bar**

Just inside the sidebar `<aside ...>` (before the search `<label>`), add:

```tsx
            <div className="px-3 py-2 text-[11px] text-slate-400 border-b border-violet-950/20 flex flex-wrap gap-x-3 gap-y-1">
              <span><strong className="text-slate-200">{files.length}</strong> docs</span>
              <span><strong className="text-slate-200">{Object.values(usageByPath).filter(u => u.role === 'plan').length}</strong> plan</span>
              <span><strong className="text-amber-300">{Object.values(usageByPath).filter(u => u.candidate.isCandidate).length}</strong> candidates</span>
              <span><strong className="text-slate-200">{new Set(Object.values(usageByPath).map(u => u.duplicateGroupId).filter(x => x != null)).size}</strong> dupe groups</span>
              {isLoadingUsage && <span className="text-slate-500">scanning…</span>}
            </div>
```

- [ ] **Step 6: Live verification**

Ensure a full dev server is up (`npm run dev:hub`, port 3030). Then, via the preview tools, open `http://localhost:3030/Aralia/misc/md_library.html`, wait for load, and run in-page:
`document.body.innerText.match(/\d+ docs/)` → expect a match; and confirm the "candidates" and "dupe groups" counts are present. If `usageDiag.atlasMissing` was true, the plan/role count will read 0 — correct until the Atlas export exists.

Expected: headline bar shows non-zero doc count and the scan-derived counts; no console errors.

---

### Task 5: Per-doc badges on the list rows

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`

**Interfaces:**
- Consumes: `usageByPath` (Task 4).
- Produces: a `renderBadges(path: string)` helper reused by list (Task 5) and tree (Task 7).

- [ ] **Step 1: Add the badge helper**

Above the `return (` of the component (near the other render helpers), add:

```tsx
  const renderBadges = (docPath: string) => {
    const u = usageByPath[docPath];
    if (!u) return null;
    const age = u.gitAgeDays ?? u.ageDays;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {u.role && <span className="text-[9px] px-1 rounded bg-slate-700/50 text-slate-300">{u.role}</span>}
        <span className="text-[9px] px-1 rounded bg-slate-800/60 text-slate-400">{age > 365 ? `${Math.floor(age/365)}y` : `${age}d`}</span>
        {u.consumedBy.length > 0
          ? u.consumedBy.slice(0, 2).map(a => <span key={a} className="text-[9px] px-1 rounded bg-emerald-600/20 text-emerald-300">{a}</span>)
          : <span className="text-[9px] px-1 rounded bg-slate-700/40 text-slate-500">unused</span>}
        {u.duplicateGroupId != null && <span className="text-[9px] px-1 rounded bg-orange-600/20 text-orange-300">dupe</span>}
        {u.openTaskCount > 0 && <span className="text-[9px] px-1 rounded bg-sky-600/20 text-sky-300">{u.openTaskCount} open</span>}
        {u.candidate.isCandidate && <span title={u.candidate.reasons.join('; ')} className="text-[9px] px-1 rounded bg-amber-600/20 text-amber-300">retire?</span>}
      </div>
    );
  };
```

- [ ] **Step 2: Render badges in each list row**

Inside the `filteredFiles.map((file) => ( ... ))` row markup, immediately after the element that shows the file name/path, add:

```tsx
                    {renderBadges(file.path)}
```

- [ ] **Step 3: Live verification**

Reload the Doc Library. Run in-page:
`[...document.querySelectorAll('*')].some(e => e.textContent === 'unused')` → expect `true`; and confirm at least one row shows an app chip (consumed). Confirm spell/reference docs show an app chip rather than "unused".

Expected: badges render on rows; consumed docs show app chips, orphans show "unused", plan docs with open items show "N open".

---

### Task 6: The four new filter controls

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`

**Interfaces:**
- Consumes: `usageFilters`/`setUsageFilters` (Task 4), `usageByPath` (for role options).

- [ ] **Step 1: Add the controls after the existing status `<select>`**

Immediately after the status filter `<select>` block in the sidebar, add:

```tsx
              <select
                value={usageFilters.consumed}
                onChange={(e) => setUsageFilters(s => ({ ...s, consumed: e.target.value as UsageFilterState['consumed'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="all">Consumed: all</option>
                <option value="used">Used by an app</option>
                <option value="unused">Unused by apps</option>
              </select>
              <select
                value={usageFilters.role}
                onChange={(e) => setUsageFilters(s => ({ ...s, role: e.target.value }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="all">Role: all</option>
                {[...new Set(Object.values(usageByPath).map(u => u.role).filter(Boolean))].sort().map(r => (
                  <option key={r as string} value={r as string}>{r}</option>
                ))}
              </select>
              <select
                value={usageFilters.duplicate}
                onChange={(e) => setUsageFilters(s => ({ ...s, duplicate: e.target.value as UsageFilterState['duplicate'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="all">Duplicates: all</option>
                <option value="dupes">Only duplicates</option>
              </select>
              <select
                value={usageFilters.confidence}
                onChange={(e) => setUsageFilters(s => ({ ...s, confidence: e.target.value as UsageFilterState['confidence'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="all">Confidence: all</option>
                <option value="candidate">Retirement candidates</option>
              </select>
```

- [ ] **Step 2: Live verification**

Reload. Via preview tools, set the "consumed" select to `unused` (`preview_fill` on the select, value `unused`) and confirm the visible row count drops and no consumed (app-chip) rows remain. Then set `role` to `plan` and confirm only plan-role rows show. Reset to "all".

Expected: each filter narrows the list; combined `unused` + `plan` yields the plan-and-unused set (the migration target for Feature B).

---

### Task 7: Folder-tree view + layout toggle

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`

**Interfaces:**
- Consumes: `buildDocTree` (Task 2), `filteredFiles`, `renderBadges` (Task 5), `layoutMode`/`setLayoutMode` (Task 4).

- [ ] **Step 1: Add the tree model (memoized off filteredFiles)**

Near the other `useMemo`s, add:

```tsx
  const docTree = useMemo(() => buildDocTree(filteredFiles.map(f => f.path)), [filteredFiles]);
```

- [ ] **Step 2: Add a recursive tree renderer + collapse state**

Add collapse state after the other `useState`s:

```tsx
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
```

Add this renderer above the component `return`:

```tsx
  const renderTree = (node: TreeNode, depth = 0): React.ReactNode => node.children.map((child) => {
    if (child.isDir) {
      const collapsed = collapsedDirs.has(child.path);
      return (
        <div key={child.path}>
          <button
            type="button"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="w-full text-left py-1 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            onClick={() => setCollapsedDirs(s => { const n = new Set(s); n.has(child.path) ? n.delete(child.path) : n.add(child.path); return n; })}
          >
            <span>{collapsed ? '▶' : '▼'}</span><span>{child.name}</span>
            <span className="text-slate-600">({child.docCount})</span>
          </button>
          {!collapsed && renderTree(child, depth + 1)}
        </div>
      );
    }
    return (
      <button
        key={child.path}
        type="button"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full text-left py-1 text-xs ${selectedFilePath === child.path ? 'text-violet-300' : 'text-slate-300'} hover:bg-slate-800/40`}
        onClick={() => setSelectedFilePath(child.path)}
      >
        <div>{child.name}</div>
        {renderBadges(child.path)}
      </button>
    );
  });
```

- [ ] **Step 3: Add the toggle + conditional render**

Immediately before the block that renders the flat list (`filteredFiles.length === 0 ? ... : filteredFiles.map(...)`), add a toggle:

```tsx
            <div className="flex gap-1 px-3 py-1">
              <button type="button" onClick={() => setLayoutMode('list')} className={`text-[11px] px-2 py-0.5 rounded ${layoutMode === 'list' ? 'bg-violet-600/30 text-violet-200' : 'text-slate-400'}`}>List</button>
              <button type="button" onClick={() => setLayoutMode('tree')} className={`text-[11px] px-2 py-0.5 rounded ${layoutMode === 'tree' ? 'bg-violet-600/30 text-violet-200' : 'text-slate-400'}`}>Tree</button>
            </div>
```

Then wrap the existing list block so it renders only when `layoutMode === 'list'`, and add the tree branch:

```tsx
            {layoutMode === 'tree' && (
              <div className="overflow-y-auto min-h-0">{renderTree(docTree)}</div>
            )}
```

(The existing `filteredFiles.map` list stays, guarded by `layoutMode === 'list' && (...)`.)

- [ ] **Step 4: Live verification**

Reload. Via preview tools click the "Tree" toggle button, then run in-page: confirm collapsible dir rows with `(N)` counts appear and clicking a dir row toggles its `▶`/`▼`. Click a leaf doc and confirm it loads in the editor (selectedFilePath updates). Confirm badges show on tree leaves too.

Expected: tree view lists directories (with counts) and files; collapse/expand works; selecting a leaf opens it; list/tree toggle switches cleanly.

---

### Task 8: Rescan button + diagnostics disclosure

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`

**Interfaces:**
- Consumes: `loadUsage` (Task 4), `usageDiag` (Task 4).

- [ ] **Step 1: Add a Rescan button in the sidebar header area**

Next to the headline bar (Task 4 Step 5), add:

```tsx
            <button
              type="button"
              onClick={() => loadUsage(true)}
              disabled={isLoadingUsage}
              className="mx-3 my-1 text-[11px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 disabled:opacity-50 self-start"
            >
              {isLoadingUsage ? 'Scanning…' : '↻ Rescan usage'}
            </button>
```

- [ ] **Step 2: Add a diagnostics disclosure**

Below the Rescan button, add:

```tsx
            {usageDiag && (usageDiag.atlasMissing || usageDiag.ambiguousRefs.length > 0 || usageDiag.unresolvedRefs.length > 0) && (
              <details className="mx-3 mb-1 text-[10px] text-slate-500">
                <summary className="cursor-pointer text-amber-400/80">
                  scan diagnostics{usageDiag.atlasMissing ? ' · Atlas export missing (roles blank)' : ''}
                </summary>
                <div className="mt-1 max-h-32 overflow-y-auto">
                  {usageDiag.atlasMissing && <p className="text-amber-400/70">Run <code>npm run atlas -- reconcile</code> to populate roles.</p>}
                  {usageDiag.ambiguousRefs.slice(0, 20).map((r, i) => <div key={`a${i}`}>ambiguous: {r}</div>)}
                  {usageDiag.unresolvedRefs.slice(0, 20).map((r, i) => <div key={`u${i}`}>unresolved: {r}</div>)}
                </div>
              </details>
            )}
```

- [ ] **Step 3: Live verification**

Reload. Via preview tools click "↻ Rescan usage"; confirm the button shows "Scanning…" then returns, and the headline counts refresh (network shows a `/api/docs/usage?refresh=1` call). If the Atlas export is absent, confirm the diagnostics disclosure shows "Atlas export missing (roles blank)".

Expected: Rescan triggers a refresh request and updates counts; diagnostics disclosure appears when the scan reports atlas-missing / ambiguous / unresolved refs.

- [ ] **Step 4: Full util regression**

Run: `npx vitest run src/components/DesignPreview/steps/docLibrary/`
Expected: PASS — all three util suites still green.

---

## Self-Review

**Spec coverage (Feature A UI):**
- Folder-tree view → Task 2 (builder) + Task 7 (render/toggle). ✓
- Per-doc badges (role/age/consumed/duplicate/open-tasks/candidate) → Task 5. ✓
- Filters (consumed/role/duplicate/confidence) stacking on search/category/status → Task 3 (predicate) + Task 4 (filteredFiles wiring) + Task 6 (controls). ✓
- Headline counts → Task 4. ✓
- Rescan button → Task 8. ✓
- Diagnostics disclosure (atlas-missing/ambiguous/unresolved) → Task 8. ✓
- Additive (existing list/editor/delete intact) → all component tasks insert alongside; list guarded by `layoutMode === 'list'`. ✓

**Placeholder scan:** none — every step ships real code or a concrete in-page check.

**Type consistency:** `DocUsage`/`DocUsageResponse` (Task 1) reused verbatim in Tasks 3-8; `UsageFilterState` (Task 3) matches `usageFilters` state (Task 4) and the controls (Task 6); `TreeNode`/`buildDocTree` (Task 2) match `docTree`/`renderTree` (Task 7); `renderBadges` defined once (Task 5), reused in Task 7.

## Depends on
Plan 1 (`2026-07-04-doc-usage-scanner.md`) — the `/api/docs/usage` endpoint must exist and return `DocUsagePayload`.
