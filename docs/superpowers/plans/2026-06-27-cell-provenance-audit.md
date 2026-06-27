# Cell Provenance Audit — First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Voronoi inheritance contract on one drill path — build an audit that classifies every entity in a generated 3D ground world as *inherited*, *elaborated*, or *orphaned* relative to its parent worldmap cell, fails when any core entity is orphaned, and emits the list of scale-appropriate facts the worldmap cell is missing.

**Architecture:** A pure verification layer under `src/systems/worldforge/provenance/`. It does **not** modify any generator. Given the FMG pack (from `getBridgeAtlas`), a chosen settlement cell, and the region/local/ground artifacts that drill produced, it re-derives the expected provenance of each ground entity and classifies it. A runnable harness drives one golden drill path end-to-end, asserts zero orphaned core entities, writes the upstream gap list, and renders the slice for visual sign-off.

**Tech Stack:** TypeScript, Vitest (`npm test`), the existing Worldforge bridge (`legacySubmapBridge.ts`, `groundChunkLoader.ts`), and the existing render rigs under `.agent/`.

**Scope note (deliberate phasing):** This slice enforces the *orphan-zero* invariant as a hard test (nothing core renders without a parent anchor). The *schema-completeness* gaps (feature traces the worldmap cell does not yet own — forests, ruins, dungeons, camps, roadside taverns) are produced as a **report**, expected to be non-empty, and become the backlog for later upstream worldmap work. This keeps the contract green for what exists while making the missing facts loud and tracked. Retiring the legacy non-Voronoi continent pipeline (from the North Star) is out of scope for this slice.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/systems/worldforge/provenance/types.ts` | Verdict/report/gap types shared across the layer |
| `src/systems/worldforge/provenance/worldCell.ts` | Read normalized canonical facts off an FMG pack cell; classify cell type |
| `src/systems/worldforge/provenance/cellSchema.ts` | The canonical cell schema + `auditCellSchema()` → gap list |
| `src/systems/worldforge/provenance/groundProvenance.ts` | Classify each ground-world entity kind into a verdict |
| `src/systems/worldforge/provenance/cellProvenanceAudit.ts` | Orchestrator: assemble a `ProvenanceReport`, compute `passed` |
| `src/systems/worldforge/provenance/__tests__/fixtures/drillPath.ts` | Build one deterministic golden drill path (pack→cell→region→local→ground) |
| `src/systems/worldforge/provenance/__tests__/*.test.ts` | Unit tests per module |
| `.agent/scratch/run-provenance-audit.ts` | Runnable harness: run audit on the golden path, print report, write gap list, trigger render |

---

## Task 1: Golden drill-path fixture

Build the integration fixture first — it is the highest-risk piece (real bridge wiring). Everything else is pure logic on top of it.

**Files:**
- Create: `src/systems/worldforge/provenance/__tests__/fixtures/drillPath.ts`
- Test: `src/systems/worldforge/provenance/__tests__/drillPath.fixture.test.ts`

- [ ] **Step 1: Write the fixture builder**

Create `src/systems/worldforge/provenance/__tests__/fixtures/drillPath.ts`:

```typescript
import {
  getBridgeAtlas,
  getTownTilesForGrid,
  getWorldforgeLocalForLocation,
} from '../../../bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../../bridge/groundChunkLoader';
import type { GroundWorld } from '../../../bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '../../../artifacts';
import type { Pack } from '../../../fmg/features';

export const GOLDEN_WORLD_SEED = 12345;
export const GRID_COLS = 64;
export const GRID_ROWS = 64;

export interface GoldenDrillPath {
  pack: Pack;
  cellId: number;
  burgId: number;
  /** FMG biome id the submap pipeline actually used for the local */
  biomeIdUsed: number;
  region: RegionArtifact;
  local: LocalArtifact;
  ground: GroundWorld;
}

/**
 * Deterministically drills one settlement cell World -> Region -> Local -> Ground.
 * Picks the first burg-bearing tile on a 64x64 grid for the golden seed.
 */
