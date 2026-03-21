# Spells Dynamic Graph Overlay — Implementation Plan

> **IMPLEMENTED** — 2026-03-20. All tasks below were completed. Key deviation from the original plan: the `virtualNodes` derivation was originally structured as a hardcoded 5-tier loop. It was refactored to a **recursive `buildChildren(parentId, choices, depth)` inner function** (guarded by `MAX_DEPTH = 14`), enabling arbitrary drill depth rather than a fixed cap. The `SpellBranchNavigator` additionally gained an `initialChoices?: AxisChoice[]` prop so the graph overlay can seed its filter state when "Open in Spell Branch →" is clicked.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live axis-engine-powered Spells navigation tree to the roadmap graph canvas that lets users drill through spell axes, pick values, and expand to see matching spell entries — all as native graph nodes.

**Architecture:** A `SpellGraphOverlay` component mounts inside the existing canvas pan/zoom wrapper and renders virtual nodes/edges as absolutely-positioned elements that share the same coordinate system. A `virtual-node-id.ts` module encodes the full axis-choice path in each node's ID, so the overlay derives all children from the axis engine at render time with zero separate selection state. The Spells project node is injected into the roadmap data by `generateRoadmapData()`.

**Tech Stack:** React, TypeScript, existing `computeAxisEngine` from `spell-branch/axis-engine.ts`, existing Framer Motion canvas, existing roadmap layout constants.

---

## Task 1: Inject the Spells project node into roadmap data

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-server-logic.ts` (around line 186, after `data.nodes = data.nodes.map(...)`)

The Spells node should be injected **after** `generateRoadmapData` returns its bridge data. We add it if a node with `id: 'pillar_spells'` does not already exist (idempotent).

### Step 1: Add `spellTree` field to `RoadmapNode` type in roadmap-server-logic types

Open `devtools/roadmap/scripts/roadmap-server-logic.ts` and find the `RoadmapNode` interface. Add:
```typescript
spellTree?: boolean;
```

### Step 2: Inject the node in `generateRoadmapData`

After the `data.nodes = data.nodes.map(...)` block (line ~193) and before `return data`, add:

```typescript
// Technical: inject the live Spells navigator node if not already present.
// Layman: this is the "Spells" circle on the roadmap — clicking it opens the live spell tree.
if (!data.nodes.some((n: RoadmapNode) => n.id === 'pillar_spells')) {
  data.nodes.push({
    id: 'pillar_spells',
    label: 'Spells',
    type: 'project',
    status: 'active',
    initialX: 1380,
    initialY: 400,
    description: 'Live spell navigator — drill through axes to explore all 469 spell profiles.',
    spellTree: true,
    testFileExists: false,
    testFileDeclared: false,
  } as RoadmapNode);
}
```

**Note:** `initialX: 1380` places it in the right fan column alongside existing project nodes.

### Step 3: Verify via dev server

```
curl http://localhost:3010/api/roadmap/data | node -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{ const j=JSON.parse(c.join('')); console.log(j.nodes.find(n=>n.id==='pillar_spells')); })"
```

Expected: `{ id: 'pillar_spells', label: 'Spells', type: 'project', spellTree: true, ... }`

### Step 4: Commit

```bash
git add devtools/roadmap/scripts/roadmap-server-logic.ts
git commit -m "feat(roadmap): inject pillar_spells project node into roadmap data"
```

---

## Task 2: virtual-node-id.ts — encode/decode path helpers

**Files:**
- Create: `devtools/roadmap/src/spell-branch/virtual-node-id.ts`
- Create: `devtools/roadmap/src/spell-branch/virtual-node-id.test.ts`

All virtual node IDs start with `$spell:` so they are easily distinguished from real roadmap node IDs.

### Step 1: Write the failing tests

Create `devtools/roadmap/src/spell-branch/virtual-node-id.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  axisNodeId,
  valueNodeId,
  showSpellsNodeId,
  entryNodeId,
  isVirtualNodeId,
  parseVirtualNodeId,
  choicesFromVirtualNodeId,
} from './virtual-node-id';

