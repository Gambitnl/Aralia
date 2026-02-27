# Roadmap Branch Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit the Roadmap (Capability-First) branch (~63 nodes), apply corrective status changes, and build the Node Health Signal System + Node Test Presence Check so the roadmap functions as a living code health dashboard.

**Architecture:** Phase 1 corrects existing node statuses against verified code reality (no code changes, data changes only). Phase 2 builds new health signal badges into `RoadmapVisualizer.tsx` backed by a pure computation function and a new `testFile` field on nodes. Phase 3 wires test presence checking into the data pipeline.

**Tech Stack:** React 19, TypeScript, Vitest 4.x, @testing-library/react, Tailwind CSS. Dev server runs via `node node_modules/vite/bin/vite.js`. Roadmap UI at `http://localhost:5173/Aralia/misc/roadmap.html`.

**Design doc:** `docs/plans/2026-02-27-roadmap-branch-completion-design.md`

**Key files:**
- UI: `src/components/debug/roadmap/RoadmapVisualizer.tsx`
- Graph: `src/components/debug/roadmap/graph.ts`
- Backend wrapper: `scripts/roadmap-server-logic.ts`
- API endpoints: `vite.config.ts` (search `api/roadmap`)
- Node tests: `scripts/roadmap-node-test.ts`
- Local engine (gitignored, exists locally): `scripts/roadmap-engine/`

---

## Phase 1 — Audit & Status Corrections

> No code changes during Phase 1. Data changes to node status source only. Parking Lot at bottom of correction table for any ideas that surface.

---

### Task 1: Locate the Node Status Source of Truth

**Goal:** Understand exactly where node statuses (`active`/`done`/`planned`) are stored so we know what to edit.

**Step 1: Check what the local engine exposes**

```bash
ls scripts/roadmap-engine/
```

Look for files that define or store node statuses. Common candidates: `generate.ts`, `nodes.ts`, `features.ts`, any `.json` data files.

**Step 2: Grep for status field assignments**

```bash
grep -rn '"status"' scripts/roadmap-engine/ --include="*.ts" --include="*.json" | head -40
grep -rn 'status:' scripts/roadmap-engine/ --include="*.ts" | head -40
```

**Step 3: Check .agent/roadmap-local for node data files**

```bash
ls .agent/roadmap-local/
find .agent/roadmap-local/ -name "*.json" | head -20
find .agent/roadmap-local/ -name "*.md" | head -20
```

**Step 4: Trace one known node**

Find where `sub_pillar_dev_tools_roadmap_capability_first_interaction_ux_canvas_pan_drag_navigation` gets its `status: "active"` value. Follow the call chain from `generateRoadmapData()` in `scripts/roadmap-server-logic.ts` → bridge → local engine.

**Step 5: Document the finding**

Write a one-paragraph note at the top of `docs/plans/2026-02-27-roadmap-audit-corrections.md`:
- Where statuses are stored
- How to update a single status
- Whether a server restart is needed after changes

**Step 6: Commit**

```bash
git add docs/plans/2026-02-27-roadmap-audit-corrections.md
git commit -m "docs: document node status source of truth for audit"
```

---

### Task 2: Apply the 28 Known `active` → `done` Corrections

**Goal:** Update statuses for all nodes pre-identified as done in the design doc (Section 4.2).

**Step 1: Apply corrections to status source**

Using the mechanism found in Task 1, update these nodes to `done`:

*Interaction UX (8 nodes):*
- `Canvas Pan Drag Navigation`
- `Expand All And Collapse All Controls`
- `Node Detail Drawer`
- `Node Drag Repositioning`
- `Open Related Docs In VS Code`
- `Single Node Expand Collapse`
- `View Reset Control`
- `Wheel Zoom Around Cursor`

*Layout Persistence (3 nodes):*
- `Auto-save And Manual Save Clarity`
- `Auto-save Debounce Cycle`
- `Manual Save Trigger`

*Node Test Execution Capability (4 nodes):*
- `Node Test Data Refresh After Run`
- `Node Test Result Status Feedback`
- `Run Child Node Tests (Descendants Only)`
- `Run Node Test (Self Plus Descendants)`

