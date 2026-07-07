# Building Generator v2 — Phase 1A: Inhabited Buildings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate each town building FROM the family that lives in it, and make the family visibly use it — room claims, daily schedules bound to furniture, and containers holding real, owned items.

**Architecture:** Two layers. The **permanent blueprint** (`BlueprintPlan`) gains additive inputs — a `HouseholdBrief`, frontage, and reserved style/history fields — and its room programs become brief-driven. The **living overlay** (`BuildingOccupancy`) is a new pure module computed from `(plan, named household)`: claims, hourly stations, state flags, container manifests. The overlay is derived data, never saved, and can never move a wall.

**Tech Stack:** TypeScript, Vitest, the frozen worldforge seed-path RNG (`rngFromPath(streamPath(...))`), pure data modules (zero `three` imports).

**Spec:** `docs/superpowers/specs/2026-07-07-building-generator-v2-living-buildings.md`

## Global Constraints

- Feet-canon 5 ft grid (`CELL_FT = 5`); all coords feet, cells are 5×5 ft.
- Pure data: zero `three` imports in any generator or overlay module.
- Deterministic: all randomness via `rngFromPath(streamPath(path, '<concern>'))`; **never `Math.random()`**. New concerns get NEW stream names so existing streams are not perturbed.
- No fallback / graceful degradation: unmapped types/roles **throw**; honest omission over substitution.
- US spelling everywhere (color, gray, -ize).
- **Do NOT commit, do NOT branch.** Work only in `master`; the repo auto-snapshots daily at 2am. Each task ends with its tests green and `npx tsc --noEmit` clean on touched files — there is no commit step.
- Tests: loop ≥50 seeds for per-seed invariants; use independent oracles (recompute from `rg`/cells, never from the implementation's own helper output).
- v1 goldens re-freeze ONLY in Task 12, deliberately — earlier tasks must not silently update snapshots.
- Every coined term already in `tools/agora/GLOSSARY.md` (household brief, living overlay, etc.) — add any NEW term you coin in the same turn.

## File Structure (what exists / what lands)

```
src/systems/worldforge/interior/
  blueprintTypes.ts      MODIFY  Task 1 (BuildingType 14) + Task 3 (v2 contract delta) — FROZEN after Task 3
  footprint.ts           MODIFY  Task 1 (TYPE_CONFIG for 9 new types)
  partition.ts           MODIFY  Task 1 (roomCapFor for new types)
  program.ts             MODIFY  Task 2 (programs) + Task 7 (brief slots, street-facing, upper floors)
  furnish.ts             MODIFY  Task 2 (recipes for new purposes)
  doors.ts               MODIFY  Task 9 (street-side entry preference)
  walls.ts               MODIFY  Task 9 (street-side shopfront glazing)
  generateInterior.ts    MODIFY  Task 1 (ROLE_TO_TYPE, BASEMENT_CHANCE) + Task 11 (brief pass-through)
  generateBuilding.ts    MODIFY  Task 8 (household input, bedroom distribution, memo key, frontage)
  tradeRooms.ts          CREATE  Task 5 (trade → demanded rooms table)
  briefProgram.ts        CREATE  Task 6 (brief → building program: bedrooms, extras)
  occupancy.ts           CREATE  Task 10 (living overlay: claims, stations, flags)
  manifests.ts           CREATE  Task 10 (container manifests)
src/systems/worldforge/town/
  householdBrief.ts      CREATE  Task 4 (Household/plot → HouseholdBrief)
src/data/items/
  householdGoods.ts      CREATE  Task 10 (mundane container items)
  index.ts               MODIFY  Task 10 (merge householdGoods into ALL_ITEMS)
src/types/items.ts       MODIFY  Task 10 (Item.stolenFrom?)
src/systems/worldforge/bridge/interiorParts.ts   MODIFY  Task 11 (thread plot population fields)
src/components/DesignPreview/steps/PreviewBlueprint.tsx  MODIFY  Task 13 (occupancy toggle)
src/systems/worldforge/bridge/ (occupancy exposure)      MODIFY  Task 14
```

Dependency order: 1 → 2 → 3 → (4, 5 parallel) → 6 → 7 → 8 → 9 → (10 after 3; 11 after 8) → 12 → 13 → 14. Task 3 freezes `blueprintTypes.ts`; every later task builds on the frozen shape.

---

### Task 1: Shared vocabulary — 14 building types

Close the town↔generator vocabulary gap: grow `BuildingType` from 5 to 14 so the generator speaks every word town generation places. The town population classifier (`src/systems/worldforge/town/population.ts` `BuildingType`, 11 values) must be a strict subset of the new list.

**Files:**
- Modify: `src/systems/worldforge/interior/blueprintTypes.ts:3`
- Modify: `src/systems/worldforge/interior/footprint.ts:39-45` (`TYPE_CONFIG`)
- Modify: `src/systems/worldforge/interior/partition.ts` (`roomCapFor`)
- Modify: `src/systems/worldforge/interior/generateInterior.ts:85-100` (`ROLE_TO_TYPE`), `:190-196` (`BASEMENT_CHANCE`)
- Test: `src/systems/worldforge/interior/__tests__/vocabulary.test.ts` (new)

**Interfaces:**
- Consumes: existing `Footprint`, `genFootprint(path, type)`, `roomCapFor(type)`.
- Produces: `BuildingType` (14 values) — every later task keys tables on it:

```ts
export type BuildingType =
  // residential
  | 'cottage' | 'townhouse' | 'tenement' | 'farmstead'
  // workplaces
  | 'shop' | 'smithy' | 'workshop' | 'inn' | 'tavern' | 'storehouse'
  // grand / civic
  | 'manor' | 'temple' | 'keep' | 'civic';
```

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/interior/__tests__/vocabulary.test.ts
import { describe, expect, it } from 'vitest';
import { genFootprint } from '../footprint';
import { roomCapFor } from '../partition';
import { buildingTypeForRole, BASEMENT_CHANCE } from '../generateInterior';
import { rootSeedPath } from '../../seedPath';
import type { BuildingType } from '../blueprintTypes';
import type { BuildingType as TownBuildingType } from '../../town/population';

const ALL_TYPES: BuildingType[] = [
  'cottage', 'townhouse', 'tenement', 'farmstead',
  'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse',
  'manor', 'temple', 'keep', 'civic',
];

describe('shared building vocabulary', () => {
  it('town population types are assignable to blueprint types', () => {
    // Type-level check: if population.BuildingType stops being a subset,
    // this line stops compiling.
    const townType: TownBuildingType = 'tenement';
    const asBlueprint: BuildingType = townType;
    expect(asBlueprint).toBe('tenement');
  });

  it('every type rolls a valid footprint over 50 seeds', () => {
    for (const type of ALL_TYPES) {
      for (let seed = 0; seed < 50; seed++) {
        const fp = genFootprint(rootSeedPath(seed), type);
        expect(fp.cells.length).toBeGreaterThanOrEqual(12); // ≥ 12 cells = 300 sq ft min
        expect(roomCapFor(type)).toBeGreaterThanOrEqual(3);
        expect(BASEMENT_CHANCE[type]).toBeGreaterThanOrEqual(0);
        expect(BASEMENT_CHANCE[type]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every town role maps to a real type; temple/keep/civic are no longer manor', () => {
    expect(buildingTypeForRole('temple')).toBe('temple');
    expect(buildingTypeForRole('keep')).toBe('keep');
    expect(buildingTypeForRole('civic')).toBe('civic');
    expect(buildingTypeForRole('house')).toBe('cottage');
    expect(() => buildingTypeForRole('lighthouse')).toThrow(/no BuildingType mapping/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/vocabulary.test.ts`
Expected: FAIL — TS errors on the new type values ('townhouse' not assignable) and mapping assertions.

- [ ] **Step 3: Implement**

In `blueprintTypes.ts` replace line 3 with the 14-value union above.

In `footprint.ts` extend `TYPE_CONFIG` (sizes in cells; keep the existing five entries unchanged so their seeds reproduce):

```ts
const TYPE_CONFIG: Record<BuildingType, TypeConfig> = {
  cottage:    { mainW: [4, 6],  mainH: [3, 5], wings: [0, 1], tower: false },
  shop:       { mainW: [4, 6],  mainH: [4, 6], wings: [1, 1], tower: false },
  workshop:   { mainW: [5, 7],  mainH: [4, 6], wings: [1, 1], tower: false },
  tavern:     { mainW: [6, 9],  mainH: [5, 7], wings: [1, 2], tower: false },
  manor:      { mainW: [8, 12], mainH: [6, 9], wings: [0, 2], tower: true },
  // v2 additions
  townhouse:  { mainW: [4, 5],  mainH: [5, 8], wings: [0, 1], tower: false }, // narrow, deep
  tenement:   { mainW: [6, 9],  mainH: [6, 9], wings: [0, 1], tower: false },
  farmstead:  { mainW: [5, 8],  mainH: [4, 6], wings: [1, 2], tower: false },
  smithy:     { mainW: [5, 7],  mainH: [4, 6], wings: [1, 1], tower: false },
  inn:        { mainW: [7, 10], mainH: [6, 8], wings: [1, 2], tower: false },
  storehouse: { mainW: [6, 9],  mainH: [5, 8], wings: [0, 1], tower: false },
  temple:     { mainW: [6, 8],  mainH: [8, 12], wings: [0, 2], tower: true },  // long nave axis
  keep:       { mainW: [7, 10], mainH: [7, 10], wings: [0, 1], tower: true },
  civic:      { mainW: [6, 9],  mainH: [5, 8], wings: [0, 1], tower: false },
};
```

In `partition.ts` extend `roomCapFor` (find the existing `cottage 5 / tavern 9 / manor 10` map): townhouse 6, tenement 10, farmstead 6, smithy 5, inn 10, storehouse 4, temple 6, keep 9, civic 7.

In `generateInterior.ts`:
- `ROLE_TO_TYPE`: `temple: 'temple'`, `keep: 'keep'`, `citadel: 'keep'`, `civic: 'civic'`; delete the STOPGAP comment. Keep `house: 'cottage'`, `market: 'shop'` etc. unchanged.
- `BASEMENT_CHANCE` additions: townhouse 0.4, tenement 0.2, farmstead 0.3, smithy 0.4, inn 0.85, storehouse 0.7, temple 0.6 (crypt), keep 0.9, civic 0.5.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/systems/worldforge/interior/__tests__/vocabulary.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify no regression + typecheck**

Run: `npx vitest run src/systems/worldforge/interior/` and `npx tsc --noEmit`
Expected: existing interior tests still green — the 5 original `TYPE_CONFIG` entries are byte-identical so no seed re-rolls yet. TS will force `PROGRAMS`/`RECIPES`/`HEADLINE` records to cover the new keys — add MINIMAL placeholder programs in this task (copy the closest existing type: townhouse/tenement/farmstead ← cottage, smithy ← workshop, inn ← tavern, storehouse ← workshop, temple/keep/civic ← manor) with a `// Task 2 replaces these` comment. Task 2 replaces them with real programs.

---

### Task 2: Real room programs for the 9 new types

Each new type gets a real program, headline purpose, and furnish recipes — a temple is a nave with a sanctuary, not a dressed-up manor. Adds 5 new room purposes.

**Files:**
- Modify: `src/systems/worldforge/interior/blueprintTypes.ts:5-9` (`RoomPurpose`)
- Modify: `src/systems/worldforge/interior/program.ts:23-80` (`HEADLINE`, `PROGRAMS`)
- Modify: `src/systems/worldforge/interior/furnish.ts:81-102` (`RECIPES`), `:60-66` (`KIND_HINTS`)
- Modify: `src/systems/worldforge/interior/generateInterior.ts:115-136` (`PURPOSE_TO_ROLE`)
- Test: `src/systems/worldforge/interior/__tests__/program.test.ts` (extend)

**Interfaces:**
- Produces: `RoomPurpose` gains `'forge' | 'counting-room' | 'servant-room' | 'stockroom' | 'brewhouse'`. Downstream tables (Tasks 5, 10) key on these exact strings.

- [ ] **Step 1: Write the failing test** (append to `program.test.ts`)

```ts
describe('v2 type programs', () => {
  it('temple headline is nave; keep gets guard-room; smithy gets forge — 50 seeds each', () => {
    const expects: Array<[BuildingType, RoomPurpose, RoomPurpose]> = [
      ['temple', 'nave', 'sanctuary'],
      ['keep', 'great-hall', 'guard-room'],
      ['smithy', 'forge', 'workshop'],
      ['inn', 'common-room', 'guest-room'],
      ['tenement', 'hall', 'private-room'],
    ];
    for (const [type, headline, mustHave] of expects) {
      let hits = 0;
      for (let seed = 0; seed < 50; seed++) {
        const rooms = buildFloor(type, seed).rooms; // shared fixture used by existing tests
        expect(rooms.find((r) => r.isMain)?.purpose).toBe(headline);
        if (rooms.some((r) => r.purpose === mustHave)) hits++;
      }
      // required slots (min 1) must always land when rooms exist for them
      expect(hits).toBeGreaterThanOrEqual(45);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/systems/worldforge/interior/__tests__/program.test.ts` — FAIL (placeholder programs from Task 1).

- [ ] **Step 3: Implement**

`RoomPurpose` additions (line 5-9): `'forge' | 'counting-room' | 'servant-room' | 'stockroom' | 'brewhouse'`.

`HEADLINE` additions: townhouse `hall`, tenement `hall`, farmstead `hall`, smithy `forge`, inn `common-room`, storehouse `storage`, temple `nave`, keep `great-hall`, civic `hall`.

`PROGRAMS` additions (same `ProgramSlot` shape):

```ts
townhouse:  { slots: [ { purpose: 'kitchen', min: 1, max: 1 }, { purpose: 'bedroom', min: 1, max: 2 },
                       { purpose: 'pantry', min: 0, max: 1 } ], filler: 'bedroom' },
tenement:   { slots: [ { purpose: 'kitchen', min: 1, max: 1 } ], filler: 'private-room' },
farmstead:  { slots: [ { purpose: 'kitchen', min: 1, max: 1 }, { purpose: 'bedroom', min: 1, max: 2 },
                       { purpose: 'pantry', min: 1, max: 1 }, { purpose: 'storage', min: 0, max: 1 } ], filler: 'bedroom' },
smithy:     { slots: [ { purpose: 'workshop', min: 1, max: 1 }, { purpose: 'storage', min: 0, max: 1 },
                       { purpose: 'bedroom', min: 0, max: 1 } ], filler: 'storage' },
inn:        { slots: [ { purpose: 'kitchen', min: 1, max: 1 }, { purpose: 'cellar', min: 0, max: 1 },
                       { purpose: 'storage', min: 0, max: 1 } ], filler: 'guest-room' },
storehouse: { slots: [ { purpose: 'stockroom', min: 1, max: 1 } ], filler: 'storage' },
temple:     { slots: [ { purpose: 'sanctuary', min: 1, max: 1 }, { purpose: 'vestry', min: 1, max: 1 },
                       { purpose: 'private-room', min: 0, max: 1 } ], filler: 'private-room' },
keep:       { slots: [ { purpose: 'guard-room', min: 1, max: 1 }, { purpose: 'armory', min: 1, max: 1 },
                       { purpose: 'kitchen', min: 1, max: 1 }, { purpose: 'solar', min: 0, max: 1 } ], filler: 'bedroom' },
civic:      { slots: [ { purpose: 'study', min: 1, max: 1 }, { purpose: 'storage', min: 0, max: 1 } ], filler: 'private-room' },
```

Note: the smithy headline `forge` means the MAIN room is the forge — `HEADLINE` handles it; the `workshop` slot is the secondary workroom. Storage cap stays 1 EXCEPT storehouse/tenement filler (the cap check at `program.ts:278` must exempt the filler purpose when `program.filler === 'storage'` — storehouses are legitimately mostly storerooms).

`KIND_HINTS` additions in furnish.ts: `'forge-hearth': 'exterior-wall'`, `'anvil': 'center'`, `'loom': 'wall'`, `'strongbox': 'wall'`, `'writing-desk': 'wall'`.

`RECIPES` additions:

```ts
'forge':          recipe(['forge-hearth', 'anvil'], ['barrel', 'workbench']),
'counting-room':  recipe(['writing-desk', 'strongbox'], ['shelf', 'chair']),
'servant-room':   recipe(['bed', 'chest'], ['bed']),
'stockroom':      recipe(['crate', 'crate'], ['barrel', 'crate', 'shelf']),
'brewhouse':      recipe(['barrel', 'workbench'], ['barrel', 'crate']),
```

`PURPOSE_TO_ROLE` additions (total mapping must stay total): `'forge': 'workshop'`, `'counting-room': 'workshop'`, `'servant-room': 'bedroom'`, `'stockroom': 'storage'`, `'brewhouse': 'storage'`.

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/systems/worldforge/interior/` — all green.
- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` — clean (TS totality on the Records is the safety net).

---

### Task 3: v2 contract delta — freeze `blueprintTypes.ts`

All new contract types land at once, then the file freezes (v1 lesson: contract churn after goldens is the expensive failure). Everything is additive and optional.

**Files:**
- Modify: `src/systems/worldforge/interior/blueprintTypes.ts`
- Test: `src/systems/worldforge/interior/__tests__/vocabulary.test.ts` (extend — shape assertions)

**Interfaces (produces — verbatim, later tasks import these names):**

```ts
/** Coarse family description the generator designs a house for.
 *  Slots and counts, never names — names stay lazy (town/household.ts). */
export interface MemberSlot {
  /** Stable tag: 'head', 'spouse', 'child:0', 'elder:0', 'kin:0', 'lodger:0', 'servant:0'. */
  tag: string;
  role: 'head' | 'spouse' | 'child' | 'elder' | 'kin' | 'lodger' | 'servant';
  ageBand: 'child' | 'adult' | 'elder';
}

export type BriefWealth = 'poor' | 'common' | 'wealthy';

export interface HouseholdBrief {
  homeId: string;
  slots: MemberSlot[];
  /** Head's trade ("blacksmith", "innkeeper", "farmer", "labourer"). */
  trade: string;
  /** True when the family runs THIS building (smithy, shop, inn, tavern). */
  worksAtHome: boolean;
  wealth: BriefWealth;
}

/** Which side of the plan faces the street. Convention is FIXED: the min-y
 *  cell edge (the 3D bridge maps plan +y depth inward from the street). */
export interface FrontageInfo {
  side: 'minY';
  /** The ground-floor street entry (the isEntry door's position). */
  entryX: Feet; entryY: Feet;
}

/** RESERVED for Phase 1B/3 — declared now so phases 1-2 never reopen the
 *  contract. Not populated by Phase 1A. */
export interface StyleContext {
  cultureId: number; climate: 'temperate' | 'cold' | 'arid' | 'marsh';
  wealth: BriefWealth; ageBand: 'new' | 'aged' | 'old' | 'ancient';
}
export interface BuildingBackstory {
  ageBand: 'new' | 'aged' | 'old' | 'ancient';
  /** Later build phases per wing index; empty = built in one phase. */
  phases: number[];
  /** Wear kinds rolled at birth ('sealed-door' | 're-roofed' | 'sagging-ridge' | 'patched-wall'). */
  wear: string[];
}
export interface BuildingEvent { day: number; kind: string; payload?: Record<string, unknown>; }
```

Plus on existing types: `BlueprintRoom.forSlot?: string` (the MemberSlot tags this room was programmed for, comma-joined, e.g. `'child:0,child:1'`); `BlueprintPlan.household?: HouseholdBrief` (echo of the input); `BlueprintPlan.frontage?: FrontageInfo`; `BlueprintPlan.style?: StyleContext` and `BlueprintPlan.backstory?: BuildingBackstory` (reserved, undefined in 1A).

- [ ] **Step 1: Write the failing test** — extend `vocabulary.test.ts`:

```ts
it('v2 contract fields exist and stay optional (bare v1 call unaffected)', () => {
  const plan = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(7) });
  expect(plan.household).toBeUndefined();
  expect(plan.style).toBeUndefined();
  expect(plan.backstory).toBeUndefined();
  // frontage becomes ALWAYS-set in Task 9; until then optional-undefined is fine
  const room = plan.floors[0].rooms[0];
  expect('forSlot' in room || room.forSlot === undefined).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL: TS unknown properties.
- [ ] **Step 3: Implement** — add the types above to `blueprintTypes.ts`; no behavior change anywhere.
- [ ] **Step 4: Run to verify pass** — `npx vitest run src/systems/worldforge/interior/` green; `npx tsc --noEmit` clean.
- [ ] **Step 5: Freeze** — add a header comment to `blueprintTypes.ts`: `// CONTRACT FROZEN for Phase 1A (Task 3). Additions require a deliberate re-freeze task.`

---

### Task 4: Household brief builder (town side)

Coarsen the existing lazy named household into a `HouseholdBrief`, and build one straight from a `BuildingPlot`. Deterministic: the brief derives from `generateHousehold` (already deterministic per `(townSeed, homeId)`), so the SAME family the tooltip names is the family the house is designed for.

**Files:**
- Create: `src/systems/worldforge/town/householdBrief.ts`
- Test: `src/systems/worldforge/town/__tests__/householdBrief.test.ts`

**Interfaces:**
- Consumes: `generateHousehold(townSeed, homeId, occupants, dwelling?, work?)` → `Household` (`town/household.ts:92`); `BuildingPlot` fields `homeId/occupants/buildingType/district/workRole/workplaceId/proprietorHomeId` (`townEngine.ts:22-49`); `HouseholdBrief`/`MemberSlot` from Task 3.
- Produces:

```ts
export function briefFromHousehold(
  hh: Household,
  opts: { wealth: BriefWealth; worksAtHome: boolean },
): HouseholdBrief;

/** Brief for a plot. Residential plot → its household's brief.
 *  Workplace plot (smithy/shop/inn/tavern) → the PROPRIETOR family's brief
 *  with worksAtHome: true (they live over the shop). Returns undefined for
 *  plots with no household (storehouse, civic, temple, keep, unpopulated towns). */
export function briefForPlot(
  plot: BuildingPlot,
  allPlots: readonly BuildingPlot[],
  townSeed: SeedPath,
): HouseholdBrief | undefined;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { briefFromHousehold, briefForPlot } from '../householdBrief';
import { generateHousehold } from '../household';
import { rootSeedPath } from '../../seedPath';

describe('householdBrief', () => {
  it('slot tags are stable and cover every member', () => {
    const hh = generateHousehold(rootSeedPath(42), 'b7', 5, 'cottage');
    const brief = briefFromHousehold(hh, { wealth: 'common', worksAtHome: false });
    expect(brief.slots.length).toBe(hh.members.length);
    expect(brief.slots[0].tag).toBe('head');
    // tags unique
    expect(new Set(brief.slots.map((s) => s.tag)).size).toBe(brief.slots.length);
    // deterministic
    const again = briefFromHousehold(
      generateHousehold(rootSeedPath(42), 'b7', 5, 'cottage'),
      { wealth: 'common', worksAtHome: false },
    );
    expect(again).toEqual(brief);
  });

  it('wealthy briefs add servant slots; poor briefs never do', () => {
    const hh = generateHousehold(rootSeedPath(1), 'b1', 4, 'townhouse');
    const rich = briefFromHousehold(hh, { wealth: 'wealthy', worksAtHome: false });
    const poor = briefFromHousehold(hh, { wealth: 'poor', worksAtHome: false });
    expect(rich.slots.some((s) => s.role === 'servant')).toBe(true);
    expect(poor.slots.some((s) => s.role === 'servant')).toBe(false);
  });

  it('a workplace plot resolves to the proprietor family with worksAtHome', () => {
    const home = { homeId: 'b1', residential: true, occupants: 4, buildingType: 'cottage',
      district: 'common', workplaceId: 'b2', workRole: 'proprietor',
      polygon: [], frontageEdge: 0 } as never;
    const smithy = { homeId: 'b2', residential: false, occupants: 0, buildingType: 'smithy',
      district: 'common', proprietorHomeId: 'b1', polygon: [], frontageEdge: 0 } as never;
    const brief = briefForPlot(smithy, [home, smithy], rootSeedPath(3));
    expect(brief?.worksAtHome).toBe(true);
    expect(brief?.trade).toBe('blacksmith');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module not found.
- [ ] **Step 3: Implement `householdBrief.ts`**

```ts
import type { BriefWealth, HouseholdBrief, MemberSlot } from '../interior/blueprintTypes';
import { generateHousehold, type Household } from './household';
import type { BuildingPlot } from './townEngine';
import type { SeedPath } from '../seedPath';

/** Servant count by wealth — wealthy homes staff up, others never. */
const SERVANTS: Record<BriefWealth, number> = { poor: 0, common: 0, wealthy: 2 };

export function briefFromHousehold(
  hh: Household,
  opts: { wealth: BriefWealth; worksAtHome: boolean },
): HouseholdBrief {
  const counters = new Map<string, number>();
  const slots: MemberSlot[] = hh.members.map((m) => {
    const role = m.role; // 'head'|'spouse'|'child'|'elder'|'kin'|'lodger'
    const n = counters.get(role) ?? 0;
    counters.set(role, n + 1);
    const tag = role === 'head' || role === 'spouse' ? role : `${role}:${n}`;
    return { tag, role, ageBand: m.ageBand };
  });
  for (let i = 0; i < SERVANTS[opts.wealth]; i++) {
    slots.push({ tag: `servant:${i}`, role: 'servant', ageBand: 'adult' });
  }
  return {
    homeId: hh.homeId,
    slots,
    trade: hh.occupation,
    worksAtHome: opts.worksAtHome,
    wealth: opts.wealth,
  };
}

export function briefForPlot(
  plot: BuildingPlot,
  allPlots: readonly BuildingPlot[],
  townSeed: SeedPath,
): HouseholdBrief | undefined {
  // Workplace run by a family: the proprietor's household lives over the shop.
  if (!plot.residential && plot.proprietorHomeId) {
    const home = allPlots.find((p) => p.homeId === plot.proprietorHomeId);
    if (!home?.homeId || !home.occupants) return undefined;
    const hh = generateHousehold(townSeed, home.homeId, home.occupants, home.buildingType, {
      role: 'proprietor', workplaceType: plot.buildingType,
    });
    return briefFromHousehold(hh, { wealth: plot.district ?? 'common', worksAtHome: true });
  }
  if (!plot.residential || !plot.homeId || !plot.occupants) return undefined;
  const hh = generateHousehold(townSeed, plot.homeId, plot.occupants, plot.buildingType, {
    role: plot.workRole === 'labourer' ? 'labourer' : plot.workRole,
    workplaceType: undefined,
  });
  // Workers at a workplace elsewhere do NOT work at home.
  return briefFromHousehold(hh, { wealth: plot.district ?? 'common', worksAtHome: false });
}
```

Note: `generateHousehold`'s `work.workplaceType` for a home's workers needs the workplace's type — resolve it via `plot.workplaceId` against `allPlots` (same lookup pattern as the proprietor branch) so a staff household's head gets the right trade noun. Implement that lookup; the test's third case covers the proprietor path.

- [ ] **Step 4: Run to verify pass**, then `npx tsc --noEmit` clean.

---

### Task 5: Trade-room table

The data table mapping a head-of-household trade to the rooms the building must contain when the family works at home.

**Files:**
- Create: `src/systems/worldforge/interior/tradeRooms.ts`
- Test: `src/systems/worldforge/interior/__tests__/tradeRooms.test.ts`

**Interfaces:**

```ts
export interface TradeRoomDemand {
  purpose: RoomPurpose;
  /** Room must own a street-facing (min-y) outer edge. */
  streetFacing?: boolean;
  /** Room prefers adjacency to this purpose. */
  adjacentTo?: RoomPurpose;
}
/** Demanded rooms per trade when worksAtHome. Unknown trade → [] (a
 *  labourer/farmer home has no trade room in town — legitimate, not fallback). */
export function tradeRoomsFor(trade: string): TradeRoomDemand[];
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { tradeRoomsFor } from '../tradeRooms';

describe('tradeRoomsFor', () => {
  it('blacksmith demands a street-facing forge', () => {
    expect(tradeRoomsFor('blacksmith')).toEqual([{ purpose: 'forge', streetFacing: true }]);
  });
  it('shopkeeper demands shopfront + stockroom behind it', () => {
    expect(tradeRoomsFor('shopkeeper')).toEqual([
      { purpose: 'shopfront', streetFacing: true },
      { purpose: 'stockroom', adjacentTo: 'shopfront' },
    ]);
  });
  it('unknown/plain trades demand nothing', () => {
    expect(tradeRoomsFor('labourer')).toEqual([]);
    expect(tradeRoomsFor('farmer')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** — the full table (trades come from `household.ts` `PROPRIETOR_TRADE`/`STAFF_TRADE` + 'farmer'/'labourer'):

```ts
const TABLE: Record<string, TradeRoomDemand[]> = {
  blacksmith:        [{ purpose: 'forge', streetFacing: true }],
  shopkeeper:        [{ purpose: 'shopfront', streetFacing: true },
                      { purpose: 'stockroom', adjacentTo: 'shopfront' }],
  innkeeper:         [{ purpose: 'kitchen' }, { purpose: 'guest-room' }],
  taverner:          [{ purpose: 'brewhouse', adjacentTo: 'kitchen' }, { purpose: 'cellar' }],
  'master artisan':  [{ purpose: 'workshop', streetFacing: true }],
  'town official':   [{ purpose: 'study' }],
  merchant:          [{ purpose: 'counting-room' }],
};
export const tradeRoomsFor = (trade: string): TradeRoomDemand[] => TABLE[trade] ?? [];
```

Staff trades ("smith's apprentice", "serving-hand"…) intentionally hit the `[]` branch — staff work at the workplace, not at home.

- [ ] **Step 4: Run to verify pass**; typecheck clean.

---

### Task 6: Brief program — family → demanded rooms

Turn a `HouseholdBrief` into (a) extra ground-floor program slots and (b) the bedroom list with sharing, tagged by member slots. Pure, RNG-free (the demand is a function of the family, not of luck).

**Files:**
- Create: `src/systems/worldforge/interior/briefProgram.ts`
- Modify: `src/systems/worldforge/interior/program.ts` (export `ProgramSlot`)
- Test: `src/systems/worldforge/interior/__tests__/briefProgram.test.ts`

**Interfaces:**

```ts
export interface BedroomAssignment { slotTags: string[] }  // who shares this room
export interface BriefProgram {
  /** Slots appended to the type's ground program (trade + wealth extras). */
  groundExtra: ProgramSlot[];
  /** Trade demands carrying placement constraints (streetFacing/adjacentTo). */
  tradeDemands: TradeRoomDemand[];
  /** Every bedroom the family needs, in assignment priority order. */
  bedrooms: BedroomAssignment[];
}
export function programForBrief(type: BuildingType, brief: HouseholdBrief): BriefProgram;
```

**Sharing rules (the spec's, exactly):** head+spouse share room 1; children share 2 per room, grouped in tag order; elders and kin get single rooms; lodgers get single rooms (assigned last → they land in the attic/back); servants share one `servant-room` (a ground/`groundExtra` slot, not a bedroom). Wealth extras: wealthy adds `{ purpose: 'solar', min: 1, max: 1 }` and `{ purpose: 'counting-room', min: 0, max: 1 }`; poor removes nothing but adds nothing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { programForBrief } from '../briefProgram';
import type { HouseholdBrief } from '../blueprintTypes';

const brief = (over: Partial<HouseholdBrief>): HouseholdBrief => ({
  homeId: 'b1', trade: 'labourer', worksAtHome: false, wealth: 'common',
  slots: [
    { tag: 'head', role: 'head', ageBand: 'adult' },
    { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
    { tag: 'child:0', role: 'child', ageBand: 'child' },
    { tag: 'child:1', role: 'child', ageBand: 'child' },
    { tag: 'child:2', role: 'child', ageBand: 'child' },
  ],
  ...over,
});

describe('programForBrief', () => {
  it('a smith with three kids: forge demanded, 3 bedrooms (couple, 2 kids, 1 kid)', () => {
    const p = programForBrief('cottage', brief({ trade: 'blacksmith', worksAtHome: true }));
    expect(p.tradeDemands).toEqual([{ purpose: 'forge', streetFacing: true }]);
    expect(p.bedrooms).toEqual([
      { slotTags: ['head', 'spouse'] },
      { slotTags: ['child:0', 'child:1'] },
      { slotTags: ['child:2'] },
    ]);
  });

  it('wealthy household adds solar + servant-room; servants never get bedrooms', () => {
    const p = programForBrief('manor', brief({
      wealth: 'wealthy',
      slots: [
        { tag: 'head', role: 'head', ageBand: 'adult' },
        { tag: 'servant:0', role: 'servant', ageBand: 'adult' },
        { tag: 'servant:1', role: 'servant', ageBand: 'adult' },
      ],
    }));
    expect(p.groundExtra.some((s) => s.purpose === 'solar' && s.min === 1)).toBe(true);
    expect(p.groundExtra.some((s) => s.purpose === 'servant-room' && s.min === 1)).toBe(true);
    expect(p.bedrooms).toEqual([{ slotTags: ['head'] }]);
  });

  it('is pure and RNG-free: identical calls produce identical (deep-equal) output', () => {
    const a = programForBrief('cottage', brief({}));
    const b = programForBrief('cottage', brief({}));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** — direct translation of the sharing rules; `groundExtra` = wealth extras + `servant-room` slot when any servant slots exist + `tradeDemands` mapped to `{ purpose, min: 1, max: 1 }` slots (constraints ride separately in `tradeDemands` for Task 7's placement). Export `ProgramSlot` from `program.ts` (change `interface ProgramSlot` to `export interface ProgramSlot`).
- [ ] **Step 4: Run to verify pass**; typecheck clean.

---

### Task 7: Program placement honors the brief (street-facing + upper floors)

`assignPurposes` learns three things: extra slots, street-facing demands, and slot-tagged bedroom assignment. A new `assignUpperPurposes` replaces the mechanical `id % 2` `repurpose()` for non-ground floors.

**Files:**
- Modify: `src/systems/worldforge/interior/program.ts`
- Test: `src/systems/worldforge/interior/__tests__/program.test.ts` (extend)

**Interfaces:**

```ts
// program.ts — extended signature (backward compatible: opts optional)
export interface AssignOptions {
  extraSlots?: ProgramSlot[];
  tradeDemands?: TradeRoomDemand[];
  /** Bedrooms to hand out ON THIS FLOOR (mutated: consumed entries are removed). */
  bedroomQueue?: BedroomAssignment[];
}
export function assignPurposes(
  path: SeedPath, type: BuildingType, rg: number[][], opts?: AssignOptions,
): BlueprintRoom[];

/** Non-ground floors: consume the bedroom queue (largest rooms first, one
 *  assignment per room, forSlot = tags joined with ','), then filler:
 *  level > 0 → 'guest-room', level < 0 → cellar/storage alternating (keeps
 *  v1 basement flavor). Corridors stay corridors. */
export function assignUpperPurposes(
  path: SeedPath, type: BuildingType, rg: number[][], level: number,
  bedroomQueue: BedroomAssignment[],
): BlueprintRoom[];
```

**Street-facing scoring:** a room is street-facing when it owns a cell `(cx, cy)` whose north neighbor `rg[cy-1]?.[cx]` is outside (undefined or `< 0`) AND `cy` equals the min occupied `cy` of that column — i.e. it owns an outer edge on the min-y boundary. Compute a `streetRooms: Set<number>` from `rg` alone (independent oracle friendly). A demand with `streetFacing: true` scores `pickBest` +4 for street rooms (dominating the kitchen-style adjacency scores); `adjacentTo: 'x'` scores +1 per shared edge with the already-placed room of purpose `x` (same relaxation rule as pantry: no candidate → size order, honestly relaxed).

- [ ] **Step 1: Write the failing tests** (extend `program.test.ts`)

```ts
describe('brief-driven placement', () => {
  it('forge lands street-facing ≥ 90% over 100 seeds (has a min-y outer edge)', () => {
    let ok = 0, total = 0;
    for (let seed = 0; seed < 100; seed++) {
      const { rg, rooms } = buildFloorWithOpts('smithy', seed, {
        tradeDemands: [{ purpose: 'forge', streetFacing: true }],
      });
      const forge = rooms.find((r) => r.purpose === 'forge');
      if (!forge) continue;
      total++;
      // independent oracle: recompute street ownership from rg
      const minCy = Math.min(...forge.cells.map((c) => c.cy));
      const ownsStreet = forge.cells.some((c) =>
        c.cy === 0 || (rg[c.cy - 1]?.[c.cx] ?? -1) < 0 && c.cy === minCyOfColumn(rg, c.cx));
      if (ownsStreet) ok++;
    }
    expect(total).toBeGreaterThan(80);
    expect(ok / total).toBeGreaterThanOrEqual(0.9);
  });

  it('assignUpperPurposes consumes the bedroom queue with forSlot tags', () => {
    const queue = [{ slotTags: ['head', 'spouse'] }, { slotTags: ['child:0'] }];
    const rooms = buildUpper('cottage', 11, 1, queue);
    const tagged = rooms.filter((r) => r.forSlot);
    expect(tagged.length).toBeGreaterThanOrEqual(1);
    expect(tagged[0].purpose).toBe('bedroom');
    expect(tagged[0].forSlot).toBe('head,spouse');
    // consumed entries removed from the queue
    expect(queue.length).toBeLessThan(2);
  });
});
```

(Where `buildFloorWithOpts`/`buildUpper` extend the existing shared `buildFloor` fixture — pass the opts through; `minCyOfColumn` is a 3-line test helper scanning `rg`.)

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Key constraints: NO new draws on the `'program'` stream for scoring (scoring is deterministic like the existing kitchen/pantry pass — stream consumption must not change for existing types called WITHOUT opts, so v1 seeds reproduce until Task 12 re-freezes). `extraSlots` append to the type program's slot list BEFORE the queue is built — this adds one `rng.nextInt` draw per extra slot with `max > min`; keep all extra slots `min === max` so **zero extra draws** happen and the stream stays byte-stable for optless calls.
- [ ] **Step 4: Run the full interior suite** — all green (optless behavior unchanged is the critical assertion; the existing program tests are the guard).
- [ ] **Step 5: Typecheck clean.**

---

### Task 8: `generateBuilding` takes the household

The orchestrator: brief in → brief program computed → ground gets extras + trade demands → bedrooms distributed across floors → `forSlot` stamped → brief echoed on the plan → memo key extended.

**Files:**
- Modify: `src/systems/worldforge/interior/generateBuilding.ts`
- Test: `src/systems/worldforge/interior/__tests__/generateBuilding.test.ts` (extend)

**Interfaces:**
- Consumes: `programForBrief` (Task 6), `assignPurposes`/`assignUpperPurposes` (Task 7).
- Produces: `GenerateBuildingInput.household?: HouseholdBrief`. Bedroom distribution rule: single-storey → all bedrooms into the ground `bedroomQueue`; multi-storey → ground keeps ZERO family bedrooms (they all queue on upper floors, ground floor is living/trade), leftovers that upper floors could not seat spill back to the ground floor queue on the LAST upper floor pass. Memo key gains a stable brief digest: `slots.map(s=>s.tag).join(',')|trade|worksAtHome|wealth`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('household-driven building', () => {
  const FAMILY: HouseholdBrief = {
    homeId: 'b9', trade: 'blacksmith', worksAtHome: true, wealth: 'common',
    slots: [
      { tag: 'head', role: 'head', ageBand: 'adult' },
      { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
      { tag: 'child:0', role: 'child', ageBand: 'child' },
      { tag: 'child:1', role: 'child', ageBand: 'child' },
      { tag: 'child:2', role: 'child', ageBand: 'child' },
    ],
  };

  it('the family always sleeps: beds-rooms ≥ bedroom assignments, all tagged — 50 seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = generateBuilding({
        buildingId: seed, type: 'smithy', seedPath: rootSeedPath(seed),
        storeys: 2, household: FAMILY,
      });
      const tagged = plan.floors.flatMap((f) => f.rooms).filter((r) => r.forSlot);
      const allTags = tagged.flatMap((r) => (r.forSlot as string).split(','));
      // every non-servant slot sleeps somewhere, exactly once
      expect([...allTags].sort()).toEqual(['child:0', 'child:1', 'child:2', 'head', 'spouse']);
      // the trade room exists
      expect(plan.floors[0].rooms.some((r) => r.purpose === 'forge')).toBe(true);
      // the brief is echoed
      expect(plan.household?.homeId).toBe('b9');
    }
  });

  it('memo distinguishes briefs: same seed, different family ⇒ different plan', () => {
    const a = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(5), household: FAMILY });
    const solo: HouseholdBrief = { ...FAMILY, slots: [FAMILY.slots[0]], trade: 'labourer', worksAtHome: false };
    const b = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(5), household: solo });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('briefless call is byte-identical to pre-task output (no accidental re-roll)', () => {
    // Snapshot guard: run once before implementing to capture, then assert equality.
    const plan = generateBuilding({ buildingId: 3, type: 'tavern', seedPath: rootSeedPath(3), storeys: 2, basement: true });
    expect(plan).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Capture the briefless snapshot FIRST** (run the third test before touching `generateBuilding.ts` so the snapshot records pre-change output), then verify the other two fail.
- [ ] **Step 3: Implement** in `generateBuilding.ts`:
  - `input.household` → `const bp = input.household ? programForBrief(type, input.household) : undefined;`
  - Ground floor: `assignPurposes(groundPath, type, groundRg, bp && { extraSlots: bp.groundExtra, tradeDemands: bp.tradeDemands, bedroomQueue: groundQueue })` where `groundQueue` = all bedrooms when `storeys === 1`, else `[]`.
  - Upper floors: `assignUpperPurposes(floorPath, type, rg, level, queue)` with one shared mutable `queue` (copy of `bp.bedrooms`) consumed floor by floor; after the last upper floor, if the queue is non-empty, throw is WRONG (families must fit) — instead re-run the ground assignment including the remainder? No: **the honest rule** — leftovers get `forSlot` stamped onto ground-floor rooms whose purpose is already `bedroom` (cottage case), and if none exist the plan carries the misfit visibly: stamp the leftover tags onto the main room (`forSlot` on the hall = "beds in the hall", the spec's crowded-claims answer). No room is invented, no wall moves.
  - Basement floors: unchanged (never bedrooms).
  - `repurpose()` DELETED (replaced by `assignUpperPurposes`). Briefless callers get the SAME v1 behavior via `assignUpperPurposes(..., [])` — implement its no-queue path to reproduce `repurpose`'s exact output (bedroom/guest-room by `id % 3`, cellar/storage by `id % 2`) so the Step 2 snapshot stays green.
  - Memo key: append `|${briefDigest(input.household)}` (`''` when absent).
  - Echo: `result.household = input.household`.
- [ ] **Step 4: Run to verify pass** — including the briefless snapshot (unchanged) and the full interior suite.
- [ ] **Step 5: Typecheck clean.**

---

### Task 9: Frontage — the door faces the street

Fixed convention (already the 3D bridge's frame, `interiorParts.ts:10-14`): plan min-y edge = street. Entry and shopfront glazing prefer it; the plan records it.

**Files:**
- Modify: `src/systems/worldforge/interior/doors.ts` (entry edge preference)
- Modify: `src/systems/worldforge/interior/walls.ts` (shopfront street glazing bias)
- Modify: `src/systems/worldforge/interior/generateBuilding.ts` (set `plan.frontage`)
- Test: `src/systems/worldforge/interior/__tests__/doors.test.ts`, `walls.test.ts` (extend)

**Interfaces:**
- Produces: `BlueprintPlan.frontage: FrontageInfo` — ALWAYS set from this task on (`side: 'minY'`, entry position copied from the ground floor's `isEntry` door).

- [ ] **Step 1: Write the failing tests**

```ts
// doors.test.ts
it('street entry sits on a min-y outer edge when the main room offers one — 100 seeds', () => {
  let onStreet = 0, eligible = 0;
  for (let seed = 0; seed < 100; seed++) {
    const { rg, rooms, doors } = build('shop', seed);
    const entry = doors.find((d) => d.isEntry)!;
    // independent oracle: the main room's street edges recomputed from rg
    const main = rooms.find((r) => r.isMain)!;
    const streetEdges = main.cells.filter((c) => (rg[c.cy - 1]?.[c.cx] ?? -1) < 0 && isMinYBoundary(rg, c));
    if (streetEdges.length === 0) continue;
    eligible++;
    if (entry.axis === 'x' && Math.round(entry.y / 5) === Math.min(...streetEdges.map((c) => c.cy))) onStreet++;
  }
  expect(eligible).toBeGreaterThan(60);
  expect(onStreet / eligible).toBeGreaterThanOrEqual(0.95);
});

// generateBuilding.test.ts
it('plan.frontage is always set and matches the entry door', () => {
  const plan = generateBuilding({ buildingId: 2, type: 'cottage', seedPath: rootSeedPath(9) });
  const entry = plan.floors.find((f) => f.level === 0)!.doors.find((d) => d.isEntry)!;
  expect(plan.frontage).toEqual({ side: 'minY', entryX: entry.x, entryY: entry.y });
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** In `doors.ts`, the entry-wall pick currently draws a random outer edge of the main room (or main-touching corridor): filter the candidate edge list to min-y-boundary edges FIRST; if that filter empties the list, relax to the full list (constraint relaxation, logged in the doc comment — a main room boxed off the street still gets a door). The pick still draws from the SAME `'doors'` stream — one draw either way, so stream stability holds. In `walls.ts`, the shopfront wide-glazing bias (Wave A A12) adds the same min-y filter for its street runs. In `generateBuilding.ts`, after floors build, set `frontage` from the ground entry.
- [ ] **Step 4: Run to verify pass**; full interior suite green. NOTE: entry positions WILL shift for seeds whose old random pick was a non-street edge — the existing doors tests assert properties, not positions, so they stay green; goldens shift and that is Task 12's deliberate re-freeze. If any existing test pins an entry coordinate, it re-pins here with a comment `// re-pinned: frontage (v2 Task 9)`.
- [ ] **Step 5: Typecheck clean.**

---

### Task 10: The living overlay — occupancy, manifests, owned items

The second layer: pure functions from `(plan, named household)` to claims, hourly stations, state flags, and container manifests with real registry items. Plus `Item.stolenFrom` so taking one can matter later.

**Files:**
- Create: `src/systems/worldforge/interior/occupancy.ts`
- Create: `src/systems/worldforge/interior/manifests.ts`
- Create: `src/data/items/householdGoods.ts`
- Modify: `src/data/items/index.ts:211` (merge `HOUSEHOLD_GOODS` into `ALL_ITEMS`)
- Modify: `src/types/items.ts:240` (add `stolenFrom?: string` to `Item`)
- Test: `src/systems/worldforge/interior/__tests__/occupancy.test.ts`, `__tests__/manifests.test.ts`

**Interfaces:**

```ts
// occupancy.ts
export interface RoomClaim { slotTag: string; memberName: string; level: number; roomId: number; }
export interface OccupantStation {
  memberIndex: number;               // index into household.members
  hour: number;                      // 0-23
  where: 'home' | 'out';
  level?: number; roomId?: number;   // set when where === 'home'
  /** Index into plan.floors[levelIdx].furnishings when standing at a piece. */
  furnishingIndex?: number;
  activity: 'sleeping' | 'meal' | 'work' | 'hearthside' | 'chores' | 'out';
}
export interface BuildingOccupancy {
  claims: RoomClaim[];
  /** stations[hour] = one entry per household member. */
  stationsByHour: OccupantStation[][];
  flags: { abandoned: boolean; hearthLitHours: boolean[] }; // 24 booleans
}
export function computeOccupancy(
  plan: BlueprintPlan, household: Household, opts: { worksAtHome: boolean },
): BuildingOccupancy;

// manifests.ts
export interface ManifestEntry { itemId: string; qty: number; }
export interface ContainerManifest {
  level: number; furnishingIndex: number; kind: string;
  ownerHomeId: string; entries: ManifestEntry[];
}
export const CONTAINER_KINDS: ReadonlySet<string>; // 'chest' | 'shelf' | 'barrel' | 'crate' | 'strongbox'
export function containerManifests(
  plan: BlueprintPlan, brief: HouseholdBrief, path: SeedPath,
): ContainerManifest[];
```

**Behavior:**
- **Claims:** resolve `forSlot` tags to members by tag (Task 4's tag scheme matches `household.members` order); rooms without `forSlot` get no claim; members without a tagged room claim the main room (the visible-misfit rule).
- **Stations (deterministic, RNG-free):** a fixed day shape per role/ageBand, aligned with the agent-sim's `ActivityKind` bands (`roster/occupantSchedule.ts:26`): sleeping 22–06 at the claimed room's bed (`furnishingIndex` of a `bed` in the claimed room, else the room anchor with no furnishing index); meals 07 and 18 at the largest `table` in the kitchen or main room; work 08–17 — `worksAtHome` heads/spouses at the trade room's workbench/counter/anvil/forge-hearth, others `where: 'out'`; children `chores`/`out` alternating; evening 19–21 `hearthside` in the room with a hearth. All picks are deterministic scans in stable furnishing order — no rng, identical inputs give identical days.
- **Flags:** `abandoned` = household has zero living members (caller decides; `computeOccupancy` receives the household as-is and sets `abandoned: household.members.length === 0`); `hearthLitHours[h]` = any member home at hour h AND h ∈ 06–08 ∪ 17–22.
- **Manifests:** for every furnishing whose kind ∈ `CONTAINER_KINDS`, roll entries from a table keyed `(room purpose, container kind, brief.trade, brief.wealth)` using `rngFromPath(streamPath(path, `manifest:${level}:${furnishingIndex}`))` — per-container streams so adding a container never re-rolls its neighbors. Owner = `brief.homeId`.

`householdGoods.ts` — the mundane items the tables reference, shaped exactly like existing `ITEMS` entries (`src/data/items/index.ts:74-100`):

```ts
import type { Item } from '../../types/items';

export const HOUSEHOLD_GOODS: Record<string, Item> = {
  'smiths_hammer':  { id: 'smiths_hammer', name: "Smith's Hammer", icon: '🔨', description: 'A well-worn forge hammer, handle darkened by years of grip.', type: 'tool', weight: 2, cost: '2 GP' },
  'iron_bar':       { id: 'iron_bar', name: 'Iron Bar', icon: '🧱', description: 'A rough bar of smelted iron, ready for the forge.', type: 'misc', weight: 5, cost: '1 GP' },
  'sack_of_flour':  { id: 'sack_of_flour', name: 'Sack of Flour', icon: '🌾', description: 'Coarse-milled flour in a cloth sack.', type: 'food_drink', weight: 10, cost: '3 SP' },
  'wheel_of_cheese':{ id: 'wheel_of_cheese', name: 'Wheel of Cheese', icon: '🧀', description: 'A waxed wheel of hard cheese.', type: 'food_drink', weight: 4, cost: '5 SP' },
  'salted_pork':    { id: 'salted_pork', name: 'Salted Pork', icon: '🥩', description: 'Preserved pork packed in salt.', type: 'food_drink', weight: 3, cost: '4 SP' },
  'ale_jug':        { id: 'ale_jug', name: 'Jug of Ale', icon: '🍺', description: 'A stoneware jug of small ale.', type: 'food_drink', weight: 4, cost: '2 SP' },
  'linen_shirt':    { id: 'linen_shirt', name: 'Linen Shirt', icon: '👕', description: 'A plain, well-mended linen shirt.', type: 'clothing', weight: 0.5, cost: '5 SP' },
  'wool_blanket':   { id: 'wool_blanket', name: 'Wool Blanket', icon: '🧶', description: 'A heavy blanket of undyed wool.', type: 'misc', weight: 3, cost: '5 SP' },
  'tallow_candles': { id: 'tallow_candles', name: 'Tallow Candles', icon: '🕯️', description: 'A bundle of smoky tallow candles.', type: 'misc', weight: 1, cost: '1 SP' },
  'ledger_book':    { id: 'ledger_book', name: 'Ledger Book', icon: '📒', description: 'A merchant\'s ledger of accounts, closely written.', type: 'note', weight: 1, cost: '1 GP' },
  'sewing_kit':     { id: 'sewing_kit', name: 'Sewing Kit', icon: '🪡', description: 'Needles, thread, and a wooden darning egg.', type: 'tool', weight: 0.5, cost: '3 SP' },
  'clay_pot':       { id: 'clay_pot', name: 'Clay Pot', icon: '🏺', description: 'A glazed clay cooking pot.', type: 'misc', weight: 2, cost: '1 SP' },
};
```

(If `type: 'misc'` is not in the `Item` type union at `src/types/items.ts:254`, use the closest existing value — check the union in the file and keep every entry compiling; do NOT extend the union.)

- [ ] **Step 1: Write the failing tests**

```ts
// occupancy.test.ts
describe('computeOccupancy', () => {
  it('every member has a station at every hour; home stations point at real rooms — 25 seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { plan, household } = fixture(seed); // builds brief via briefFromHousehold, plan via generateBuilding, same household
      const occ = computeOccupancy(plan, household, { worksAtHome: false });
      expect(occ.stationsByHour).toHaveLength(24);
      for (const hourRow of occ.stationsByHour) {
        expect(hourRow).toHaveLength(household.members.length);
        for (const st of hourRow) {
          if (st.where === 'home') {
            const floor = plan.floors.find((f) => f.level === st.level)!;
            expect(floor.rooms.some((r) => r.id === st.roomId)).toBe(true);
            if (st.furnishingIndex !== undefined) {
              expect(floor.furnishings[st.furnishingIndex]).toBeDefined();
            }
          }
        }
      }
      // at 02:00 everyone with a claim is sleeping in their claimed room
      for (const st of occ.stationsByHour[2]) expect(st.activity).toBe('sleeping');
    }
  });

  it('hearth is lit in the evening when someone is home, never at 03:00', () => {
    const { plan, household } = fixture(1);
    const occ = computeOccupancy(plan, household, { worksAtHome: true });
    expect(occ.flags.hearthLitHours[19]).toBe(true);
    expect(occ.flags.hearthLitHours[3]).toBe(false);
  });
});

// manifests.test.ts
describe('containerManifests', () => {
  it('every container gets an owned manifest; every itemId resolves in ALL_ITEMS — 25 seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { plan, brief, path } = fixture(seed);
      const ms = containerManifests(plan, brief, path);
      const containers = plan.floors.flatMap((f, i) =>
        f.furnishings.filter((fu) => CONTAINER_KINDS.has(fu.kind)));
      expect(ms.length).toBe(containers.length);
      for (const m of ms) {
        expect(m.ownerHomeId).toBe(brief.homeId);
        expect(m.entries.length).toBeGreaterThan(0);
        for (const e of m.entries) expect(ALL_ITEMS[e.itemId]).toBeDefined();
      }
    }
  });

  it('a smith\'s workshop chest holds smith goods; deterministic per path', () => {
    const { plan, brief, path } = smithFixture(3);
    const a = containerManifests(plan, brief, path);
    const b = containerManifests(plan, brief, path);
    expect(a).toEqual(b);
    const forgeFloorIdx = plan.floors.findIndex((f) => f.rooms.some((r) => r.purpose === 'forge'));
    const forgeRoom = plan.floors[forgeFloorIdx].rooms.find((r) => r.purpose === 'forge')!;
    const forgeManifests = a.filter((m) => {
      const fu = plan.floors[forgeFloorIdx].furnishings[m.furnishingIndex];
      return m.level === plan.floors[forgeFloorIdx].level && fu?.roomId === forgeRoom.id;
    });
    if (forgeManifests.length > 0) {
      const ids = forgeManifests.flatMap((m) => m.entries.map((e) => e.itemId));
      expect(ids.some((id) => id === 'smiths_hammer' || id === 'iron_bar')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** `occupancy.ts`, `manifests.ts`, `householdGoods.ts`, the `ALL_ITEMS` merge, and `Item.stolenFrom?: string` (doc comment: `/** homeId of the household this item was stolen from; set when taken from an owned container. */`). Manifest tables: kitchen/pantry/cellar containers → provisions pool (`sack_of_flour`, `wheel_of_cheese`, `salted_pork`, `ale_jug`, `rations`, `clay_pot`); bedroom chests → clothing/domestic (`linen_shirt`, `wool_blanket`, `sewing_kit`, `tallow_candles`, + `silver_piece` qty 1-6, wealthy adds `gold_piece` 1-4); trade rooms → trade pool by `brief.trade` (blacksmith: `smiths_hammer`, `iron_bar`; merchant: `ledger_book`, `gold_piece`; default: `tallow_candles`, `clay_pot`); counting-room strongbox → coin-heavy. 2–4 entries per container (`rng.nextInt(2, 5)`).
- [ ] **Step 4: Run to verify pass**; typecheck clean (includes `src/data/items` and `src/types/items.ts`).

---

### Task 11: Production wiring — the town path passes the brief

Every rendered town building now generates from its real family. The plot input grows optional population fields; the adapter prefers the town's own `buildingType` over the role mapping and builds the brief.

**Files:**
- Modify: `src/systems/worldforge/interior/generateInterior.ts` (`InteriorPlotInput`, `blueprintForPlot`, `generateInterior` memo key)
- Modify: `src/systems/worldforge/bridge/interiorParts.ts:175,242` call-site plumbing (and the plot-shaping code that builds `InteriorPlotInput` — trace where `plot` objects are constructed, `townPlanAdapter.ts`)
- Test: `src/systems/worldforge/interior/__tests__/generateInterior.test.ts` (extend), `src/systems/worldforge/__integration__/pipeline.test.ts` (extend one case)

**Interfaces:**

```ts
export interface InteriorPlotInput {
  id: number;
  footprint: Array<[Feet, Feet]>;
  role: string;
  storeys: number;
  // v2 (all optional — legacy callers unchanged):
  /** Town population classification; when present it WINS over role mapping. */
  buildingType?: BuildingType;
  /** The founding household brief (built via town/householdBrief.briefForPlot). */
  household?: HouseholdBrief;
}
```

`blueprintForPlot` passes both straight into `generateBuilding` (`type: plot.buildingType ?? buildingTypeForRole(plot.role)`, `household: plot.household`). `generateInterior`'s memo key gains the same brief digest as Task 8.

- [ ] **Step 1: Write the failing test**

```ts
it('buildingType wins over role; brief flows into the plan', () => {
  const plot = { id: 4, footprint: QUAD_40x30, role: 'house', storeys: 2,
    buildingType: 'smithy' as const, household: FAMILY };
  const plan = blueprintForPlot(plot, rootSeedPath(11));
  expect(plan.type).toBe('smithy');
  expect(plan.household?.homeId).toBe(FAMILY.homeId);
  // legacy shape (no v2 fields) still generates identically to before
  const legacy = blueprintForPlot({ id: 4, footprint: QUAD_40x30, role: 'house', storeys: 2 }, rootSeedPath(11));
  expect(legacy.household).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the type + pass-through, then thread the call sites: in `interiorParts.ts`, where the `InteriorPlotInput` is built from the town plan artifact, attach `buildingType`, and `household: briefForPlot(bp, plan.plots, townSeed)` when the artifact carries the population pass (plots with `homeId`). **Trace the actual construction site first** (grep `role:` object literals near `interiorParts.ts:175`); the artifact plot and `BuildingPlot` may be different shapes — if the artifact drops `homeId/occupants/district`, extend the artifact mapping (in `townPlanAdapter.ts`) to carry them through. Unpopulated towns (no population pass) pass no brief — buildings generate briefless exactly as today. `generateTownRoster.ts:138` keeps its briefless call (roster runs before households exist — note this in a comment).
- [ ] **Step 4: Run to verify pass** — plus `npx vitest run src/systems/worldforge/__integration__/pipeline.test.ts` (the end-to-end guard) and the bridge suites (`src/systems/worldforge/bridge/__tests__/`).
- [ ] **Step 5: Typecheck clean.**

---

### Task 12: Deliberate golden re-freeze + fuzz sweep

The one place v1 pins move. Tasks 9 (frontage) and 11 (briefs in production) change plan output for town buildings — that was approved in the spec ("interiors re-plan once when v2 lands").

**Files:**
- Modify: `src/systems/worldforge/interior/__tests__/__snapshots__/generateInterior.test.ts.snap` (regenerate)
- Modify: any golden in `src/systems/worldforge/interior/__tests__/` and `bridge/__tests__/` that pins coordinates
- Test: extend `generateBuilding.test.ts` with a brief-inclusive fuzz loop

- [ ] **Step 1: Run the FULL worldforge suite** — `npx vitest run src/systems/worldforge/` — and list every failure. Expected failures: coordinate-pinning goldens only. Any OTHER failure is a bug from Tasks 1–11: fix it before re-freezing anything.
- [ ] **Step 2: Re-freeze** — `npx vitest run src/systems/worldforge/ -u`; then `git diff --stat` the snapshot files and eyeball the diff: room/door shifts only, no structural nonsense (a 40-room cottage means a bug, not a new golden).
- [ ] **Step 3: Add the fuzz sweep**

```ts
it('fuzz: 500 random (type × brief) inputs never throw and always seat the family', () => {
  const types = ALL_TYPES; // from Task 1's test
  for (let i = 0; i < 500; i++) {
    const rng = rngFromPath(streamPath(rootSeedPath(i), 'fuzz'));
    const type = types[rng.nextInt(0, types.length)];
    const kids = rng.nextInt(0, 6);
    const slots = [{ tag: 'head', role: 'head' as const, ageBand: 'adult' as const }];
    for (let k = 0; k < kids; k++) slots.push({ tag: `child:${k}`, role: 'child', ageBand: 'child' });
    const plan = generateBuilding({
      buildingId: i, type, seedPath: rootSeedPath(i),
      storeys: 1 + rng.nextInt(0, 3), basement: rng.next() < 0.5,
      household: { homeId: `f${i}`, slots, trade: 'labourer', worksAtHome: false, wealth: 'common' },
    });
    const tags = plan.floors.flatMap((f) => f.rooms).flatMap((r) => r.forSlot?.split(',') ?? []);
    expect(new Set(tags).size).toBe(slots.length); // everyone sleeps exactly once
  }
});
```

- [ ] **Step 4: Full suite green** — `npx vitest run src/systems/worldforge/` + `npx tsc --noEmit`.

---

### Task 13: 2D preview — occupancy toggle + household controls (VISUAL EYEBALL)

The design preview drives the whole layer without the 3D scene: a family selector, an hour slider, claims labeled on rooms, stations dotted, manifests inspectable.

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewBlueprint.tsx`
- Modify: `src/systems/worldforge/interior/renderBlueprintSvg.ts` (occupancy overlay layer)
- Test: component render test alongside existing preview tests

**Behavior:**
- New controls: "Household" preset dropdown (none / smith family of 5 / solo elder / wealthy merchant / crowded misfit — family of 9 in a cottage), hour slider 0–23, "occupancy" toggle.
- With occupancy on: rooms with claims get a small `forSlot` label under the room number; each member's station at the chosen hour renders as a dot at the furnishing (or room anchor), labeled with the member's given name; lit hearths at that hour get a warm halo; container cells get a ⌸ marker whose tooltip (SVG `<title>`) lists the manifest entries.
- The overlay renders from `computeOccupancy` + `containerManifests` output only — proving the layer is drawable without reaching into the generator.

- [ ] **Step 1: Write a render test** — household preset + hour set, assert the SVG contains `data-claim` labels and exactly `household.members.length` `data-station` dots.
- [ ] **Step 2: Implement** the SVG overlay (a `<g data-occupancy>` appended by `renderBlueprintSvg` when given an optional `occupancy?: BuildingOccupancy` + `manifests?: ContainerManifest[]` argument — additive, existing callers unchanged) and the preview controls.
- [ ] **Step 3: Tests green + typecheck.**
- [ ] **Step 4: VISUAL EYEBALL (required — Remy's rule):** start the design preview server (`preview_start`; retry on the known overlapping-restart crash), open `/Aralia/misc/design.html?step=blueprint`, and inspect: smith family at 02:00 (everyone in beds), at 10:00 (smith at the anvil, kids out), at 19:00 (hearthside, hearth halo lit); the crowded-misfit preset (beds-in-hall claims visible on the main room); container tooltips. `preview_screenshot` hangs on this page — inspect via the SVG DOM (`preview_eval` reading attributes) and capture proof via the headless `.agent/scratch/gen-blueprints.mts` pattern (extend it to pass a household). Record findings; fix what reads wrong before calling the task done.

---

### Task 14: 3D consumption — occupants at stations (VISUAL EYEBALL)

The bridge exposes the overlay for a real town building so the 3D scene can place people and light hearths. Data wiring + minimal consumption; full animation polish belongs to the agent-sim/beautification tracks.

**Files:**
- Modify: `src/systems/worldforge/bridge/interiorParts.ts` (or a new small `bridge/buildingOccupancy.ts` — export a `occupancyForPlot(plot, seedPath, townSeed, hour)` helper composing `blueprintForPlot` + `briefForPlot` + `generateHousehold` + `computeOccupancy`)
- Modify: the 3D town/interior scene component that already renders agent-sim commuters (trace from `?phase=agentsim` wiring, `src/routes.ts` slug) to place household members at their stations when inside/near their building, and to drive hearth emissive/light from `hearthLitHours`
- Test: pure test on `occupancyForPlot` (stations resolve to world-space positions inside the building envelope)

- [ ] **Step 1: Write the failing test** — `occupancyForPlot` returns stations whose feet-space positions all fall inside the plan's footprint cells for 10 seeds.
- [ ] **Step 2: Implement** the bridge helper (pure); then the scene consumption: members at home render as agent bodies at station positions (reuse the existing commuter body rendering), hearth-lit drives the existing hearth furnishing's material/light.
- [ ] **Step 3: Tests + typecheck green.**
- [ ] **Step 4: VISUAL EYEBALL (required):** load a real town in 3D (`?phase=agentsim` / Enter-3D per `worldforge-burg-3d-town-handoff` memory), pick a smithy, scrub the clock: dusk — hearth glows, family indoors; night — everyone in bedrooms; midday — smith at the forge, spouse in the house. Use the shoot rig (`shoot.mjs`, per `preview-screenshot-3d-capture` memory — `preview_screenshot` hangs on R3F) for proof captures. Also eyeball one abandoned building (cold hearth, no bodies).
- [ ] **Step 5: Wrap-up bookkeeping:** flip the plan-map node `building-generator-v2` feature statuses for Phase 1A to `done` in `public/planmap/topics.json` (add feature tiles if none exist yet: one per task cluster — vocabulary, brief pipeline, overlay, wiring, preview, 3D); update the `building-generator-v2` memory file.

---

## Plan Self-Review (done at write time)

- **Spec coverage (Phase 1A section):** household brief → Tasks 4/6/8; shared vocabulary → Tasks 1/2; frontage minimal slice → Task 9; claims/schedules/flags/manifests → Task 10; town wiring → Task 11; occupancy preview toggle → Task 13; 3D stations → Task 14; goldens re-freeze → Task 12; reserved history/style fields → Task 3. Lot negotiation and full blocks are Phase 2 (not planned here); roofs/styles are Phase 1B (separate plan).
- **Determinism:** every RNG use names its stream; Tasks 7/9 explicitly preserve stream draw counts for briefless calls; Task 8 snapshot-guards briefless byte-identity until Task 12's deliberate re-freeze.
- **Type consistency:** `HouseholdBrief`/`MemberSlot`/`BriefWealth`/`FrontageInfo` defined once in Task 3 and imported everywhere; `ProgramSlot` exported in Task 6; `BedroomAssignment` defined in Task 6, consumed in Tasks 7/8; `BuildingOccupancy`/`ContainerManifest` defined in Task 10, consumed in 13/14.
- **Known soft spot (flagged, not hidden):** Task 11's artifact-plot field threading depends on the exact `townPlanAdapter.ts` mapping shape — the task starts with a trace step and names the fallback-free rule (unpopulated towns pass no brief).