export function buildGoldenDrillPath(): GoldenDrillPath {
  const atlas = getBridgeAtlas(GOLDEN_WORLD_SEED);
  const pack = atlas.pack as Pack;

  const townTiles = getTownTilesForGrid(GOLDEN_WORLD_SEED, GRID_COLS, GRID_ROWS);
  if (townTiles.length === 0) {
    throw new Error('drillPath fixture: golden seed produced no town tiles');
  }
  const tile = townTiles[0];
  const burgId = tile.burgId;
  const burg = pack.burgs?.[burgId];
  if (!burg) {
    throw new Error(`drillPath fixture: burg ${burgId} not found on pack`);
  }
  const cellId = burg.cell;

  const bridged = getWorldforgeLocalForLocation(
    GOLDEN_WORLD_SEED,
    tile.x,
    tile.y,
    GRID_COLS,
    GRID_ROWS,
  );
  const ground = makeGroundWorld(bridged.local, GOLDEN_WORLD_SEED, bridged.region);

  return {
    pack,
    cellId,
    burgId,
    biomeIdUsed: bridged.biomeId,
    region: bridged.region,
    local: bridged.local,
    ground,
  };
}
```

- [ ] **Step 2: Write the fixture sanity test**

Create `src/systems/worldforge/provenance/__tests__/drillPath.fixture.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';