*Roadmap API Surface Capability (6 nodes):*
- `Layout Endpoint (Read Write)`
- `Node Test Run Endpoint`
- `Opportunities Latest Endpoint`
- `Opportunities Scan Endpoint`
- `Roadmap Data Endpoint`
- `VS Code Open Endpoint`

*Strategic Opportunity Mapping (8 nodes):*
- `Crosslink Detection`
- `Flag Classification`
- `Propagation And Rollup`
- `Scan Orchestration`
- `Node Navigation`
- `Opportunity Collection`
- `Scan Trigger`
- `Triage Panel`

*Visualization Stability (1 node):*
- `Connector Rendering Reliability`

**Step 2: Restart dev server and verify in UI**

Navigate to `http://localhost:5173/Aralia/misc/roadmap.html`. Expand the Dev Tools → Roadmap (Capability-First) branch. The At-a-Glance DONE counter should increase significantly. Spot-check 3–4 specific nodes are now showing green/done.

**Step 3: Record in correction table**

In `docs/plans/2026-02-27-roadmap-audit-corrections.md`, fill in the table for all 28 corrections with `Action: Applied`.

**Step 4: Commit**

```bash
git add docs/plans/2026-02-27-roadmap-audit-corrections.md
git commit -m "chore(roadmap): apply 28 verified active→done status corrections"
```

---

### Task 3: Audit the Remaining Uncertain Nodes

**Goal:** For every node not covered by Task 2, verify against code reality and propose a correction if needed.

**Nodes to audit** (all currently `active` unless noted):

*Documentation Intelligence:*
- `Feature Taxonomy Integrity` — check `scripts/roadmap-orchestrate-one-doc.ts` for generic name blocking logic
- `One-doc Orchestrated Processing Pipeline` — check `scripts/roadmap-orchestrate-one-doc.ts` completion level

*Interaction UX:*
- `Panel Scroll Without Canvas Zoom` — already `done`, verify still accurate
- `Related Docs Type Indicators` — already `done`, verify still accurate

*Layout Persistence:*
- `Layout Restore On Load` — test: reload page, check positions restore correctly
- `Reset Node Position Overrides` — test: drag a node, click Reset, verify return to computed position

*Node Test Execution:*
- `Node Test Status Persistence` — check if test results survive server restart (local-engine only)

*Roadmap API Surface:*
- `Opportunities Settings Endpoint` — POST works but no UI; call endpoint directly: `curl -X POST http://localhost:5173/api/roadmap/opportunities/settings -H "Content-Type: application/json" -d '{"autoScanMinutes":20}'`; verify response

*Strategic Opportunity Mapping:*
- `Data Persistence > Snapshot Persistence` — check `.agent/roadmap-local/` for snapshot files after scan
- `Governance And Expansion > Historical Development Traceability` — verify `planned` (nothing built)
- `Governance And Expansion > Multi-product Portfolio Branching (future)` — verify `planned`
- `Operator Workflow > Filters And Sorts` — verify `planned` (nothing built)
- `Operator Workflow > Opportunity Collection > Opportunity Public Facade Module` — already `done`, verify
- `Operator Workflow > Scan Trigger > Scan Trigger` — verify done per Task 2 or still active
- `Scan Pipeline > Crosslink Detection > Opportunity Crosslink Resolver Module` — already `done`, verify
- `Scan Pipeline > Flag Classification > Opportunity Flag Classifier Module` — already `done`, verify
- `Scan Pipeline > Propagation And Rollup > Opportunity Propagation Module` — already `done`, verify
- `Scan Pipeline > Scan Orchestration > Opportunity Graph Context Module` — already `done`, verify
- `Scan Pipeline > Scan Orchestration > Opportunity Scanner Module` — already `done`, verify
- `Scan Pipeline > Scan Orchestration > Opportunity Type Contracts Module` — already `done`, verify
- `Data Persistence > Snapshot Persistence > Opportunity Storage And Sanitization Module` — already `done`, verify

*Visualization Stability:*
- `Connector Rendering Reliability` — covered Task 2, verify glow filters visible in canvas

**Step 1: For each node, record one of:**

```
| Node name | active | active | [what gap remains] | No change |
| Node name | active | done   | [what verified]    | Update status |
| Node name | active | planned| [nothing exists]   | Update status |
```

**Step 2: Check for density issues**

For each L2 group, count direct children. If any group has >~12 direct children at one level, flag it with: `DENSITY REVIEW: [group name] has N children — consider regrouping`.