describe('axisNodeId', () => {
  it('encodes a top-level axis node', () => {
    expect(axisNodeId('class')).toBe('$spell:axis:class');
  });
  it('encodes a nested axis node (after a value choice)', () => {
    expect(axisNodeId('level', [{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard:axis:level');
  });
});

describe('valueNodeId', () => {
  it('encodes a value node', () => {
    expect(valueNodeId([{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard');
  });
  it('sorts choices so order does not matter', () => {
    const choices = [{ axisId: 'level', value: '3' }, { axisId: 'class', value: 'Wizard' }];
    expect(valueNodeId(choices)).toBe('$spell:v:class=Wizard:level=3');
  });
});

describe('showSpellsNodeId', () => {
  it('encodes show-spells under a path', () => {
    expect(showSpellsNodeId([{ axisId: 'class', value: 'Wizard' }]))
      .toBe('$spell:v:class=Wizard:show');
  });
});

describe('entryNodeId', () => {
  it('encodes a spell entry node', () => {
    expect(entryNodeId([{ axisId: 'class', value: 'Wizard' }], 'fireball'))
      .toBe('$spell:v:class=Wizard:entry:fireball');
  });
});

describe('isVirtualNodeId', () => {
  it('returns true for virtual ids', () => {
    expect(isVirtualNodeId('$spell:axis:class')).toBe(true);
  });
  it('returns false for real roadmap ids', () => {
    expect(isVirtualNodeId('pillar_spells')).toBe(false);
  });
});

describe('parseVirtualNodeId', () => {
  it('parses axis node', () => {
    expect(parseVirtualNodeId('$spell:axis:class')).toEqual({ kind: 'axis', axisId: 'class', choices: [] });
  });
  it('parses value node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard')).toEqual({
      kind: 'value',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses nested axis node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:axis:level')).toEqual({
      kind: 'axis',
      axisId: 'level',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses show-spells node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:show')).toEqual({
      kind: 'show-spells',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
  it('parses entry node', () => {
    expect(parseVirtualNodeId('$spell:v:class=Wizard:entry:fireball')).toEqual({
      kind: 'entry',
      spellId: 'fireball',
      choices: [{ axisId: 'class', value: 'Wizard' }],
    });
  });
});

describe('choicesFromVirtualNodeId', () => {
  it('extracts choices from a value node id', () => {
    const id = '$spell:v:class=Wizard:level=3';
    expect(choicesFromVirtualNodeId(id)).toEqual([
      { axisId: 'class', value: 'Wizard' },
      { axisId: 'level', value: '3' },
    ]);
  });
  it('returns empty array for top-level axis', () => {
    expect(choicesFromVirtualNodeId('$spell:axis:class')).toEqual([]);
  });
});
```

### Step 2: Run to confirm failure

```bash
cd /f/Repos/Aralia
npx vitest run devtools/roadmap/src/spell-branch/virtual-node-id.test.ts
```

Expected: all tests fail with "Cannot find module './virtual-node-id'"

### Step 3: Implement virtual-node-id.ts

Create `devtools/roadmap/src/spell-branch/virtual-node-id.ts`:

```typescript
import type { AxisChoice, AxisId } from './types';

// ============================================================================
// Encoding helpers
// ============================================================================
// Technical: encode AxisChoice[] as a sorted "k=v:k=v" segment for use in IDs.
// Layman: turns a list of filter picks into a stable string key.
// ============================================================================
function encodeChoices(choices: AxisChoice[]): string {
  return [...choices]
    .sort((a, b) => a.axisId.localeCompare(b.axisId))
    .map((c) => `${c.axisId}=${c.value}`)
    .join(':');
}

/**
 * ID for a top-level axis node (no prior choices).
 * If choices are provided, this is a nested axis node appearing after value picks.
 */
export function axisNodeId(axisId: AxisId, choices: AxisChoice[] = []): string {
  if (choices.length === 0) return `$spell:axis:${axisId}`;
  return `$spell:v:${encodeChoices(choices)}:axis:${axisId}`;
}

/**
 * ID for a value node — encodes the full set of choices that led here.
 */
export function valueNodeId(choices: AxisChoice[]): string {
  return `$spell:v:${encodeChoices(choices)}`;
}

/**
 * ID for the "Show Spells" node under a given choice path.
 */
export function showSpellsNodeId(choices: AxisChoice[]): string {
  return `$spell:v:${encodeChoices(choices)}:show`;
}

/**
 * ID for a spell entry node under a given choice path.
 */
export function entryNodeId(choices: AxisChoice[], spellId: string): string {
  return `$spell:v:${encodeChoices(choices)}:entry:${spellId}`;
}

// ============================================================================
// Detection
// ============================================================================
export function isVirtualNodeId(id: string): boolean {
  return id.startsWith('$spell:');
}

// ============================================================================
// Parsing
// ============================================================================
export type ParsedVirtualNode =
  | { kind: 'axis'; axisId: string; choices: AxisChoice[] }
  | { kind: 'value'; choices: AxisChoice[] }
  | { kind: 'show-spells'; choices: AxisChoice[] }
  | { kind: 'entry'; spellId: string; choices: AxisChoice[] };

function parseChoiceSegment(segment: string): AxisChoice[] {
  if (!segment) return [];
  return segment.split(':').map((pair) => {
    const eq = pair.indexOf('=');
    return { axisId: pair.slice(0, eq) as AxisId, value: pair.slice(eq + 1) };
  });
}

export function parseVirtualNodeId(id: string): ParsedVirtualNode | null {
  if (!isVirtualNodeId(id)) return null;

  // Top-level axis: "$spell:axis:{axisId}"
  const axisTopMatch = id.match(/^\$spell:axis:(.+)$/);
  if (axisTopMatch) {
    return { kind: 'axis', axisId: axisTopMatch[1], choices: [] };
  }

  // Value path: "$spell:v:{choices}" optionally followed by :axis:{id}, :show, or :entry:{id}
  const vMatch = id.match(/^\$spell:v:(.+)$/);
  if (!vMatch) return null;
  const rest = vMatch[1];

  // Nested axis: ends with ":axis:{axisId}"
  const nestedAxisMatch = rest.match(/^(.+):axis:([^:]+)$/);
  if (nestedAxisMatch) {
    return { kind: 'axis', axisId: nestedAxisMatch[2], choices: parseChoiceSegment(nestedAxisMatch[1]) };
  }

  // Show spells: ends with ":show"
  const showMatch = rest.match(/^(.+):show$/);
  if (showMatch) {
    return { kind: 'show-spells', choices: parseChoiceSegment(showMatch[1]) };
  }

  // Entry: ends with ":entry:{spellId}"
  const entryMatch = rest.match(/^(.+):entry:([^:]+)$/);
  if (entryMatch) {
    return { kind: 'entry', spellId: entryMatch[2], choices: parseChoiceSegment(entryMatch[1]) };
  }

  // Plain value node: the rest is the choice segment
  return { kind: 'value', choices: parseChoiceSegment(rest) };
}

/**
 * Extracts choices from any virtual node ID.
 * Returns [] for top-level axis nodes (no prior choices).
 */
export function choicesFromVirtualNodeId(id: string): AxisChoice[] {
  const parsed = parseVirtualNodeId(id);
  if (!parsed) return [];
  return parsed.choices;
}
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run devtools/roadmap/src/spell-branch/virtual-node-id.test.ts
```

Expected: all tests pass.

### Step 5: Commit

```bash
git add devtools/roadmap/src/spell-branch/virtual-node-id.ts devtools/roadmap/src/spell-branch/virtual-node-id.test.ts
git commit -m "feat(spell-graph): add virtual-node-id encode/decode helpers"
```

---

## Task 3: Add VirtualNodeDetail type to types.ts

**Files:**
- Modify: `devtools/roadmap/src/spell-branch/types.ts`

### Step 1: Append to types.ts

At the bottom of `devtools/roadmap/src/spell-branch/types.ts`, add:

```typescript
// ============================================================================
// Virtual Graph Overlay Types
// ============================================================================

/**
 * Detail payload for a selected virtual node in the spell graph overlay.
 * Passed from SpellGraphOverlay to RoadmapVisualizer for the info panel.
 */
export type VirtualNodeKind = 'axis' | 'value' | 'show-spells' | 'entry';

export interface VirtualNodeDetail {
  id: string;
  kind: VirtualNodeKind;
  /** Human-readable title (axis label, value label, "Show Spells", or spell name). */
  label: string;
  /** Number of spells matching the selection path at this node. */
  spellCount: number;
  /** The selection choices accumulated up to and including this node. */
  choices: AxisChoice[];
  /** Only present when kind === 'entry'. */
  spellProfile?: SpellCanonicalProfile;
}
```

### Step 2: Commit

```bash
git add devtools/roadmap/src/spell-branch/types.ts
git commit -m "feat(spell-graph): add VirtualNodeDetail type"
```

---

## Task 4: SpellGraphOverlay component

**Files:**
- Create: `devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx`

This is the heart of the feature. It renders a live axis-engine-powered subtree on the roadmap canvas.

### Step 4.1: Write the layout pure function and test it

Before writing the full component, extract and test the layout algorithm in isolation.

Add to `devtools/roadmap/src/spell-branch/virtual-node-id.test.ts` (or create a new `spell-graph-layout.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { computeVirtualLayout, type VirtualLayoutInput } from './SpellGraphOverlay';

describe('computeVirtualLayout', () => {
  it('returns empty array when no nodes', () => {
    expect(computeVirtualLayout({ nodes: [], projectCenterX: 100, projectCenterY: 100, side: 1 })).toEqual([]);
  });

  it('places a single axis node at depth 1', () => {
    const result = computeVirtualLayout({
      nodes: [{ id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: false }],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeGreaterThan(500); // right of center for side=1
    expect(result[0].id).toBe('$spell:axis:class');
  });

  it('centers parent on children Y-range', () => {
    const result = computeVirtualLayout({
      nodes: [
        { id: '$spell:axis:class', depth: 1, parentId: 'pillar_spells', label: 'Class', hasChildren: true },
        { id: '$spell:v:class=Wizard', depth: 2, parentId: '$spell:axis:class', label: 'Wizard [42]', hasChildren: false },
        { id: '$spell:v:class=Sorcerer', depth: 2, parentId: '$spell:axis:class', label: 'Sorcerer [38]', hasChildren: false },
      ],
      projectCenterX: 500,
      projectCenterY: 500,
      side: 1,
    });
    const axis = result.find((n) => n.id === '$spell:axis:class')!;
    const w = result.find((n) => n.id === '$spell:v:class=Wizard')!;
    const s = result.find((n) => n.id === '$spell:v:class=Sorcerer')!;
    const childMidY = (w.y + s.y) / 2;
    expect(Math.abs(axis.y - childMidY)).toBeLessThan(2); // parent centered on children
  });
});
```

Run to confirm failure, then implement.

### Step 4.2: Implement SpellGraphOverlay.tsx

Create `devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx`:

```typescript
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BRANCH_WIDTH,
  BRANCH_BASE_DISTANCE,
  BRANCH_COL_DISTANCE,
  BRANCH_ROW_GAP,
  BRANCH_MIN_HEIGHT,
} from '../components/debug/roadmap/constants';
import { buildCurvePath, centerOf } from '../components/debug/roadmap/utils';
import type { RenderNode } from '../components/debug/roadmap/types';
import { computeAxisEngine } from './axis-engine';
import { VSM_COMBINATION_LABELS } from './vsm-tree';
import {
  axisNodeId,
  valueNodeId,
  showSpellsNodeId,
  entryNodeId,
  isVirtualNodeId,
  parseVirtualNodeId,
  choicesFromVirtualNodeId,
} from './virtual-node-id';
import type { SpellCanonicalProfile, AxisChoice, AxisId, VirtualNodeDetail } from './types';

// ============================================================================
// Layout types / helpers
// ============================================================================

export interface VirtualLayoutInput {
  nodes: VirtualLayoutInputNode[];
  projectCenterX: number;
  projectCenterY: number;
  side: 1 | -1;
}

export interface VirtualLayoutInputNode {
  id: string;
  depth: number;
  parentId: string;
  label: string;
  hasChildren: boolean;
}

export interface VirtualLayoutNode extends VirtualLayoutInputNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Technical: pure function that assigns x/y to each virtual node using a
 * depth-column × leaf-cursor layout. Leaf nodes advance the cursor, parents
 * center on their children.
 * Layman: positions each virtual card in a column grid without overlapping.
 */
export function computeVirtualLayout(input: VirtualLayoutInput): VirtualLayoutNode[] {
  const { nodes, projectCenterX, projectCenterY, side } = input;
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, x: 0, y: 0, width: BRANCH_WIDTH, height: BRANCH_MIN_HEIGHT }]));
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n.id);
    childrenOf.set(n.parentId, list);
  }

  // Assign X by depth
  for (const n of nodeMap.values()) {
    n.x = Math.round(projectCenterX + side * (BRANCH_BASE_DISTANCE + (n.depth - 1) * BRANCH_COL_DISTANCE) - BRANCH_WIDTH / 2);
  }

  // Assign Y: leaf-cursor pass (depth-first, sorted by ID for stability)
  let leafCursorY = projectCenterY;
  const visited = new Set<string>();

  function assignY(id: string): { minY: number; maxY: number } {
    if (visited.has(id)) return { minY: 0, maxY: 0 };
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return { minY: 0, maxY: 0 };
    const children = (childrenOf.get(id) ?? []).sort();
    if (children.length === 0) {
      node.y = leafCursorY;
      leafCursorY += node.height + BRANCH_ROW_GAP;
      return { minY: node.y, maxY: node.y + node.height };
    }
    let minY = Infinity, maxY = -Infinity;
    for (const childId of children) {
      const childRange = assignY(childId);
      minY = Math.min(minY, childRange.minY);
      maxY = Math.max(maxY, childRange.maxY);
    }
    node.y = Math.round((minY + maxY) / 2 - node.height / 2);
    return { minY: node.y, maxY: node.y + node.height };
  }

  // Start from project's direct children (depth 1)
  const depth1Ids = nodes.filter((n) => n.depth === 1).map((n) => n.id).sort();
  // Center the whole tree on the project
  const totalLeaves = nodes.filter((n) => !childrenOf.has(n.id) || (childrenOf.get(n.id)?.length ?? 0) === 0).length;
  const totalHeight = totalLeaves * BRANCH_MIN_HEIGHT + Math.max(0, totalLeaves - 1) * BRANCH_ROW_GAP;
  leafCursorY = projectCenterY - totalHeight / 2;
  for (const id of depth1Ids) assignY(id);

  return Array.from(nodeMap.values());
}

// ============================================================================
// Label helpers
// ============================================================================
function axisValueLabel(axisId: AxisId, value: string): string {
  if (axisId === 'level') return value === '0' ? 'Cantrip' : `Level ${value}`;
  if (axisId === 'requirements') return VSM_COMBINATION_LABELS[value as keyof typeof VSM_COMBINATION_LABELS] ?? value;
  return value;
}

// ============================================================================
// Props
// ============================================================================
interface SpellGraphOverlayProps {
  spellsProjectNode: RenderNode;
  side: 1 | -1;
  isDark: boolean;
  selectedVirtualId: string | null;
  onVirtualNodeSelect: (id: string, detail: VirtualNodeDetail) => void;
  onOpenSpellBranch: (choices: AxisChoice[]) => void;
  canvasOffset: number; // CANVAS_OFFSET constant from Visualizer (= -CANVAS_MIN)
}

// ============================================================================
// Main Component
// ============================================================================
export function SpellGraphOverlay({
  spellsProjectNode,
  side,
  isDark,
  selectedVirtualId,
  onVirtualNodeSelect,
  onOpenSpellBranch,
  canvasOffset,
}: SpellGraphOverlayProps) {
  const [spells, setSpells] = useState<SpellCanonicalProfile[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load spell profiles once
  useEffect(() => {
    fetch('/Aralia/api/roadmap/spell-profiles')
      .then((r) => r.json())
      .then((data: SpellCanonicalProfile[]) => setSpells(data))
      .catch(() => {}); // silent: Visualizer is already up, spells load lazily
  }, []);

  const projectCenter = centerOf(spellsProjectNode);
  const isExpanded = expandedIds.has('pillar_spells');

  const toggleVirtualNode = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Build the visible virtual node tree ----
  // Technical: each expanded virtual node contributes its children to the flat node list.
  // Layman: we walk the open nodes and compute what children to show.
  const virtualNodes = useMemo(() => {
    if (!isExpanded || spells.length === 0) return [];
    const result: VirtualLayoutInputNode[] = [];

    // Top-level: axis nodes (depth 1, children of pillar_spells)
    const topResult = computeAxisEngine(spells, []);
    for (const axis of topResult.availableAxes) {
      const id = axisNodeId(axis.axisId);
      result.push({ id, depth: 1, parentId: 'pillar_spells', label: axis.label, hasChildren: expandedIds.has(id) });

      if (!expandedIds.has(id)) continue;

      // Value nodes (depth 2, children of axis node)
      for (const val of axis.values) {
        const choices: AxisChoice[] = [{ axisId: axis.axisId, value: val.value }];
        const valueId = valueNodeId(choices);
        const valueLabel = `${axisValueLabel(axis.axisId, val.value)} [${val.count}]`;
        result.push({ id: valueId, depth: 2, parentId: id, label: valueLabel, hasChildren: expandedIds.has(valueId) });

        if (!expandedIds.has(valueId)) continue;

        // After picking a value: show remaining discriminating axes + Show Spells
        const afterResult = computeAxisEngine(spells, choices);
        const showId = showSpellsNodeId(choices);
        result.push({ id: showId, depth: 3, parentId: valueId, label: `Show Spells (${afterResult.spellCount})`, hasChildren: expandedIds.has(showId) });

        if (expandedIds.has(showId)) {
          // Spell entries (depth 4)
          for (const spell of afterResult.filteredSpells) {
            result.push({ id: entryNodeId(choices, spell.id), depth: 4, parentId: showId, label: spell.name, hasChildren: false });
          }
        }

        // Remaining axes (depth 3, same level as Show Spells)
        for (const remainAxis of afterResult.availableAxes) {
          const axId = axisNodeId(remainAxis.axisId, choices);
          result.push({ id: axId, depth: 3, parentId: valueId, label: `${remainAxis.label}`, hasChildren: expandedIds.has(axId) });

          if (!expandedIds.has(axId)) continue;

          // Depth 4: values for remaining axis
          for (const rv of remainAxis.values) {
            const deepChoices: AxisChoice[] = [...choices, { axisId: remainAxis.axisId, value: rv.value }];
            const deepValueId = valueNodeId(deepChoices);
            const deepLabel = `${axisValueLabel(remainAxis.axisId, rv.value)} [${rv.count}]`;
            result.push({ id: deepValueId, depth: 4, parentId: axId, label: deepLabel, hasChildren: expandedIds.has(deepValueId) });

            if (!expandedIds.has(deepValueId)) continue;
            const deepResult = computeAxisEngine(spells, deepChoices);
            const deepShowId = showSpellsNodeId(deepChoices);
            result.push({ id: deepShowId, depth: 5, parentId: deepValueId, label: `Show Spells (${deepResult.spellCount})`, hasChildren: expandedIds.has(deepShowId) });
            if (expandedIds.has(deepShowId)) {
              for (const spell of deepResult.filteredSpells) {
                result.push({ id: entryNodeId(deepChoices, spell.id), depth: 6, parentId: deepShowId, label: spell.name, hasChildren: false });
              }
            }
          }
        }
      }
    }

    return result;
  }, [spells, isExpanded, expandedIds]);

  const laid = useMemo(
    () => computeVirtualLayout({ nodes: virtualNodes, projectCenterX: projectCenter.x, projectCenterY: projectCenter.y, side }),
    [virtualNodes, projectCenter.x, projectCenter.y, side]
  );

  const laidById = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  // ---- Detail helper ----
  function buildDetail(id: string): VirtualNodeDetail | null {
    const parsed = parseVirtualNodeId(id);
    if (!parsed) return null;
    const choices = parsed.choices;
    const engineResult = computeAxisEngine(spells, choices);

    if (parsed.kind === 'axis') {
      const axisState = engineResult.availableAxes.find((a) => a.axisId === parsed.axisId);
      return { id, kind: 'axis', label: axisState?.label ?? parsed.axisId, spellCount: engineResult.spellCount, choices };
    }
    if (parsed.kind === 'value') {
      const laidNode = laidById.get(id);
      return { id, kind: 'value', label: laidNode?.label ?? id, spellCount: engineResult.spellCount, choices };
    }
    if (parsed.kind === 'show-spells') {
      return { id, kind: 'show-spells', label: 'Show Spells', spellCount: engineResult.spellCount, choices };
    }
    if (parsed.kind === 'entry') {
      const profile = spells.find((s) => s.id === parsed.spellId);
      return { id, kind: 'entry', label: profile?.name ?? parsed.spellId, spellCount: 1, choices, spellProfile: profile };
    }
    return null;
  }

  const handleVirtualClick = (id: string, hasChildren: boolean) => {
    if (hasChildren) toggleVirtualNode(id);
    const detail = buildDetail(id);
    if (detail) onVirtualNodeSelect(id, detail);
  };

  // ---- SVG Edges ----
  const edges = useMemo(() => {
    const result: Array<{ id: string; path: string }> = [];
    for (const node of laid) {
      const parent = laidById.get(node.parentId) ?? (node.depth === 1 ? {
        x: spellsProjectNode.x, y: spellsProjectNode.y,
        width: spellsProjectNode.width, height: spellsProjectNode.height
      } : null);
      if (!parent) continue;
      const pCenter = centerOf(parent as RenderNode);
      const nCenter = centerOf({ x: node.x, y: node.y, width: node.width, height: node.height } as RenderNode);
      const edgeSide: 1 | -1 = nCenter.x >= pCenter.x ? 1 : -1;
      const startX = pCenter.x + edgeSide * (('width' in parent ? parent.width : spellsProjectNode.width) / 2 - 3);
      const endX = nCenter.x - edgeSide * (node.width / 2 - 3);
      result.push({ id: `virt-edge-${node.id}`, path: buildCurvePath(startX, pCenter.y, endX, nCenter.y, edgeSide) });
    }
    return result;
  }, [laid, laidById, spellsProjectNode]);

  if (!isExpanded && laid.length === 0) {
    // Still render nothing but stay mounted so the project node's expand click is handled
    return null;
  }

  return (
    <>
      {/* SVG Edge layer */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: -canvasOffset, top: -canvasOffset, width: canvasOffset * 2, height: canvasOffset * 2, overflow: 'visible' }}
      >
        <g transform={`translate(${canvasOffset} ${canvasOffset})`}>
          {edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              stroke={isDark ? '#a78bfa' : '#7c3aed'}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
        </g>
      </svg>

      {/* Node layer */}
      {laid.map((node) => {
        const isSelected = selectedVirtualId === node.id;
        const isShow = node.id.endsWith(':show');
        const isEntry = node.id.includes(':entry:');
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => handleVirtualClick(node.id, node.hasChildren)}
            style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
            className={`rounded-xl border text-left px-3 py-2 text-xs shadow-sm transition-colors pointer-events-auto ${
              isSelected
                ? isDark ? 'border-violet-400 bg-violet-900/60 text-violet-100 ring-1 ring-violet-400/40' : 'border-violet-500 bg-violet-50 text-violet-900'
                : isShow
                  ? isDark ? 'border-violet-500/70 bg-violet-950/60 text-violet-200 hover:bg-violet-900/60' : 'border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100'
                  : isEntry
                    ? isDark ? 'border-slate-600/50 bg-slate-900/50 text-slate-300 hover:bg-slate-800/60' : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50'
                    : isDark ? 'border-violet-700/60 bg-[#1a1030cc] text-violet-100 hover:bg-violet-900/40 backdrop-blur-md' : 'border-violet-300 bg-white text-violet-900 hover:bg-violet-50'
            }`}
          >
            <span className="font-semibold leading-tight line-clamp-2">{node.label}</span>
            {node.hasChildren && (
              <span className="block text-[10px] mt-0.5 opacity-60">{expandedIds.has(node.id) ? '▾ expanded' : '▸ expand'}</span>
            )}
          </button>
        );
      })}
    </>
  );
}
```

**Note on depth limit:** The implementation above handles 2 levels of axis picking (choices → remaining axis → remaining values → show spells). To support arbitrary depth, the `virtualNodes` useMemo would need to recurse. For the initial implementation, 2 levels of axis selection covers the majority of use cases. Deeper recursion can be added in a follow-up.

### Step 4.3: Run layout tests

```bash
npx vitest run devtools/roadmap/src/spell-branch/virtual-node-id.test.ts
```

Expected: all pass.

### Step 4.4: Commit

```bash
git add devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx
git commit -m "feat(spell-graph): add SpellGraphOverlay component with layout engine"
```

---

## Task 5: Mount SpellGraphOverlay in RoadmapVisualizer

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx`

### Step 5.1: Add import

Near the top of `RoadmapVisualizer.tsx`, after the existing `spell-branch` import (if any), add:

```typescript
import { SpellGraphOverlay } from '../../../spell-branch/SpellGraphOverlay';
import type { VirtualNodeDetail } from '../../../spell-branch/types';
import { isVirtualNodeId } from '../../../spell-branch/virtual-node-id';
```

### Step 5.2: Add virtual node state

In the `RoadmapVisualizer` component body, after `const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)`:

```typescript
const [selectedVirtualId, setSelectedVirtualId] = useState<string | null>(null);
const [selectedVirtualDetail, setSelectedVirtualDetail] = useState<VirtualNodeDetail | null>(null);
```

### Step 5.3: Add prop for opening SpellBranch tab

Add to `RoadmapVisualizer`'s props interface (create one if missing, or add inline):

```typescript
interface RoadmapVisualizerProps {
  onOpenSpellBranch?: (choices: import('../../../spell-branch/types').AxisChoice[]) => void;
}
export const RoadmapVisualizer: React.FC<RoadmapVisualizerProps> = ({ onOpenSpellBranch }) => {
```

### Step 5.4: Handle virtual node selection in info panel

Find the section that renders the info panel (search for `selectedDetail`). Before/around it, add:

```typescript
// When a virtual node is selected, clear the regular node selection and vice versa
const handleVirtualNodeSelect = useCallback((id: string, detail: VirtualNodeDetail) => {
  setSelectedVirtualId(id);
  setSelectedVirtualDetail(detail);
  setSelectedNodeId(null); // clear regular selection
}, []);
```

Also update `onNodeClick` to clear virtual selection when a real node is clicked — add at the start of `onNodeClick`:
```typescript
setSelectedVirtualId(null);
setSelectedVirtualDetail(null);
```

### Step 5.5: Find the Spells project node and mount overlay

Find the section after `{graph.nodes.map(...)}` (around line 3128) and add the overlay immediately after the closing `}` of the nodes map:

```typescript
{/* Spell Graph Overlay — virtual axis-engine-powered subtree for pillar_spells */}
{(() => {
  const spellsNode = graph.nodes.find((n) => n.id === 'pillar_spells');
  if (!spellsNode) return null;
  // Determine which side the Spells project node is on
  const rootRender = graph.nodes.find((n) => n.kind === 'root');
  const rootCenterX = rootRender ? rootRender.x + rootRender.width / 2 : TRUNK_X;
  const spellsCenterX = spellsNode.x + spellsNode.width / 2;
  const overlayExpanded = expandedNodeIds.has('pillar_spells');
  if (!overlayExpanded) return null;
  return (
    <SpellGraphOverlay
      spellsProjectNode={spellsNode}
      side={spellsCenterX >= rootCenterX ? 1 : -1}
      isDark={isDark}
      selectedVirtualId={selectedVirtualId}
      onVirtualNodeSelect={handleVirtualNodeSelect}
      onOpenSpellBranch={onOpenSpellBranch ?? (() => {})}
      canvasOffset={CANVAS_OFFSET}
    />
  );
})()}
```

### Step 5.6: Add virtual detail panel rendering

Find where `selectedDetail` is rendered in the info panel JSX (search for `selectedDetail.title`). Add a parallel block before it that shows `selectedVirtualDetail` when present:

```typescript
{selectedVirtualDetail && (
  <div className="...existing info panel classes...">
    <div className="font-semibold text-sm">{selectedVirtualDetail.label}</div>
    <div className="text-xs opacity-70 mt-1">{selectedVirtualDetail.spellCount} spell{selectedVirtualDetail.spellCount !== 1 ? 's' : ''} match</div>
    {selectedVirtualDetail.choices.length > 0 && (
      <div className="text-xs opacity-50 mt-1">
        Path: {selectedVirtualDetail.choices.map((c) => `${c.axisId}=${c.value}`).join(' › ')}
      </div>
    )}
    {selectedVirtualDetail.kind === 'show-spells' && onOpenSpellBranch && (
      <button
        type="button"
        onClick={() => onOpenSpellBranch(selectedVirtualDetail.choices)}
        className="mt-2 text-xs px-2 py-1 rounded border border-violet-400 text-violet-300 hover:bg-violet-900/40"
      >
        Open in Spell Branch →
      </button>
    )}
    {selectedVirtualDetail.kind === 'entry' && selectedVirtualDetail.spellProfile && (
      <div className="text-xs mt-2 space-y-0.5 opacity-80">
        <div>School: {selectedVirtualDetail.spellProfile.school}</div>
        <div>Level: {selectedVirtualDetail.spellProfile.level === 0 ? 'Cantrip' : selectedVirtualDetail.spellProfile.level}</div>
        <div>Casting Time: {selectedVirtualDetail.spellProfile.castingTimeUnit}</div>
        {selectedVirtualDetail.spellProfile.concentration && <div>Concentration</div>}
        {selectedVirtualDetail.spellProfile.ritual && <div>Ritual</div>}
      </div>
    )}
  </div>
)}
```

The exact JSX placement depends on the current panel structure. Find the `{selectedDetail && ...}` block and add the virtual detail block immediately before or after it with a conditional that only one can show at a time.

### Step 5.7: Verify in browser

1. Open `http://localhost:3010`
2. Click the root node to expand
3. Find the "Spells" project node in the graph
4. Click it — verify it toggles expansion in `expandedNodeIds`
5. Confirm `SpellGraphOverlay` mounts and spell profiles load
6. Confirm axis nodes appear as virtual branch cards
7. Click "Class" — value nodes appear
8. Click "Wizard" — remaining axes + Show Spells appear
9. Click "Show Spells" — spell entry nodes appear

### Step 5.8: Commit

```bash
git add devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(spell-graph): mount SpellGraphOverlay in RoadmapVisualizer"
```

---

## Task 6: Wire "Open in Spell Branch →" through roadmap-entry.tsx

**Files:**
- Modify: `devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx`
- Modify: `devtools/roadmap/src/roadmap-entry.tsx`

### Step 6.1: Add initialChoices prop to SpellBranchNavigator

In `SpellBranchNavigator.tsx`, change the function signature and initial state:

```typescript
interface SpellBranchNavigatorProps {
  initialChoices?: AxisChoice[];
}

export function SpellBranchNavigator({ initialChoices = [] }: SpellBranchNavigatorProps) {
  const [choices, setChoices] = useState<AxisChoice[]>(initialChoices);
  // ... rest unchanged
```

**Note:** `initialChoices` is used as the initial value only. Because `useState` ignores prop changes after mount, the navigator needs to reset when new choices arrive from the graph. Change to:

```typescript
useEffect(() => {
  setChoices(initialChoices);
}, [initialChoices]);
```

### Step 6.2: Update roadmap-entry.tsx

```typescript
import type { AxisChoice } from './spell-branch/types';

function RoadmapApp() {
  const [activeTab, setActiveTab] = useState<TabId>('roadmap');
  const [spellBranchInitialChoices, setSpellBranchInitialChoices] = useState<AxisChoice[]>([]);

  const handleOpenSpellBranch = (choices: AxisChoice[]) => {
    setSpellBranchInitialChoices(choices);
    setActiveTab('spell-branch');
  };

  return (
    <div ...>
      ...
      {activeTab === 'roadmap' && <RoadmapVisualizer onOpenSpellBranch={handleOpenSpellBranch} />}
      {activeTab === 'spell-branch' && (
        <div ...>
          <SpellBranchNavigator initialChoices={spellBranchInitialChoices} />
        </div>
      )}
    </div>
  );
}
```

### Step 6.3: Verify end-to-end

1. In the roadmap graph, navigate to Spells → Class → Wizard → Show Spells
2. Click "Open in Spell Branch →" in the info panel
3. Confirm the Spell Branch tab opens with Class=Wizard already applied

### Step 6.4: Commit

```bash
git add devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx devtools/roadmap/src/roadmap-entry.tsx
git commit -m "feat(spell-graph): wire Open in Spell Branch from graph overlay to navigator tab"
```

---

## Known Limitations / Follow-ups

- The overlay renders virtual nodes at depths 1–6 (2 levels of axis selection). Arbitrary depth requires a fully recursive `virtualNodes` computation — deferred to follow-up.
- Spell entry nodes at depth 4+ may be numerous. Consider a "Show N more…" stub node if performance degrades.
- Drag-to-reposition is not supported for virtual nodes (by design).
- Health signals and test badges are suppressed for virtual nodes (no source data).