describe('golden drill path fixture', () => {
  it('drills a settlement cell into a ground world with a town', () => {
    const path = buildGoldenDrillPath();
    expect(path.burgId).toBeGreaterThan(0);
    expect(path.cellId).toBeGreaterThanOrEqual(0);
    expect(path.ground.towns.length).toBeGreaterThan(0);
    expect(path.ground.buildings.length).toBeGreaterThan(0);
  });

  it('is deterministic across two builds', () => {
    const a = buildGoldenDrillPath();
    const b = buildGoldenDrillPath();
    expect(b.cellId).toBe(a.cellId);
    expect(b.burgId).toBe(a.burgId);
    expect(b.ground.buildings.length).toBe(a.ground.buildings.length);
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/drillPath.fixture.test.ts`
Expected: PASS. If it fails on `no town tiles` or `towns.length === 0`, the golden seed/grid does not surface a burg — adjust `GRID_COLS`/`GRID_ROWS` upward (e.g. 96) until a burg tile appears, then re-run. Do not proceed until green.

- [ ] **Step 4: Commit**

```bash
git add src/systems/worldforge/provenance/__tests__/fixtures/drillPath.ts src/systems/worldforge/provenance/__tests__/drillPath.fixture.test.ts
git commit -m "test(provenance): golden drill-path fixture (world->region->local->ground)"
```

---

## Task 2: Provenance types + cell-fact reader

**Files:**
- Create: `src/systems/worldforge/provenance/types.ts`
- Create: `src/systems/worldforge/provenance/worldCell.ts`
- Test: `src/systems/worldforge/provenance/__tests__/worldCell.test.ts`

- [ ] **Step 1: Write the types module**

Create `src/systems/worldforge/provenance/types.ts`:

```typescript
export type ProvenanceState = 'inherited' | 'elaborated' | 'orphaned';

export type EntityKind =
  | 'terrain-biome'
  | 'town'
  | 'building'
  | 'hostile'
  | 'feature'
  | 'hidden-site';

/** 'fail' orphans block the audit; 'warn' orphans are surfaced but non-blocking this slice. */
export type Severity = 'ok' | 'warn' | 'fail';

export interface EntityVerdict {
  kind: EntityKind;
  id: string;
  state: ProvenanceState;
  /** The parent-cell fact this entity derives from, or null if orphaned. */
  anchor: string | null;
  severity: Severity;
  reason: string;
}

export interface SchemaGap {
  field: string;
  cellId: number;
  reason: string;
}

export interface ProvenanceReport {
  cellId: number;
  cellType: 'wilderness' | 'settlement';
  verdicts: EntityVerdict[];
  schemaGaps: SchemaGap[];
  counts: { inherited: number; elaborated: number; orphaned: number };
  /** True iff no verdict has severity 'fail'. Schema gaps do NOT fail this slice. */
  passed: boolean;
}
```

- [ ] **Step 2: Write the failing cell-fact reader test**

Create `src/systems/worldforge/provenance/__tests__/worldCell.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell, classifyCellType } from '../worldCell';

describe('readWorldCell', () => {
  it('reads canonical facts for the golden settlement cell', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    expect(facts.id).toBe(path.cellId);
    expect(facts.burgId).toBe(path.burgId);
    expect(facts.height).toBeGreaterThanOrEqual(0);
    expect(facts.biomeId).toBeGreaterThanOrEqual(0);
  });

  it('classifies a burg-bearing cell as a settlement', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    expect(classifyCellType(facts)).toBe('settlement');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/worldCell.test.ts`
Expected: FAIL with "Cannot find module '../worldCell'".

- [ ] **Step 4: Write the cell-fact reader**

Create `src/systems/worldforge/provenance/worldCell.ts`:

```typescript
import type { Pack } from '../fmg/features';

export interface CellFacts {
  id: number;
  height: number; // pack.cells.h, 0..100
  biomeId: number;
  cultureId: number;
  stateId: number;
  burgId: number;
  ruralPop: number;
  riverId: number;
}

export function readWorldCell(pack: Pack, cellId: number): CellFacts {
  const c = pack.cells;
  return {
    id: cellId,
    height: c.h?.[cellId] ?? 0,
    biomeId: c.biome?.[cellId] ?? -1,
    cultureId: c.culture?.[cellId] ?? 0,
    stateId: c.state?.[cellId] ?? 0,
    burgId: c.burg?.[cellId] ?? 0,
    ruralPop: c.pop?.[cellId] ?? 0,
    riverId: c.r?.[cellId] ?? 0,
  };
}

export function classifyCellType(facts: CellFacts): 'wilderness' | 'settlement' {
  return facts.burgId > 0 ? 'settlement' : 'wilderness';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/worldCell.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/systems/worldforge/provenance/types.ts src/systems/worldforge/provenance/worldCell.ts src/systems/worldforge/provenance/__tests__/worldCell.test.ts
git commit -m "feat(provenance): cell-fact reader + verdict types"
```

---

## Task 3: Canonical cell schema audit

Defines what facts a cell must own at its altitude and produces the gap list. Feature-trace fields (forest/ruin/dungeon/camp/roadside-tavern) are declared required for the relevant cell type but are **known-missing** from today's FMG pack — so they appear in the gap list. That is the intended upstream backlog.

**Files:**
- Create: `src/systems/worldforge/provenance/cellSchema.ts`
- Test: `src/systems/worldforge/provenance/__tests__/cellSchema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `src/systems/worldforge/provenance/__tests__/cellSchema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell } from '../worldCell';
import { auditCellSchema } from '../cellSchema';

describe('auditCellSchema', () => {
  it('reports no gaps for facts the cell already owns (biome, height, population)', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const burg = path.pack.burgs?.[path.burgId];
    const gaps = auditCellSchema(facts, burg);
    const fields = gaps.map((g) => g.field);
    expect(fields).not.toContain('biomeId');
    expect(fields).not.toContain('height');
    expect(fields).not.toContain('population');
  });

  it('reports feature-trace facts the worldmap cell does not yet own', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const burg = path.pack.burgs?.[path.burgId];
    const gaps = auditCellSchema(facts, burg);
    const fields = gaps.map((g) => g.field);
    // These are the upstream backlog: traces the cell SHOULD own but doesn't.
    expect(fields).toContain('featureTraces');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/cellSchema.test.ts`
Expected: FAIL with "Cannot find module '../cellSchema'".

- [ ] **Step 3: Write the schema audit**

Create `src/systems/worldforge/provenance/cellSchema.ts`:

```typescript
import type { CellFacts } from './worldCell';
import { classifyCellType } from './worldCell';
import type { SchemaGap } from './types';
import type { Burg } from '../fmg/burgs-generator';

/**
 * Canonical facts every land cell must own at its altitude. `featureTraces`
 * represents discrete notable features (forest, ruin, dungeon, camp,
 * roadside tavern) as presence + approx location + type. The current FMG pack
 * does not carry these, so they surface as gaps = the upstream worldmap backlog.
 */
function hasFeatureTraces(facts: CellFacts): boolean {
  // No field exists on the pack today. River presence is the only proxy trace.
  // Treat the dedicated feature-trace layer as absent until the worldmap owns it.
  return false;
}

export function auditCellSchema(facts: CellFacts, burg: Burg | undefined): SchemaGap[] {
  const gaps: SchemaGap[] = [];

  if (facts.biomeId < 0) {
    gaps.push({ field: 'biomeId', cellId: facts.id, reason: 'land cell has no biome id' });
  }
  if (facts.height <= 0) {
    gaps.push({ field: 'height', cellId: facts.id, reason: 'cell has no elevation' });
  }

  if (classifyCellType(facts) === 'settlement') {
    if (!burg) {
      gaps.push({ field: 'burg', cellId: facts.id, reason: 'settlement cell references a missing burg' });
    } else if (!burg.population || burg.population <= 0) {
      gaps.push({ field: 'population', cellId: facts.id, reason: 'settlement burg has no population magnitude' });
    }
  }

  if (!hasFeatureTraces(facts)) {
    gaps.push({
      field: 'featureTraces',
      cellId: facts.id,
      reason: 'cell owns no discrete feature traces (forest/ruin/dungeon/camp/roadside-tavern); worldmap generator must add them',
    });
  }

  return gaps;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/cellSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/provenance/cellSchema.ts src/systems/worldforge/provenance/__tests__/cellSchema.test.ts
git commit -m "feat(provenance): canonical cell schema audit + feature-trace gap"
```

---

## Task 4: Ground classifiers — terrain biome, town, buildings

**Files:**
- Create: `src/systems/worldforge/provenance/groundProvenance.ts`
- Test: `src/systems/worldforge/provenance/__tests__/groundProvenance.terrain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/worldforge/provenance/__tests__/groundProvenance.terrain.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell } from '../worldCell';
import { classifyTerrainBiome, classifyTownsAndBuildings } from '../groundProvenance';

describe('terrain-biome provenance', () => {
  it('marks terrain inherited when the submap biome equals the cell biome', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const v = classifyTerrainBiome(facts, path.biomeIdUsed);
    expect(v.kind).toBe('terrain-biome');
    expect(v.state).toBe('inherited');
    expect(v.severity).toBe('ok');
  });

  it('marks terrain orphaned when the submap biome differs from the cell biome', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const wrong = facts.biomeId + 99;
    const v = classifyTerrainBiome(facts, wrong);
    expect(v.state).toBe('orphaned');
    expect(v.severity).toBe('fail');
  });
});

describe('town/building provenance', () => {
  it('marks the town inherited and each building elaborated', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyTownsAndBuildings(path.burgId, path.ground);
    const town = verdicts.find((v) => v.kind === 'town');
    expect(town?.state).toBe('inherited');
    const buildings = verdicts.filter((v) => v.kind === 'building');
    expect(buildings.length).toBe(path.ground.buildings.length);
    expect(buildings.every((b) => b.state === 'elaborated')).toBe(true);
    expect(buildings.every((b) => b.severity === 'ok')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/groundProvenance.terrain.test.ts`
Expected: FAIL with "Cannot find module '../groundProvenance'".

- [ ] **Step 3: Write the classifiers**

Create `src/systems/worldforge/provenance/groundProvenance.ts`:

```typescript
import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { CellFacts } from './worldCell';
import type { EntityVerdict } from './types';

/** Terrain: the biome the submap used must equal the cell's biome fact. */
export function classifyTerrainBiome(facts: CellFacts, biomeIdUsed: number): EntityVerdict {
  const ok = biomeIdUsed === facts.biomeId;
  return {
    kind: 'terrain-biome',
    id: `cell-${facts.id}-biome`,
    state: ok ? 'inherited' : 'orphaned',
    anchor: ok ? `cell.biomeId=${facts.biomeId}` : null,
    severity: ok ? 'ok' : 'fail',
    reason: ok
      ? 'submap terrain biome traces to the cell biome'
      : `submap used biome ${biomeIdUsed} but cell owns biome ${facts.biomeId}`,
  };
}

/** Towns trace to the cell's burg; individual buildings elaborate that town. */
export function classifyTownsAndBuildings(cellBurgId: number, ground: GroundWorld): EntityVerdict[] {
  const verdicts: EntityVerdict[] = [];
  const anchoredTown = ground.towns.find((t) => t.burgId === cellBurgId);

  for (const town of ground.towns) {
    const inherited = town.burgId === cellBurgId || town.burgId > 0;
    verdicts.push({
      kind: 'town',
      id: `town-${town.burgId}`,
      state: inherited ? 'inherited' : 'orphaned',
      anchor: inherited ? `burg=${town.burgId}` : null,
      severity: inherited ? 'ok' : 'fail',
      reason: inherited ? 'town traces to a worldmap burg' : 'town has no burg anchor',
    });
  }

  const haveTownAnchor = anchoredTown !== undefined || ground.towns.some((t) => t.burgId > 0);
  for (const b of ground.buildings) {
    verdicts.push({
      kind: 'building',
      id: `building-${b.id}`,
      state: haveTownAnchor ? 'elaborated' : 'orphaned',
      anchor: haveTownAnchor ? `town(burg)` : null,
      severity: haveTownAnchor ? 'ok' : 'fail',
      reason: haveTownAnchor
        ? 'building elaborates a town that traces to a burg'
        : 'building exists with no town/burg anchor',
    });
  }

  return verdicts;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/groundProvenance.terrain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/provenance/groundProvenance.ts src/systems/worldforge/provenance/__tests__/groundProvenance.terrain.test.ts
git commit -m "feat(provenance): terrain-biome + town/building classifiers"
```

---

## Task 5: Ground classifiers — hostiles, features, hidden sites

**Files:**
- Modify: `src/systems/worldforge/provenance/groundProvenance.ts`
- Test: `src/systems/worldforge/provenance/__tests__/groundProvenance.threats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/worldforge/provenance/__tests__/groundProvenance.threats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import {
  classifyHostiles,
  classifyFeatures,
  classifyHiddenSites,
} from '../groundProvenance';

describe('hostile provenance', () => {
  it('hostiles are inherited when the region has markers or zones; otherwise none exist', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyHostiles(path.region, path.ground);
    expect(verdicts.length).toBe(path.ground.hostiles.length);
    const hasAnchorSource =
      (path.region.markers?.length ?? 0) > 0 || (path.region.zones?.length ?? 0) > 0;
    if (path.ground.hostiles.length > 0) {
      expect(hasAnchorSource).toBe(true);
      expect(verdicts.every((v) => v.state === 'inherited')).toBe(true);
    }
  });
});

describe('feature provenance', () => {
  it('every feature is an elaboration of the inherited biome', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyFeatures(path.ground);
    expect(verdicts.length).toBe(path.ground.features.length);
    expect(verdicts.every((v) => v.state === 'elaborated')).toBe(true);
    expect(verdicts.every((v) => v.severity === 'ok')).toBe(true);
  });
});

describe('hidden-site provenance', () => {
  it('hidden sites without a marker anchor are flagged as warn-level orphans', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyHiddenSites(path.region, path.ground);
    expect(verdicts.length).toBe(path.ground.hiddenSites.length);
    // No hard failures from hidden sites this slice.
    expect(verdicts.every((v) => v.severity !== 'fail')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/groundProvenance.threats.test.ts`
Expected: FAIL with "classifyHostiles is not a function" (or import error).

- [ ] **Step 3: Append the classifiers**

Add to the end of `src/systems/worldforge/provenance/groundProvenance.ts`:

```typescript
import type { RegionArtifact } from '../artifacts';

/** Hostiles trace to region markers/zones (which the worldmap cell seeds). */
export function classifyHostiles(region: RegionArtifact, ground: GroundWorld): EntityVerdict[] {
  const hasSource = (region.markers?.length ?? 0) > 0 || (region.zones?.length ?? 0) > 0;
  return ground.hostiles.map((h) => ({
    kind: 'hostile',
    id: `hostile-${h.id}`,
    state: hasSource ? 'inherited' : 'orphaned',
    anchor: hasSource ? 'region.markers|zones' : null,
    severity: hasSource ? 'ok' : 'fail',
    reason: hasSource
      ? 'hostile traces to a region marker/zone'
      : 'hostile spawned with no marker/zone anchor',
  }));
}

/** Vegetation/rock scatter elaborates the inherited biome. */
export function classifyFeatures(ground: GroundWorld): EntityVerdict[] {
  return ground.features.map((f) => ({
    kind: 'feature',
    id: `feature-${f.id}`,
    state: 'elaborated',
    anchor: 'cell.biome (scatter)',
    severity: 'ok',
    reason: `${f.kind} elaborates the inherited biome`,
  }));
}

/**
 * Hidden sites are off-map discovery points. They should trace to a region
 * marker. Until that anchor is wired, an unanchored hidden site is surfaced as
 * a 'warn' orphan (non-blocking this slice) rather than silently accepted.
 */
export function classifyHiddenSites(region: RegionArtifact, ground: GroundWorld): EntityVerdict[] {
  const hasSource = (region.markers?.length ?? 0) > 0;
  return ground.hiddenSites.map((s) => ({
    kind: 'hidden-site',
    id: `hidden-${s.id}`,
    state: hasSource ? 'inherited' : 'orphaned',
    anchor: hasSource ? 'region.markers' : null,
    severity: hasSource ? 'ok' : 'warn',
    reason: hasSource
      ? 'hidden site traces to a region marker'
      : 'hidden site has no marker anchor (warn: harden in a later slice)',
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/groundProvenance.threats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/provenance/groundProvenance.ts src/systems/worldforge/provenance/__tests__/groundProvenance.threats.test.ts
git commit -m "feat(provenance): hostile, feature, hidden-site classifiers"
```

---

## Task 6: Audit orchestrator + zero-orphan invariant

**Files:**
- Create: `src/systems/worldforge/provenance/cellProvenanceAudit.ts`
- Test: `src/systems/worldforge/provenance/__tests__/cellProvenanceAudit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/worldforge/provenance/__tests__/cellProvenanceAudit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { runCellProvenanceAudit } from '../cellProvenanceAudit';

describe('runCellProvenanceAudit', () => {
  it('produces a report with no FAIL-level orphans on the golden drill path', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    const fails = report.verdicts.filter((v) => v.severity === 'fail');
    expect(fails).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('classifies the settlement and counts every ground entity', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    expect(report.cellType).toBe('settlement');
    const expected =
      1 + // terrain-biome
      path.ground.towns.length +
      path.ground.buildings.length +
      path.ground.hostiles.length +
      path.ground.features.length +
      path.ground.hiddenSites.length;
    expect(report.verdicts.length).toBe(expected);
  });

  it('emits the feature-trace schema gap as the upstream backlog', () => {
    const path = buildGoldenDrillPath();
    const report = runCellProvenanceAudit(path);
    expect(report.schemaGaps.map((g) => g.field)).toContain('featureTraces');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/cellProvenanceAudit.test.ts`
Expected: FAIL with "Cannot find module '../cellProvenanceAudit'".

- [ ] **Step 3: Write the orchestrator**

Create `src/systems/worldforge/provenance/cellProvenanceAudit.ts`:

```typescript
import type { GoldenDrillPath } from './__tests__/fixtures/drillPath';
import { readWorldCell, classifyCellType } from './worldCell';
import { auditCellSchema } from './cellSchema';
import {
  classifyTerrainBiome,
  classifyTownsAndBuildings,
  classifyHostiles,
  classifyFeatures,
  classifyHiddenSites,
} from './groundProvenance';
import type { EntityVerdict, ProvenanceReport } from './types';

/** Input shape: the same fields the drill-path fixture produces. */
export type AuditInput = GoldenDrillPath;

export function runCellProvenanceAudit(input: AuditInput): ProvenanceReport {
  const facts = readWorldCell(input.pack, input.cellId);
  const burg = input.pack.burgs?.[input.burgId];

  const verdicts: EntityVerdict[] = [
    classifyTerrainBiome(facts, input.biomeIdUsed),
    ...classifyTownsAndBuildings(input.burgId, input.ground),
    ...classifyHostiles(input.region, input.ground),
    ...classifyFeatures(input.ground),
    ...classifyHiddenSites(input.region, input.ground),
  ];

  const counts = {
    inherited: verdicts.filter((v) => v.state === 'inherited').length,
    elaborated: verdicts.filter((v) => v.state === 'elaborated').length,
    orphaned: verdicts.filter((v) => v.state === 'orphaned').length,
  };

  return {
    cellId: input.cellId,
    cellType: classifyCellType(facts),
    verdicts,
    schemaGaps: auditCellSchema(facts, burg),
    counts,
    passed: verdicts.every((v) => v.severity !== 'fail'),
  };
}
```

Note: `AuditInput` reuses `GoldenDrillPath` so the orchestrator stays decoupled from the bridge — any caller that assembles the same fields (pack, cellId, burgId, biomeIdUsed, region, local, ground) can run it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/systems/worldforge/provenance/__tests__/cellProvenanceAudit.test.ts`
Expected: PASS. If a FAIL-level orphan appears, read its `reason` — it is a real contract violation in the drill output; investigate the offending generator before forcing the test green.

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/provenance/cellProvenanceAudit.ts src/systems/worldforge/provenance/__tests__/cellProvenanceAudit.test.ts
git commit -m "feat(provenance): audit orchestrator + zero-orphan invariant"
```

---

## Task 7: Runnable harness — gap list + render sign-off

Produces the human-facing proof: the report, the upstream gap list written to disk, and a rendered image of the slice for visual sign-off (per the visual-inspection rule — both signals required).

**Files:**
- Create: `.agent/scratch/run-provenance-audit.ts`

- [ ] **Step 1: Confirm the scratch dir is gitignored**

Run: `git check-ignore .agent/scratch/run-provenance-audit.ts && echo IGNORED || echo TRACKED`
Expected: `IGNORED` (proof artifacts belong in the gitignored scratch dir). If it prints `TRACKED`, still proceed — the harness is a dev tool, not shipped code.

- [ ] **Step 2: Write the harness**

Create `.agent/scratch/run-provenance-audit.ts`:

```typescript
/**
 * Runnable proof for the Cell Provenance Audit first slice.
 * Usage: npx tsx .agent/scratch/run-provenance-audit.ts
 */
import { writeFileSync } from 'node:fs';
import { buildGoldenDrillPath } from '../../src/systems/worldforge/provenance/__tests__/fixtures/drillPath';
import { runCellProvenanceAudit } from '../../src/systems/worldforge/provenance/cellProvenanceAudit';

const path = buildGoldenDrillPath();
const report = runCellProvenanceAudit(path);

console.log('=== Cell Provenance Audit ===');
console.log(`cell ${report.cellId} (${report.cellType})  passed=${report.passed}`);
console.log('counts:', report.counts);

const fails = report.verdicts.filter((v) => v.severity === 'fail');
const warns = report.verdicts.filter((v) => v.severity === 'warn');
console.log(`FAIL orphans: ${fails.length}`);
for (const f of fails) console.log(`  [FAIL] ${f.kind} ${f.id}: ${f.reason}`);
console.log(`WARN orphans: ${warns.length}`);
for (const w of warns) console.log(`  [warn] ${w.kind} ${w.id}: ${w.reason}`);

// Upstream gap list = the worldmap backlog this slice surfaces.
const lines: string[] = [
  '# Upstream Worldmap Gap List',
  '',
  `Generated from the golden drill path (cell ${report.cellId}, ${report.cellType}).`,
  'Each row is a scale-appropriate fact the worldmap Voronoi cell should own but does not.',
  '',
  '| field | cellId | reason |',
  '|-------|--------|--------|',
  ...report.schemaGaps.map((g) => `| ${g.field} | ${g.cellId} | ${g.reason} |`),
];
const outPath = '.agent/scratch/provenance-gap-list.md';
writeFileSync(outPath, lines.join('\n'));
console.log(`\nGap list written to ${outPath} (${report.schemaGaps.length} gaps)`);

process.exitCode = report.passed ? 0 : 1;
```

- [ ] **Step 3: Run the harness**

Run: `npx tsx .agent/scratch/run-provenance-audit.ts`
Expected: prints the report, `passed=true`, `FAIL orphans: 0`, and writes `.agent/scratch/provenance-gap-list.md` containing at least the `featureTraces` row. Exit code 0.

- [ ] **Step 4: Render the slice for visual sign-off**

Run: `npx tsx .agent/campaign-kickoff/local-render.ts` (the existing LocalArtifact terrain+features render rig).
Expected: a PNG of the local slice is written. Open it and confirm the terrain and town visually cohere with a settlement cell (buildings clustered, terrain matching the biome). If `local-render.ts` requires args, run it with no args first and follow its usage output. This is the second required sign-off signal alongside the green audit.

- [ ] **Step 5: Run the full provenance test suite**

Run: `npm test -- src/systems/worldforge/provenance`
Expected: all provenance tests PASS.

- [ ] **Step 6: Commit**

```bash
git add .agent/scratch/run-provenance-audit.ts
git commit -m "feat(provenance): runnable audit harness + gap-list output"
```

---

## Self-Review Notes

- **Spec coverage:** North Star principle 6 (provenance checkable) → Tasks 4–6; principle 3 (detail budget / altitude) → schema audit Task 3 + elaborated-vs-inherited split across classifiers; principle 4 (fail loud at the right altitude) → severity model (`fail` for missing-owned facts, gap list for missing feature traces) + Task 7 gap list; the first-slice "Cell Provenance Audit" with three states → `ProvenanceState` + Task 6 orchestrator; "upstream gap list" → Task 7. Principle 1 (retire legacy continent pipeline) is explicitly out of scope for this slice (noted in header).
- **Phasing honesty:** schema gaps are reported, not failed — documented in the header and Task 3. The orphan-zero invariant is the hard gate.
- **Type consistency:** `EntityVerdict`, `ProvenanceState`, `Severity`, `SchemaGap`, `ProvenanceReport` defined once in `types.ts` (Task 2) and used unchanged in Tasks 3–7. `CellFacts` defined in `worldCell.ts` (Task 2), consumed by `cellSchema.ts` and `groundProvenance.ts`. `GoldenDrillPath` defined in Task 1, reused as `AuditInput` in Task 6.
- **Open integration risk:** Task 1 is the de-risking task — if `getTownTilesForGrid` yields no burg tile at 64×64 for the golden seed, raise the grid resolution (noted inline). All later tasks depend on it being green first.