**Step 3: Save correction table**

Append all findings to `docs/plans/2026-02-27-roadmap-audit-corrections.md`.

**Step 4: STOP — present to user for review**

Output: "Audit complete. Correction table at `docs/plans/2026-02-27-roadmap-audit-corrections.md`. Please review before I apply additional corrections."

Wait for explicit approval before Task 4.

---

### Task 4: Apply Audit Corrections (After User Approval)

**Step 1:** Apply all status corrections from the reviewed table.

**Step 2:** For any nodes flagged for density restructuring — propose the regrouping to user before applying. Do not restructure silently.

**Step 3:** Restart dev server, verify At-a-Glance totals updated in UI.

**Step 4: Commit**

```bash
git add docs/plans/2026-02-27-roadmap-audit-corrections.md
git commit -m "chore(roadmap): apply audit corrections to Roadmap branch nodes"
```

---

## Phase 2 — Node Health Signal System

> New code begins here. Follow TDD: write failing test → implement → pass → commit.
> All new files go in feature-named subdirectories. Do NOT add flat siblings to `scripts/roadmap-*.ts`.

---

### Task 5: Define Health Signal Types

**Files:**
- Create: `src/components/debug/roadmap/health-signals/types.ts`

**Step 1: Create the types file**

```typescript
// src/components/debug/roadmap/health-signals/types.ts

export type HealthSignalKind =
  | 'no-test'        // node has no testFile field
  | 'test-not-run'   // testFile exists but no lastTestRun result
  | 'not-atomized'   // node links to more than 1 component file
  | 'density-warning'; // parent has disproportionately many direct children

export interface HealthSignal {
  kind: HealthSignalKind;
  message: string;
}

export interface NodeTestPresence {
  testFile?: string;
  lastTestRun?: {
    timestamp: string;
    status: 'pass' | 'fail' | 'unverified';
  };
}
```

**Step 2: Extend RoadmapNode type**

In `scripts/roadmap-server-logic.ts`, find the `RoadmapNode` type (around line 30). Add optional health fields:

```typescript
export type RoadmapNode = {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone';
  status: 'planned' | 'active' | 'done';
  testFile?: string;           // path to associated test file
  lastTestRun?: {
    timestamp: string;
    status: 'pass' | 'fail' | 'unverified';
  };
  componentFiles?: string[];   // list of component files this node maps to
  [key: string]: unknown;
};
```

**Step 3: Commit**

```bash
git add src/components/debug/roadmap/health-signals/types.ts scripts/roadmap-server-logic.ts
git commit -m "feat(roadmap/health-signals): add HealthSignal types and NodeTestPresence fields"
```

---

### Task 6: Build Health Signal Computation Logic (TDD)

**Files:**
- Create: `src/components/debug/roadmap/health-signals/compute-health-signals.ts`
- Create: `src/components/debug/roadmap/health-signals/compute-health-signals.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/components/debug/roadmap/health-signals/compute-health-signals.test.ts
import { describe, it, expect } from 'vitest';
import { computeHealthSignals } from './compute-health-signals';
import type { RoadmapNode } from '../../../../scripts/roadmap-server-logic';

const baseNode = (): RoadmapNode => ({
  id: 'test_node',
  label: 'Test Node',
  type: 'milestone',
  status: 'active',
});

describe('computeHealthSignals', () => {
  it('returns no-test when testFile is absent', () => {
    const signals = computeHealthSignals(baseNode(), []);
    expect(signals.some(s => s.kind === 'no-test')).toBe(true);
  });

  it('returns test-not-run when testFile exists but no lastTestRun', () => {
    const node = { ...baseNode(), testFile: 'src/foo.test.ts' };
    const signals = computeHealthSignals(node, []);
    expect(signals.some(s => s.kind === 'test-not-run')).toBe(true);
    expect(signals.some(s => s.kind === 'no-test')).toBe(false);
  });

  it('returns no test signals when testFile and lastTestRun both present', () => {
    const node = {
      ...baseNode(),
      testFile: 'src/foo.test.ts',
      lastTestRun: { timestamp: '2026-02-27T00:00:00Z', status: 'pass' as const },
    };
    const signals = computeHealthSignals(node, []);
    expect(signals.some(s => s.kind === 'no-test')).toBe(false);
    expect(signals.some(s => s.kind === 'test-not-run')).toBe(false);
  });

  it('returns not-atomized when componentFiles has more than 1 entry', () => {
    const node = { ...baseNode(), componentFiles: ['src/A.tsx', 'src/B.tsx'] };
    const signals = computeHealthSignals(node, []);
    expect(signals.some(s => s.kind === 'not-atomized')).toBe(true);
  });

  it('does not return not-atomized for zero or one component file', () => {
    const node0 = baseNode();
    const node1 = { ...baseNode(), componentFiles: ['src/A.tsx'] };
    expect(computeHealthSignals(node0, []).some(s => s.kind === 'not-atomized')).toBe(false);
    expect(computeHealthSignals(node1, []).some(s => s.kind === 'not-atomized')).toBe(false);
  });

  it('returns density-warning when sibling count exceeds threshold', () => {
    const siblings = Array.from({ length: 14 }, (_, i) => ({
      ...baseNode(),
      id: `sib_${i}`,
    }));
    const signals = computeHealthSignals(baseNode(), siblings);
    expect(signals.some(s => s.kind === 'density-warning')).toBe(true);
  });

  it('does not return density-warning for normal sibling counts', () => {
    const siblings = Array.from({ length: 5 }, (_, i) => ({
      ...baseNode(),
      id: `sib_${i}`,
    }));
    const signals = computeHealthSignals(baseNode(), siblings);
    expect(signals.some(s => s.kind === 'density-warning')).toBe(false);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/debug/roadmap/health-signals/compute-health-signals.test.ts
```

Expected: `FAIL` — module not found.

**Step 3: Implement the computation function**

```typescript
// src/components/debug/roadmap/health-signals/compute-health-signals.ts
import type { RoadmapNode } from '../../../../scripts/roadmap-server-logic';
import type { HealthSignal } from './types';

const DENSITY_WARNING_THRESHOLD = 12;

export function computeHealthSignals(
  node: RoadmapNode,
  siblings: RoadmapNode[]
): HealthSignal[] {
  const signals: HealthSignal[] = [];

  // Test presence signals
  if (!node.testFile) {
    signals.push({ kind: 'no-test', message: 'No test file declared for this node.' });
  } else if (!node.lastTestRun) {
    signals.push({ kind: 'test-not-run', message: 'Test file exists but has never been run.' });
  }

  // Atomization signal
  const componentFiles = node.componentFiles ?? [];
  if (componentFiles.length > 1) {
    signals.push({
      kind: 'not-atomized',
      message: `Node maps to ${componentFiles.length} component files — consider splitting.`,
    });
  }

  // Density warning (show on any node if its sibling group is too wide)
  if (siblings.length >= DENSITY_WARNING_THRESHOLD) {
    signals.push({
      kind: 'density-warning',
      message: `${siblings.length} siblings at this level — possible scope creep.`,
    });
  }

  return signals;
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/debug/roadmap/health-signals/compute-health-signals.test.ts
```

Expected: all 7 tests PASS.

**Step 5: Commit**

```bash
git add src/components/debug/roadmap/health-signals/
git commit -m "feat(roadmap/health-signals): add computeHealthSignals with full test coverage"
```

---

### Task 7: Build NodeHealthBadge Component (TDD)

**Files:**
- Create: `src/components/debug/roadmap/health-signals/NodeHealthBadge.tsx`
- Create: `src/components/debug/roadmap/health-signals/NodeHealthBadge.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/components/debug/roadmap/health-signals/NodeHealthBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeHealthBadge } from './NodeHealthBadge';
import type { HealthSignal } from './types';

describe('NodeHealthBadge', () => {
  it('renders nothing when signals array is empty', () => {
    const { container } = render(<NodeHealthBadge signals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders amber badge for no-test signal', () => {
    const signals: HealthSignal[] = [{ kind: 'no-test', message: 'No test' }];
    render(<NodeHealthBadge signals={signals} />);
    expect(screen.getByTitle(/no test/i)).toBeTruthy();
  });

  it('renders clock badge for test-not-run signal', () => {
    const signals: HealthSignal[] = [{ kind: 'test-not-run', message: 'Not run' }];
    render(<NodeHealthBadge signals={signals} />);
    expect(screen.getByTitle(/not run/i)).toBeTruthy();
  });

  it('renders frag badge for not-atomized signal', () => {
    const signals: HealthSignal[] = [{ kind: 'not-atomized', message: 'Split needed' }];
    render(<NodeHealthBadge signals={signals} />);
    expect(screen.getByTitle(/split/i)).toBeTruthy();
  });

  it('renders density badge for density-warning signal', () => {
    const signals: HealthSignal[] = [{ kind: 'density-warning', message: '14 siblings' }];
    render(<NodeHealthBadge signals={signals} />);
    expect(screen.getByTitle(/siblings/i)).toBeTruthy();
  });

  it('renders multiple badges when multiple signals present', () => {
    const signals: HealthSignal[] = [
      { kind: 'no-test', message: 'No test' },
      { kind: 'not-atomized', message: 'Split needed' },
    ];
    const { container } = render(<NodeHealthBadge signals={signals} />);
    expect(container.querySelectorAll('[title]').length).toBe(2);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/debug/roadmap/health-signals/NodeHealthBadge.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement the badge component**

```typescript
// src/components/debug/roadmap/health-signals/NodeHealthBadge.tsx
import type { HealthSignal } from './types';

interface Props {
  signals: HealthSignal[];
}

const BADGE_CONFIG: Record<HealthSignal['kind'], { icon: string; colorClass: string }> = {
  'no-test':        { icon: '⚠',  colorClass: 'text-amber-400' },
  'test-not-run':   { icon: '🕐', colorClass: 'text-orange-300' },
  'not-atomized':   { icon: '⬡',  colorClass: 'text-violet-400' },
  'density-warning':{ icon: '⊞',  colorClass: 'text-red-400' },
};

export function NodeHealthBadge({ signals }: Props) {
  if (signals.length === 0) return null;

  return (
    <span className="flex gap-0.5 items-center">
      {signals.map((signal) => {
        const { icon, colorClass } = BADGE_CONFIG[signal.kind];
        return (
          <span
            key={signal.kind}
            title={signal.message}
            className={`text-[10px] leading-none select-none ${colorClass}`}
          >
            {icon}
          </span>
        );
      })}
    </span>
  );
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/debug/roadmap/health-signals/NodeHealthBadge.test.tsx
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/components/debug/roadmap/health-signals/NodeHealthBadge.tsx \
        src/components/debug/roadmap/health-signals/NodeHealthBadge.test.tsx
git commit -m "feat(roadmap/health-signals): add NodeHealthBadge component with tests"
```

---

### Task 8: Wire Health Badges into Node Rendering

**Files:**
- Modify: `src/components/debug/roadmap/RoadmapVisualizer.tsx`

**Step 1: Find where nodes are rendered**

Search for where individual node labels/circles are drawn:
```bash
grep -n "node\.label\|nodeLabel\|renderNode\|drawNode" src/components/debug/roadmap/RoadmapVisualizer.tsx | head -20
```

Also check `graph.ts`:
```bash
grep -n "label\|circle\|text" src/components/debug/roadmap/graph.ts | head -30
```

The roadmap renders as SVG or HTML — identify which before proceeding.

**Step 2: Import NodeHealthBadge and computeHealthSignals**

At the top of `RoadmapVisualizer.tsx`, add:
```typescript
import { NodeHealthBadge } from './health-signals/NodeHealthBadge';
import { computeHealthSignals } from './health-signals/compute-health-signals';
```

**Step 3: Compute signals per node**

In the render loop where nodes are displayed, compute signals before rendering each node:

```typescript
const siblings = renderGraph.nodes.filter(n => n.parentId === node.parentId && n.id !== node.id);
const healthSignals = computeHealthSignals(node, siblings);
```

**Step 4: Render badges on the node**

Place `<NodeHealthBadge signals={healthSignals} />` adjacent to the node label — below or to the right depending on node layout. Keep it small and non-intrusive.

**Step 5: Verify in browser**

Navigate to `http://localhost:5173/Aralia/misc/roadmap.html`. Expand any branch. Most nodes should show the amber `⚠` (no-test) badge since `testFile` is not yet populated. This is correct and expected.

**Step 6: Commit**

```bash
git add src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap/health-signals): wire NodeHealthBadge into visualizer node rendering"
```

---

## Phase 3 — Node Test Presence Check

---

### Task 9: Build Test Presence Checker (TDD)

**Files:**
- Create: `scripts/roadmap/node-test-presence/test-presence-checker.ts`
- Create: `scripts/roadmap/node-test-presence/test-presence-checker.test.ts`

**Step 1: Create directory**

```bash
mkdir -p scripts/roadmap/node-test-presence
```

**Step 2: Write the failing tests**

```typescript
// scripts/roadmap/node-test-presence/test-presence-checker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fs.existsSync
vi.mock('fs');

import { checkTestPresence } from './test-presence-checker';
import type { RoadmapNode } from '../../roadmap-server-logic';

const baseNode = (): RoadmapNode => ({
  id: 'test_node',
  label: 'Test Node',
  type: 'milestone',
  status: 'active',
});

describe('checkTestPresence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns testFileExists: false when testFile not declared', () => {
    const result = checkTestPresence(baseNode(), '/repo/root');
    expect(result.testFileExists).toBe(false);
    expect(result.testFileDeclared).toBe(false);
  });

  it('returns testFileDeclared: true, testFileExists: false when file missing on disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const node = { ...baseNode(), testFile: 'src/foo.test.ts' };
    const result = checkTestPresence(node, '/repo/root');
    expect(result.testFileDeclared).toBe(true);
    expect(result.testFileExists).toBe(false);
  });

  it('returns testFileDeclared: true, testFileExists: true when file on disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const node = { ...baseNode(), testFile: 'src/foo.test.ts' };
    const result = checkTestPresence(node, '/repo/root');
    expect(result.testFileDeclared).toBe(true);
    expect(result.testFileExists).toBe(true);
  });
});
```

**Step 3: Run tests to confirm they fail**

```bash
npx vitest run scripts/roadmap/node-test-presence/test-presence-checker.test.ts
```

Expected: FAIL — module not found.

**Step 4: Implement the checker**

```typescript
// scripts/roadmap/node-test-presence/test-presence-checker.ts
import fs from 'fs';
import path from 'path';
import type { RoadmapNode } from '../roadmap-server-logic';

export interface TestPresenceResult {
  testFileDeclared: boolean;
  testFileExists: boolean;
  resolvedPath?: string;
}

export function checkTestPresence(node: RoadmapNode, repoRoot: string): TestPresenceResult {
  if (!node.testFile) {
    return { testFileDeclared: false, testFileExists: false };
  }

  const resolvedPath = path.resolve(repoRoot, node.testFile);
  const testFileExists = fs.existsSync(resolvedPath);

  return { testFileDeclared: true, testFileExists, resolvedPath };
}
```

**Step 5: Run tests to confirm they pass**

```bash
npx vitest run scripts/roadmap/node-test-presence/test-presence-checker.test.ts
```

Expected: all 3 tests PASS.

**Step 6: Commit**

```bash
git add scripts/roadmap/node-test-presence/
git commit -m "feat(roadmap/node-test-presence): add test presence checker with tests"
```

---

### Task 10: Wire Test Presence into Data Pipeline

**Files:**
- Modify: `scripts/roadmap-server-logic.ts`
- Modify: `vite.config.ts` (the `/api/roadmap/data` handler)

**Step 1: Import checker in roadmap-server-logic.ts**

```typescript
import { checkTestPresence } from './roadmap/node-test-presence/test-presence-checker.js';
```

**Step 2: Annotate nodes after generation**

In `generateRoadmapData()`, after nodes are returned from the bridge (or fallback), iterate and annotate:

```typescript
const repoRoot = process.cwd();
data.nodes = data.nodes.map(node => {
  const presence = checkTestPresence(node, repoRoot);
  return {
    ...node,
    testFileExists: presence.testFileExists,
    testFileDeclared: presence.testFileDeclared,
  };
});
```

**Step 3: Verify in browser**

Reload the roadmap. The health badges already render based on `testFile` field — this step ensures the data pipeline correctly reflects disk reality. Open the browser console and check that node data includes `testFileDeclared` and `testFileExists`.

**Step 4: Commit**

```bash
git add scripts/roadmap-server-logic.ts vite.config.ts
git commit -m "feat(roadmap/node-test-presence): wire test presence check into data pipeline"
```

---

## Phase 4 — Opportunity Settings UI Form

### Task 11: Build Settings Form in Opportunity Drawer (TDD)

**Files:**
- Create: `src/components/debug/roadmap/OpportunitySettingsForm.tsx`
- Create: `src/components/debug/roadmap/OpportunitySettingsForm.test.tsx`
- Modify: `src/components/debug/roadmap/RoadmapVisualizer.tsx`

**Step 1: Write the failing tests**

```typescript
// src/components/debug/roadmap/OpportunitySettingsForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpportunitySettingsForm } from './OpportunitySettingsForm';

const defaultSettings = {
  autoScanMinutes: 15,
  staleDays: 21,
  maxCrosslinkMatchesPerNode: 5,
  maxSnapshotEntries: 10,
  keepSnapshots: true,
};

describe('OpportunitySettingsForm', () => {
  it('renders current settings values in inputs', () => {
    render(<OpportunitySettingsForm settings={defaultSettings} onSave={vi.fn()} />);
    expect((screen.getByLabelText(/auto scan/i) as HTMLInputElement).value).toBe('15');
    expect((screen.getByLabelText(/stale/i) as HTMLInputElement).value).toBe('21');
  });

  it('calls onSave with updated values on submit', () => {
    const onSave = vi.fn();
    render(<OpportunitySettingsForm settings={defaultSettings} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/auto scan/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ autoScanMinutes: 30 }));
  });
});
```

**Step 2: Run to confirm they fail**

```bash
npx vitest run src/components/debug/roadmap/OpportunitySettingsForm.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement the form**

```typescript
// src/components/debug/roadmap/OpportunitySettingsForm.tsx
import { useState } from 'react';
import type { OpportunitySettings } from '../../../scripts/roadmap-server-logic';

interface Props {
  settings: OpportunitySettings;
  onSave: (updated: OpportunitySettings) => void;
}

export function OpportunitySettingsForm({ settings, onSave }: Props) {
  const [autoScanMinutes, setAutoScanMinutes] = useState(settings.autoScanMinutes);
  const [staleDays, setStaleDays] = useState(settings.staleDays);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...settings, autoScanMinutes, staleDays });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 text-xs">
      <label className="flex flex-col gap-1">
        <span>Auto Scan (minutes)</span>
        <input
          aria-label="auto scan minutes"
          type="number"
          min={1}
          value={autoScanMinutes}
          onChange={e => setAutoScanMinutes(Number(e.target.value))}
          className="bg-transparent border border-blue-700 rounded px-1 py-0.5 w-20"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Stale Threshold (days)</span>
        <input
          aria-label="stale days"
          type="number"
          min={1}
          value={staleDays}
          onChange={e => setStaleDays(Number(e.target.value))}
          className="bg-transparent border border-blue-700 rounded px-1 py-0.5 w-20"
        />
      </label>
      <button
        type="submit"
        className="mt-1 px-2 py-1 bg-blue-800 hover:bg-blue-700 rounded text-white"
      >
        Save Settings
      </button>
    </form>
  );
}
```

**Step 4: Wire into RoadmapVisualizer opportunity drawer**

Find the opportunity settings section in `RoadmapVisualizer.tsx` (search `opportunitySettings`). Add `<OpportunitySettingsForm>` rendered below the settings display, wired to call `POST /api/roadmap/opportunities/settings`:

```typescript
const handleSaveOpportunitySettings = async (updated: OpportunitySettings) => {
  await fetch('/api/roadmap/opportunities/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });
  void loadOpportunitySettings(); // reload to confirm
};
```

**Step 5: Run tests**

```bash
npx vitest run src/components/debug/roadmap/OpportunitySettingsForm.test.tsx
```

Expected: all 2 tests PASS.

**Step 6: Verify in browser**

Open the Opportunities panel. Settings form should appear and allow editing auto-scan interval.

**Step 7: Commit**

```bash
git add src/components/debug/roadmap/OpportunitySettingsForm.tsx \
        src/components/debug/roadmap/OpportunitySettingsForm.test.tsx \
        src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap): add opportunity settings UI form wired to POST endpoint"
```

---

## Phase 5 — Roadmap Node Additions & Final Verification

### Task 12: Add Roadmap Nodes for Phase 2 Capabilities

**Goal:** The roadmap branch must reflect the new capabilities just built. Follow the node density principle — group thoughtfully, no flat lists.

**Step 1: Locate where Roadmap branch nodes are defined**

Find the source that defines the Roadmap (Capability-First) branch nodes (discovered in Task 1). This may be in `.agent/roadmap-local/features/` or the local engine.

**Step 2: Add Node Health Signal System subtree**

Under `Roadmap (Capability-First)`, add a new L2 group: **Node Health Signals**

Children (L3):
- `Health Signal Computation` — `computeHealthSignals()` pure function (`status: done`)
- `Health Badge Component` — `NodeHealthBadge` React component (`status: done`)
- `Visualizer Integration` — badges wired into node rendering (`status: done`)
- `Density Warning Detection` — sibling count threshold check (`status: done`)

**Step 3: Add Node Test Presence subtree**

Under `Roadmap (Capability-First)`, add a new L2 group: **Node Test Presence**

Children (L3):
- `Test File Declaration Schema` — `testFile` field on `RoadmapNode` type (`status: done`)
- `Disk Presence Checker` — `checkTestPresence()` in `scripts/roadmap/node-test-presence/` (`status: done`)
- `Pipeline Annotation` — nodes annotated with `testFileDeclared`/`testFileExists` at data generation time (`status: done`)

**Step 4: Verify node density of new additions**

Each new L2 group has 3–4 children — well within density guidelines.

**Step 5: Restart server and verify in UI**

New nodes should appear under Dev Tools → Roadmap (Capability-First) with `done` status.

**Step 6: Commit**

```bash
git commit -m "chore(roadmap): add roadmap branch nodes for health signals and test presence"
```

---

### Task 13: Final Verification Against Success Criteria

Check each criterion from the design doc (Section 7):

**Step 1: All ~63 nodes reflect accurate statuses**
- Expand Roadmap branch fully
- Scan for any `active` nodes that should now be `done`
- Count: At-a-Glance DONE count should be substantially higher than the starting 0

**Step 2: Health signal badges visible**
- Find a node without `testFile` — should show amber `⚠`
- Find the node with `testFile` but no run — should show clock badge
- No badge crashes or layout breaks

**Step 3: Node test presence wired**
```bash
# Verify API returns testFileDeclared field
curl http://localhost:5173/api/roadmap/data | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const sample = d.nodes.slice(0,3);
  console.log(JSON.stringify(sample.map(n => ({id: n.id, testFileDeclared: n.testFileDeclared})), null, 2));
"
```

**Step 4: Opportunity settings form works**
- Open Opportunities panel, change auto-scan to 30 minutes, save
- Reopen panel — value should persist as 30

**Step 5: No new flat sibling explosions**
- Visually scan new nodes — groups are cohesive, no overloaded siblings

**Step 6: New files follow feature-name-driven folders**
- `src/components/debug/roadmap/health-signals/` ✓
- `scripts/roadmap/node-test-presence/` ✓

**Step 7: Final commit**

```bash
git add .
git commit -m "chore: roadmap branch completion — all success criteria verified"
```

---

## Appendix: Test Commands

```bash
# Run all roadmap-related tests
npx vitest run src/components/debug/roadmap/health-signals/
npx vitest run scripts/roadmap/node-test-presence/
npx vitest run src/components/debug/roadmap/OpportunitySettingsForm.test.tsx

# TypeScript check
npx tsc --noEmit

# Dev server (if not running)
node node_modules/vite/bin/vite.js --port 5173 --strictPort

# Roadmap URL
# http://localhost:5173/Aralia/misc/roadmap.html
```

## Appendix: Key Constraints

- **Phase 1 is data-only.** No code changes until Phase 2.
- **Task 3 ends with a STOP** — present correction table to user, wait for approval before applying.
- **Feature-name folders for all new code.** Do not add flat siblings to `scripts/roadmap-*.ts`.
- **TDD for all new code.** Write failing test, verify it fails, implement, verify it passes, commit.
- **Parking Lot for ideas.** Anything out of scope goes into `docs/plans/2026-02-27-roadmap-audit-corrections.md` Parking Lot section.
- **Out of scope** (do not touch): other Dev Tools branches, World Exploration, code atomization, TIDY UP flow, At-a-Glance tooltip, full file reorganization.
