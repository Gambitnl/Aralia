# Living Interiors — Live Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a 3D town's interiors track the live game clock — windows and hearths light at dusk and go dark by day, and each household member moves through their house hour by hour — instead of freezing at the hour the player entered.

**Architecture:** Keep baking interior data **once at world generation**, but bake the full **24-hour schedule** (which hours windows glow, which hours the hearth is lit, and each member's station for every hour) instead of a single-hour snapshot. The render side already receives the live clock (`agentClock`); it re-resolves the schedule against that clock. Lighting becomes a declarative re-render on the integer-hour boundary; occupants move in a new live figure layer modeled on the existing street-agent layer (`GroundAgents`). Nothing touches the streaming worker or forces a chunk re-mesh — the worker keeps passing building `parts` through as data, and the main-thread renderer interprets the schedule live.

**Tech Stack:** TypeScript, React, React Three Fiber (`@react-three/fiber`), three.js, Vitest.

## Global Constraints

- **No-fallback directive:** one real path, fail honestly. No silent degradation. If a schedule or transform can't resolve, throw — do not substitute a default.
- **Determinism:** all baked data stays pure and RNG-free. Identical `(plot, seedPath)` yields identical schedule. Render-side clock selection is the only legitimately non-deterministic step.
- **Plain writing, US spelling** in all comments and docs (color, gray, -ize).
- **Units:** interior stations are in **plan feet** (blueprint frame, `0` = min corner); the renderer maps them the same way `SiteBuilding` maps parts. `FT = 0.3048`.
- **No branches/worktrees:** work in `master` only. Coordinate via Agora locks if another agent is live.
- **Visual slices must be eyeballed:** goldens alone are insufficient for the render tasks; render the town and step the clock.

---

## File Structure

**Modify:**
- `src/systems/worldforge/bridge/buildingOccupancy.ts` — add `occupancyScheduleForPlot` (full-day resolver); keep `occupancyForPlot` as a thin one-hour wrapper.
- `src/systems/worldforge/bridge/interiorParts.ts` — add `lightRole` to `SitePart`; tag window/hearth parts unconditionally; stop injecting household occupant boxes into `parts` for populated plots.
- `src/systems/worldforge/bridge/groundChunkLoader.ts` — bake the schedule (`litHours`, `hearthHours`, `occupants`) onto each building record; pass through to the bundle site.
- `src/systems/world3d/types.ts` (or wherever `GroundWorldBuilding` / `SiteBundle` live) — add schedule fields to the building/site record.
- `src/components/World3D/World3DScene.tsx` — `SiteBuilding` derives emissive from the live hour; mount `InteriorHourProvider` and `InteriorOccupants`.
- `src/components/World3D/InteriorLights.tsx` — collect hearths by `lightRole`; gate flame selection by `hearthHours[hour]`; use the shared transform helper.

**Create:**
- `src/components/World3D/interiorPlacement.ts` — the shared site-local → scene transform used by `InteriorLights`, `InteriorOccupants`, and (for the drift-seam fix) verified against `SiteBuilding`.
- `src/components/World3D/InteriorHourContext.tsx` — React context providing the live **integer** game hour to the building subtree (re-renders only on hour change).
- `src/components/World3D/InteriorOccupants.tsx` — the live interior-figure layer.

---

## Foundation

### Task 1: Full-day occupancy schedule resolver

**Files:**
- Modify: `src/systems/worldforge/bridge/buildingOccupancy.ts`
- Test: `src/systems/worldforge/bridge/__tests__/buildingOccupancy.test.ts`

**Interfaces:**
- Consumes: `computeOccupancy` (returns `stationsByHour: OccupantStation[][]`, `flags.hearthLitHours: boolean[]`), `householdForPlot`, `blueprintForPlot`, `windowsLitAt`.
- Produces:
  ```ts
  export interface StationFeetPoint {
    xFt: Feet; yFt: Feet; level: number;
    activity: OccupancyStationPoint['activity'];
  }
  export interface OccupantDaySchedule {
    memberIndex: number;
    name: string;               // given name (first token)
    ageBand: string;            // member.ageBand ?? 'adult'
    occupation: 'resident' | 'shopkeeper' | 'artisan';
    /** stationsByHour[h] = the member's station at hour h, or null when OUT. */
    stationsByHour: (StationFeetPoint | null)[];
  }
  export interface PlotOccupancySchedule {
    litHours: boolean[];        // length 24 — windows glow
    hearthHours: boolean[];     // length 24 — hearth lit
    occupants: OccupantDaySchedule[];
    household: Household;
  }
  export function occupancyScheduleForPlot(
    plotPop: TownPlotPopulation,
    allPlots: readonly TownPlotPopulation[],
    plotInput: InteriorPlotInput,
    seedPath: SeedPath,
    townSeed: SeedPath,
  ): PlotOccupancySchedule | undefined;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// in buildingOccupancy.test.ts
import { occupancyScheduleForPlot } from '../buildingOccupancy';
import { makePopulatedHousePlotFixture } from './fixtures'; // existing helper used by occupancyForPlot tests; reuse the same fixture the one-hour tests use

test('occupancyScheduleForPlot returns a full 24-hour schedule that agrees with the one-hour resolver', () => {
  const f = makePopulatedHousePlotFixture();
  const sched = occupancyScheduleForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed);
  expect(sched).toBeDefined();
  expect(sched!.litHours).toHaveLength(24);
  expect(sched!.hearthHours).toHaveLength(24);

  // Windows are dark at noon, lit at 20:00 for an occupied house.
  expect(sched!.litHours[12]).toBe(false);
  expect(sched!.litHours[20]).toBe(true);

  // Every occupant has a 24-slot station table; night stations are non-null
  // (asleep at home), midday work stations may be null (out).
  for (const occ of sched!.occupants) {
    expect(occ.stationsByHour).toHaveLength(24);
    expect(occ.stationsByHour[2]).not.toBeNull(); // 02:00 asleep at home
  }
});

test('occupancyScheduleForPlot matches occupancyForPlot hour by hour', () => {
  const f = makePopulatedHousePlotFixture();
  const sched = occupancyScheduleForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed)!;
  for (let h = 0; h < 24; h++) {
    const single = occupancyForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed, h)!;
    expect(sched.litHours[h]).toBe(single.litWindows);
    expect(sched.hearthHours[h]).toBe(single.hearthLit);
    // Home members this hour line up with the single-hour stations.
    const homeThisHour = sched.occupants
      .filter((o) => o.stationsByHour[h] !== null)
      .map((o) => o.memberIndex)
      .sort();
    expect(single.stations.map((s) => s.memberIndex).sort()).toEqual(homeThisHour);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/buildingOccupancy.test.ts -t "occupancyScheduleForPlot"`
Expected: FAIL with `occupancyScheduleForPlot is not a function`.

> If `makePopulatedHousePlotFixture` doesn't already exist, factor it out of the existing `occupancyForPlot` test setup in this same file (the arrange block that builds `plotPop`, `allPlots`, `plotInput`, `seedPath`, `townSeed`). Do not invent new fixture data — reuse exactly what the one-hour tests use, so the "matches hour by hour" test is meaningful.

- [ ] **Step 3: Write minimal implementation**

Add to `buildingOccupancy.ts`. Factor the feet-resolution out of `occupancyForPlot` so both share it:

```ts
/** Resolve one station row entry to plan feet (furnishing center, else room
 * anchor center — guaranteed in-room). Mirrors the 2D overlay exactly. */
function stationToFeet(
  st: OccupantStation,
  plan: BlueprintPlan,
): StationFeetPoint | null {
  if (st.where !== 'home' || st.level === undefined) return null;
  const floor = plan.floors.find((f) => f.level === st.level);
  if (!floor) return null;
  let x: Feet;
  let y: Feet;
  const fu = st.furnishingIndex !== undefined ? floor.furnishings[st.furnishingIndex] : undefined;
  if (fu) {
    x = fu.x;
    y = fu.y;
  } else {
    const room = st.roomId !== undefined ? floor.rooms.find((r) => r.id === st.roomId) : undefined;
    // No-fallback: a home station must resolve to a real room. A missing room
    // is a schedule bug, not a (0,0) placement.
    if (!room) {
      throw new Error(
        `stationToFeet: member ${st.memberIndex} home at level ${st.level} room ${st.roomId} ` +
        `but no such room on the floor — occupancy/plan mismatch.`,
      );
    }
    x = (room.anchor.cx + 0.5) * 5;
    y = (room.anchor.cy + 0.5) * 5;
  }
  return { xFt: x, yFt: y, level: st.level, activity: st.activity };
}

/** Map a member's free-text trade onto the closed body Occupation set. Shared
 * with the (removed) inline mapping in groundChunkLoader. */
export function occupationForMember(member: Household['members'][number] | undefined):
  'resident' | 'shopkeeper' | 'artisan' {
  const trade = (member?.occupation ?? '').toLowerCase();
  if (member?.role !== 'head' && member?.role !== 'spouse') return 'resident';
  if (/keep|shop|innkeep|tavern|clerk|official|merchant/.test(trade)) return 'shopkeeper';
  if (/smith|artisan|wright|journey|apprentice|craft|brew|forge/.test(trade)) return 'artisan';
  return 'resident';
}

export function occupancyScheduleForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
): PlotOccupancySchedule | undefined {
  const resolved = householdForPlot(plotPop, allPlots, townSeed);
  if (!resolved) return undefined;
  const { household, worksAtHome } = resolved;

  const plan = blueprintForPlot(plotInput, seedPath);
  const occ = computeOccupancy(plan, household, { worksAtHome });

  const litHours: boolean[] = [];
  const hearthHours: boolean[] = [];
  // Per-member station table, indexed [memberIndex][hour].
  const byMember = new Map<number, (StationFeetPoint | null)[]>();
  for (const m of household.members.keys()) byMember.set(m, new Array(24).fill(null));

  for (let h = 0; h < 24; h++) {
    const row = occ.stationsByHour[h] ?? [];
    let anyHome = false;
    for (const st of row) {
      const feet = stationToFeet(st, plan);
      if (feet) {
        anyHome = true;
        byMember.get(st.memberIndex)?.splice(h, 1, feet);
      }
    }
    const hearth = occ.flags.hearthLitHours[h] ?? false;
    hearthHours[h] = hearth;
    litHours[h] = windowsLitAt(hearth || anyHome, h);
  }

  const occupants: OccupantDaySchedule[] = [];
  household.members.forEach((member, memberIndex) => {
    const stations = byMember.get(memberIndex)!;
    // Skip members who are never home (e.g. servants with no station all day):
    // they contribute no figure. This is not a fallback — it's an empty set.
    if (stations.every((s) => s === null)) return;
    occupants.push({
      memberIndex,
      name: member.name.split(' ')[0] ?? `#${memberIndex}`,
      ageBand: member.ageBand ?? 'adult',
      occupation: occupationForMember(member),
      stationsByHour: stations,
    });
  });

  return { litHours, hearthHours, occupants, household };
}
```

Then rewrite `occupancyForPlot` to delegate (keeps existing callers/tests green):

```ts
export function occupancyForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
  hour: number,
): PlotOccupancy | undefined {
  const sched = occupancyScheduleForPlot(plotPop, allPlots, plotInput, seedPath, townSeed);
  if (!sched) return undefined;
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const stations: OccupancyStationPoint[] = [];
  for (const occ of sched.occupants) {
    const st = occ.stationsByHour[h];
    if (!st) continue;
    stations.push({
      memberIndex: occ.memberIndex,
      name: occ.name,
      activity: st.activity,
      x: st.xFt,
      y: st.yFt,
      level: st.level,
    });
  }
  return {
    stations,
    hearthLit: sched.hearthHours[h],
    litWindows: sched.litHours[h],
    household: sched.household,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/buildingOccupancy.test.ts`
Expected: PASS, including the pre-existing `occupancyForPlot` tests (delegation preserves behavior).

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/bridge/buildingOccupancy.ts src/systems/worldforge/bridge/__tests__/buildingOccupancy.test.ts
git commit -m "feat(interiors): full-day occupancy schedule resolver"
```

---

## Phase 1 — Lighting live

Independently shippable: after this phase, windows and hearths light and darken with the clock. Occupants still stand at their entry-hour spots (fixed in Phase 2).

### Task 2: Tag window and hearth parts unconditionally

**Files:**
- Modify: `src/systems/worldforge/bridge/interiorParts.ts`
- Test: `src/systems/worldforge/bridge/__tests__/interiorParts.test.ts`

**Interfaces:**
- Produces: `SitePart.lightRole?: 'window' | 'hearth'`. Window-pane parts always carry `lightRole: 'window'`; hearth furnishing parts always carry `lightRole: 'hearth'`. `emissiveHex` is no longer set at bake time for these parts (the renderer decides emissive live from the schedule).

- [ ] **Step 1: Write the failing test**

```ts
test('window-pane and hearth parts carry a lightRole regardless of lit state', () => {
  // Build a plot both lit and unlit; the structural tagging must be identical.
  const litParts = buildInteriorPartsFixture({ litWindows: true, hearthLit: true }).parts;
  const darkParts = buildInteriorPartsFixture({ litWindows: false, hearthLit: false }).parts;

  const windows = (ps: SitePart[]) => ps.filter((p) => p.lightRole === 'window');
  const hearths = (ps: SitePart[]) => ps.filter((p) => p.lightRole === 'hearth');

  // Same count of tagged windows/hearths whether lit or not — identity no longer
  // depends on the bake hour.
  expect(windows(litParts).length).toBe(windows(darkParts).length);
  expect(windows(darkParts).length).toBeGreaterThan(0);
  expect(hearths(litParts).length).toBe(hearths(darkParts).length);

  // Bake no longer paints emissive on these parts (render decides live).
  expect(windows(litParts).every((p) => p.emissiveHex === undefined)).toBe(true);
  expect(hearths(litParts).every((p) => p.emissiveHex === undefined)).toBe(true);
});
```

> Use the existing helper the file's tests use to build parts (search the test file for how it calls `buildInteriorParts`/`buildInterior`). Name it `buildInteriorPartsFixture` if none exists and wrap the existing call.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/interiorParts.test.ts -t "lightRole"`
Expected: FAIL — `lightRole` is undefined on all parts.

- [ ] **Step 3: Write minimal implementation**

In `interiorParts.ts`:

1. Add the field to the interface:

```ts
export interface SitePart {
  // ...existing fields...
  emissiveHex?: string;
  tag?: string;
  /** When set, this part is a live-lit surface the renderer drives from the
   * building's hourly schedule: 'window' glass or the 'hearth' fire. Set
   * UNCONDITIONALLY at bake (independent of any hour) so the renderer can find
   * and toggle it. Replaces the old bake-time emissiveHex on these parts. */
  lightRole?: 'window' | 'hearth';
}
```

2. At every window-pane emission site (search `WINDOW_PANE_COLOR` / the `litWindows` gate near lines 293, 622, 640), stop gating emissive on `litWindows`; instead always stamp `lightRole: 'window'` and never set `emissiveHex`. Example transform:

```ts
// BEFORE:
parts.push({ x, z, w, d, h, colorHex: WINDOW_PANE_COLOR,
  ...(litWindows ? { emissiveHex: WINDOW_GLOW_HEX } : {}) });
// AFTER:
parts.push({ x, z, w, d, h, colorHex: WINDOW_PANE_COLOR, lightRole: 'window' });
```

3. At the hearth furnishing site (search `hearthLit` near line 674, `HEARTH_KINDS`), stamp `lightRole: 'hearth'` unconditionally, drop the `emissiveHex` set:

```ts
// AFTER (hearth furnishing box):
const isHearth = HEARTH_KINDS.has(kind);
parts.push({ x, z, w, d, h, colorHex: spec.colorHex,
  ...(isHearth ? { lightRole: 'hearth' } : {}) });
```

4. The `litWindows` / `hearthLit` parameters to `buildInterior` / `buildInteriorParts` are now unused for emissive. Leave the parameters in place for this task (Task 7 removes the occupant baking that also uses them); the emissive branches are simply gone.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/interiorParts.test.ts`
Expected: PASS. Update any pre-existing assertion that checked `emissiveHex === WINDOW_GLOW_HEX`/`HEARTH_GLOW_HEX` on baked parts — those now assert `lightRole` instead. The "byte-identical geometry aside from emissive" test becomes "byte-identical aside from lightRole tag."

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/bridge/interiorParts.ts src/systems/worldforge/bridge/__tests__/interiorParts.test.ts
git commit -m "feat(interiors): tag window/hearth parts with lightRole for live lighting"
```

---

### Task 3: Bake the lighting schedule onto the building record

**Files:**
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` (the plot loop ~1265-1378, and the bundle-site passthrough ~1640-1664)
- Modify: the building/site record type (find `GroundWorldBuilding` and the bundle `Site` type — grep `wallWidthM` in `src/systems/world3d/types.ts` and `groundChunkLoader.ts`)
- Test: `src/systems/worldforge/__integration__/pipeline.test.ts` (extend an existing populated-town case)

**Interfaces:**
- Produces on each building record and its bundle site: `litHours?: boolean[]`, `hearthHours?: boolean[]`. Present only for populated plots; absent for unpopulated (no household).

- [ ] **Step 1: Write the failing test**

```ts
// in pipeline.test.ts, within an existing "populated town" describe block
test('bakes a 24-hour lighting schedule onto populated buildings', () => {
  const world = buildPopulatedGroundWorldFixture(); // reuse the existing helper
  const lit = world.buildings.filter((b) => b.litHours);
  expect(lit.length).toBeGreaterThan(0);
  for (const b of lit) {
    expect(b.litHours).toHaveLength(24);
    expect(b.hearthHours).toHaveLength(24);
    // A populated house is dark-windowed at noon, potentially lit at 20:00.
    expect(b.litHours![12]).toBe(false);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/worldforge/__integration__/pipeline.test.ts -t "lighting schedule"`
Expected: FAIL — `litHours` is undefined on all buildings.

- [ ] **Step 3: Write minimal implementation**

1. Add `litHours?: boolean[]` and `hearthHours?: boolean[]` to the building record type and to the bundle site type.

2. In the plot loop, replace the one-hour `occupancyForPlot(..., hour)` call with the schedule resolver, and derive the current-hour lit flags for the existing (now render-owned) behavior:

```ts
const schedule = p.pop
  ? occupancyScheduleForPlot(p.pop, pops, plotInput, region!.seedPath, townSeed)
  : undefined;
// buildInterior no longer needs live lit flags — parts are tagged, renderer
// decides. Pass false/false; Task 2 already dropped the emissive branches.
const interior = buildInterior(plotInput, region!.seedPath, heightM, occFigures, false, false);
```

3. Carry the schedule onto the building record:

```ts
buildings.push({
  // ...existing fields...
  parts: interior.parts,
  solvedRoof: interior.roof,
  ...(schedule ? { litHours: schedule.litHours, hearthHours: schedule.hearthHours } : {}),
});
```

4. In the bundle passthrough (~1640-1664, where `parts: b.parts` is copied to `bundle.sites[]`), also copy `litHours`/`hearthHours`:

```ts
litHours: b.litHours,
hearthHours: b.hearthHours,
```

5. `occFigures` for populated plots is handled in Task 7. For THIS task, keep the existing populated-plot `occFigures` baking exactly as-is (occupants still static). This task only adds the lighting schedule. Remove the now-unused `hour` parameter usage for lighting but keep `hour` flowing (Task 7 and unpopulated roster figures still read nothing hour-based here — verify no other use of `hour` remains in the loop; if the only remaining use was lighting, leave `hour` in the function signature untouched to avoid a wide refactor this task).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/worldforge/__integration__/pipeline.test.ts`
Expected: PASS. Fix any golden that recorded baked window/hearth emissive on parts (now driven live) — regenerate only the affected golden and eyeball the diff.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(interiors): bake 24-hour lighting schedule onto buildings"
```

---

### Task 4: Live integer-hour context + emissive from schedule

**Files:**
- Create: `src/components/World3D/InteriorHourContext.tsx`
- Modify: `src/components/World3D/World3DScene.tsx` (`SiteBuilding` ~411-549, and its mount point / provider)
- Test: `src/components/World3D/__tests__/InteriorHourContext.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const InteriorHourContext: React.Context<number>; // integer 0-23
  export const InteriorHourProvider: React.FC<{ clock?: number; children: React.ReactNode }>;
  export function useInteriorHour(): number;
  /** Pure: emissive props for a lightRole part at an hour, given the schedule. */
  export function emissiveForPart(
    role: 'window' | 'hearth' | undefined,
    hour: number,
    litHours?: boolean[],
    hearthHours?: boolean[],
  ): { emissive: string; emissiveIntensity: number };
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { emissiveForPart } from '../InteriorHourContext';
import { WINDOW_GLOW_HEX, HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

test('emissiveForPart lights a window only in its lit hours', () => {
  const litHours = Array(24).fill(false); litHours[20] = true;
  expect(emissiveForPart('window', 20, litHours, undefined)).toEqual({ emissive: WINDOW_GLOW_HEX, emissiveIntensity: 1.1 });
  expect(emissiveForPart('window', 12, litHours, undefined)).toEqual({ emissive: '#000000', emissiveIntensity: 0 });
});

test('emissiveForPart lights a hearth only in its lit hours', () => {
  const hearthHours = Array(24).fill(false); hearthHours[19] = true;
  expect(emissiveForPart('hearth', 19, undefined, hearthHours)).toEqual({ emissive: HEARTH_GLOW_HEX, emissiveIntensity: 1.1 });
  expect(emissiveForPart('hearth', 12, undefined, hearthHours)).toEqual({ emissive: '#000000', emissiveIntensity: 0 });
});

test('emissiveForPart leaves non-light parts dark', () => {
  expect(emissiveForPart(undefined, 20, undefined, undefined)).toEqual({ emissive: '#000000', emissiveIntensity: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/InteriorHourContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// InteriorHourContext.tsx
import React, { createContext, useContext, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { WINDOW_GLOW_HEX, HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

export const InteriorHourContext = createContext<number>(12);
export const useInteriorHour = () => useContext(InteriorHourContext);

const DARK = { emissive: '#000000', emissiveIntensity: 0 } as const;

export function emissiveForPart(
  role: 'window' | 'hearth' | undefined,
  hour: number,
  litHours?: boolean[],
  hearthHours?: boolean[],
): { emissive: string; emissiveIntensity: number } {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (role === 'window') return litHours?.[h] ? { emissive: WINDOW_GLOW_HEX, emissiveIntensity: 1.1 } : { ...DARK };
  if (role === 'hearth') return hearthHours?.[h] ? { emissive: HEARTH_GLOW_HEX, emissiveIntensity: 1.1 } : { ...DARK };
  return { ...DARK };
}

/** Publishes the live INTEGER hour to the building subtree. Re-renders the
 * subtree only when the integer hour changes (not per frame). */
export const InteriorHourProvider: React.FC<{ clock?: number; children: React.ReactNode }> = ({ clock, children }) => {
  const [hour, setHour] = useState<number>(() => Math.floor(((clock ?? 12) % 24 + 24) % 24));
  const last = useRef(hour);
  useFrame(() => {
    const src = (window as { __wfAgentClock?: number }).__wfAgentClock ?? clock ?? 12;
    const h = Math.floor(((src % 24) + 24) % 24);
    if (h !== last.current) { last.current = h; setHour(h); }
  });
  return <InteriorHourContext.Provider value={hour}>{children}</InteriorHourContext.Provider>;
};
```

In `World3DScene.tsx`:
- Wrap the `SitePieces` subtree in `<InteriorHourProvider clock={agentClock}>`.
- In `SiteBuilding`'s `s.parts.map(...)`, replace the baked emissive props:

```tsx
const hour = useInteriorHour();
// ...inside parts.map((p) => ...):
const em = emissiveForPart(p.lightRole, hour, s.litHours, s.hearthHours);
// on the <meshStandardMaterial>:
emissive={em.emissive}
emissiveIntensity={em.emissiveIntensity}
```

(Keep the old `p.emissiveHex ?? '#000000'` path as a fallback ONLY for parts with no `lightRole` but a `tag`/legacy emissive — there should be none after Task 2, so it can be removed; verify no other producer sets `emissiveHex`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/InteriorHourContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Eyeball gate (REQUIRED — visual slice)**

Render a populated town in the ground/town 3D preview. Step the game clock across 12:00 → 18:00 → 22:00 → 02:00. Confirm: windows dark at noon, glowing by 18:00, still glowing at 22:00, and the town reads lit-then-dark as hours pass — without re-entering the world. Capture a noon vs 20:00 screenshot pair.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(interiors): windows/hearths light live from the game clock"
```

---

### Task 5: Hearth flame lights follow the live schedule

**Files:**
- Modify: `src/components/World3D/InteriorLights.tsx`
- Test: `src/components/World3D/__tests__/InteriorLights.test.tsx`

**Interfaces:**
- `collectInteriorLighting` now selects hearth parts by `lightRole === 'hearth'` (not baked emissive) and attaches each hearth's `hearthHours` schedule so the per-frame selector can skip hearths dark at the current hour.
- Produces: `HearthLight` gains `hearthHours?: boolean[]`; the component takes a live `hour` prop.

- [ ] **Step 1: Write the failing test**

```ts
test('collectInteriorLighting emits a hearth per lightRole hearth part with its schedule', () => {
  const loaded = [makeChunkWithLitHearthBuilding()]; // hearthHours[19]=true on the site
  const { hearths } = collectInteriorLighting(loaded, ORIGIN);
  expect(hearths.length).toBe(1);
  expect(hearths[0].hearthHours?.[19]).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/InteriorLights.test.tsx -t "lightRole hearth"`
Expected: FAIL — `collectInteriorLighting` keys off `emissiveHex === HEARTH_GLOW_HEX`.

- [ ] **Step 3: Implement**

- In `collectInteriorLighting`, change the part filter from `p.emissiveHex !== HEARTH_GLOW_HEX` to `p.lightRole !== 'hearth'`, and push `hearthHours: s.hearthHours` onto each `HearthLight`.
- Add a `hour: number` prop to `InteriorLights` (fed from `agentClock` at the mount in `World3DScene.tsx:782`). In the `useFrame` selector, skip a hearth whose `hearthHours?.[hour]` is false before the distance test.

```ts
// in the hearth loop:
if (hearths[h].hearthHours && !hearths[h].hearthHours![hourInt]) continue;
```
where `hourInt = ((Math.floor(hour) % 24) + 24) % 24` computed once per frame.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/InteriorLights.test.tsx`
Expected: PASS.

- [ ] **Step 5: Eyeball gate**

In the same preview, confirm a hearth casts its warm point light only during hearth hours (evening), and goes dark by day, as the clock steps — matching the emissive box from Task 4.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(interiors): hearth flame lights follow the live schedule"
```

**Phase 1 ships here.** Lighting is fully live.

---

## Phase 2 — Occupants live

### Task 6: Shared site-local → scene placement transform

**Files:**
- Create: `src/components/World3D/interiorPlacement.ts`
- Modify: `src/components/World3D/InteriorLights.tsx` (use the helper for hearth projection — fixes the hand-copied-transform drift seam)
- Test: `src/components/World3D/__tests__/interiorPlacement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SitePlacement { gx: number; gz: number; rotationY: number; doorZSign: number; }
  /** Project a site-local (x,z) meters point into scene-space (x,z). Applies the
   * doorZSign z-flip then the group yaw — the SAME transform SiteBuilding applies
   * to its group. Single source of truth for hearth lights and occupant figures. */
  export function siteLocalToScene(localX: number, localZ: number, s: SitePlacement): { x: number; z: number };
  /** Plan feet (blueprint frame, 0=min corner) → site-local meters, centered.
   * widthFt/depthFt are the interior envelope in feet. */
  export function planFeetToSiteLocal(xFt: number, yFt: number, widthFt: number, depthFt: number): { x: number; z: number };
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { siteLocalToScene, planFeetToSiteLocal } from '../interiorPlacement';

test('siteLocalToScene with no rotation and doorSign -1 flips z and offsets', () => {
  const s = { gx: 10, gz: 5, rotationY: 0, doorZSign: -1 };
  expect(siteLocalToScene(2, 3, s)).toEqual({ x: 12, z: 5 + 3 }); // lz = 3 * -(-1) = 3
});

test('siteLocalToScene rotates 90deg CCW about +Y', () => {
  const s = { gx: 0, gz: 0, rotationY: Math.PI / 2, doorZSign: -1 };
  const out = siteLocalToScene(1, 0, s); // rx = 1*cos - ...; matches InteriorLights math
  expect(out.x).toBeCloseTo(Math.cos(Math.PI / 2) * 1, 6);
  expect(out.z).toBeCloseTo(-Math.sin(Math.PI / 2) * 1, 6);
});

test('planFeetToSiteLocal centers the frame', () => {
  // A point at the exact center of a 20ft x 30ft interior maps to (0,0) local.
  expect(planFeetToSiteLocal(10, 15, 20, 30)).toEqual({ x: 0, z: 0 });
});
```

> Derive the exact rotation/flip convention by reading the current hearth projection in `InteriorLights.tsx:114-127` and `SiteBuilding`'s group transform in `World3DScene.tsx:411-489`. The test values above encode: `lz = localZ * -doorZSign`, `rx = lx*cos + lz*sin`, `rz = -lx*sin + lz*cos`, `x = gx + rx`, `z = gz + rz`. Confirm `planFeetToSiteLocal` matches how `SiteBuilding` centers plan feet (frontage +x along the 0→1 edge, depth +z inward).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/interiorPlacement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export interface SitePlacement { gx: number; gz: number; rotationY: number; doorZSign: number; }

export function siteLocalToScene(localX: number, localZ: number, s: SitePlacement): { x: number; z: number } {
  const cos = Math.cos(s.rotationY);
  const sin = Math.sin(s.rotationY);
  const lx = localX;
  const lz = localZ * -s.doorZSign;
  return { x: s.gx + (lx * cos + lz * sin), z: s.gz + (-lx * sin + lz * cos) };
}

const FT = 0.3048;
export function planFeetToSiteLocal(xFt: number, yFt: number, widthFt: number, depthFt: number): { x: number; z: number } {
  // Center the frame: plan 0..widthFt maps to -w/2..+w/2 (frontage +x), and
  // 0..depthFt to depth +z inward — the same centering SiteBuilding uses.
  return { x: (xFt - widthFt / 2) * FT, z: (yFt - depthFt / 2) * FT };
}
```

Then refactor `InteriorLights.collectInteriorLighting` to build a `SitePlacement` per site and call `siteLocalToScene(p.x, p.z, placement)` instead of the inline math (lines 114-127). The hearth y stays as-is (`s.surfaceY + (p.baseY ?? 0) + p.h*0.5`). Re-run `InteriorLights.test.tsx` — it must still pass (the transform is identical, now shared).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/interiorPlacement.test.ts src/components/World3D/__tests__/InteriorLights.test.tsx`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(interiors): shared site placement transform (kills hand-copied drift)"
```

---

### Task 7: Bake occupant day-schedule onto buildings; stop baking occupant boxes

**Files:**
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` (plot loop; remove populated-plot `occFigures` baking, add occupant schedule)
- Modify: `src/systems/worldforge/bridge/interiorParts.ts` (drop the occupant body/head boxes for the household path — Task 2 kept them; remove now)
- Modify: building/site record type — add `occupants?: BuildingOccupantRender[]`
- Test: `pipeline.test.ts`

**Interfaces:**
- Produces on the building/site record:
  ```ts
  export interface BuildingOccupantRender {
    id: number;                 // stable: plotId*100 + memberIndex
    ageBand: string;
    body: OccupantBody;         // from bodyPlanToOccupantBody(generateBody(...))
    stationsByHour: (StationFeetPoint | null)[];
  }
  // building.occupants?: BuildingOccupantRender[]; building.interiorWidthFt/DepthFt for the frame.
  ```

- [ ] **Step 1: Write the failing test**

```ts
test('populated buildings carry an occupant render schedule and NO occupant boxes in parts', () => {
  const world = buildPopulatedGroundWorldFixture();
  const b = world.buildings.find((x) => x.occupants && x.occupants.length > 0)!;
  expect(b.occupants![0].stationsByHour).toHaveLength(24);
  expect(b.occupants![0].body).toBeDefined();
  // Occupant geometry is no longer baked into the static parts.
  const occupantBoxes = b.parts.filter((p) => p.tag === 'occupant');
  expect(occupantBoxes.length).toBe(0);
});
```

> If occupant boxes weren't previously tagged, tag them `tag: 'occupant'` in interiorParts first (a one-line change) so the "no occupant boxes" assertion is precise, then remove them.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/systems/worldforge/__integration__/pipeline.test.ts -t "occupant render schedule"`
Expected: FAIL.

- [ ] **Step 3: Implement**

1. In `interiorParts.ts`, the household-occupant path currently pushes body+head boxes (~763-781). Remove that push for figures carrying a station identity (the populated household path). Unpopulated roster figures (the `else` branch feeding `occFigures`) stay as-is for now — they are the street/commuter fallback and out of scope.

2. In `groundChunkLoader.ts`, build the occupant render list from the schedule + body synthesis (reuse the exact body pipeline from the old inline code — `bodyPlanToOccupantBody(generateBody(occLike, childSeedPath(townSeed, \`member:${p.id}:${memberIndex}\`)))`):

```ts
const occupantsRender: BuildingOccupantRender[] | undefined = schedule
  ? schedule.occupants.map((o) => {
      const member = schedule.household.members[o.memberIndex];
      const occLike = {
        id: p.id * 100 + o.memberIndex,
        name: member?.name ?? o.name,
        ageBand: o.ageBand,
        homePlotId: p.id,
        occupation: o.occupation,
      };
      return {
        id: occLike.id,
        ageBand: o.ageBand,
        body: bodyPlanToOccupantBody(generateBody(occLike, childSeedPath(townSeed, `member:${p.id}:${o.memberIndex}`))),
        stationsByHour: o.stationsByHour,
      };
    })
  : undefined;
```

3. Pass `false, false` for `occFigures`/lit flags of populated plots (occupants are no longer baked). For populated plots, pass an empty `occFigures` so `buildInterior` bakes no bodies; keep unpopulated roster `occFigures` unchanged.

4. Attach `occupants: occupantsRender`, plus the interior frame size (`interiorWidthFt`, `interiorDepthFt` — read from the blueprint/interior envelope in feet) to the building record and the bundle site passthrough.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/systems/worldforge/__integration__/pipeline.test.ts`
Expected: PASS. Regenerate affected goldens (occupant boxes gone from parts) and eyeball the diff.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(interiors): bake occupant day-schedule; remove baked occupant boxes"
```

---

### Task 8: Live interior-occupant render layer

**Files:**
- Create: `src/components/World3D/InteriorOccupants.tsx`
- Test: `src/components/World3D/__tests__/InteriorOccupants.test.tsx` (logic-only: the per-hour position resolver)

**Interfaces:**
- Produces:
  ```ts
  /** Pure: resolve one occupant's scene position at an hour, or null if OUT. */
  export function occupantScenePosition(
    occ: BuildingOccupantRender, hour: number,
    frame: { widthFt: number; depthFt: number }, placement: SitePlacement, surfaceY: number,
  ): { x: number; y: number; z: number } | null;
  const InteriorOccupants: React.FC<{ loaded: LoadedChunk[]; origin: SceneOrigin; hour: number }>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { occupantScenePosition } from '../InteriorOccupants';

test('occupantScenePosition returns null when the occupant is OUT that hour', () => {
  const occ = { id: 1, ageBand: 'adult', body: {} as any,
    stationsByHour: Array(24).fill(null) };
  expect(occupantScenePosition(occ as any, 12, { widthFt: 20, depthFt: 30 },
    { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 }, 0)).toBeNull();
});

test('occupantScenePosition maps a home station through plan-feet then placement', () => {
  const occ = { id: 1, ageBand: 'adult', body: {} as any,
    stationsByHour: (() => { const a = Array(24).fill(null); a[2] = { xFt: 10, yFt: 15, level: 0, activity: 'sleeping' }; return a; })() };
  const pos = occupantScenePosition(occ as any, 2, { widthFt: 20, depthFt: 30 },
    { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 }, 1.0);
  // center of frame → local (0,0) → scene (gx,gz); y = surfaceY + level*storeyH
  expect(pos).toEqual({ x: 5, y: 1.0, z: 7 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/World3D/__tests__/InteriorOccupants.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// InteriorOccupants.tsx
import React, { useMemo } from 'react';
import type { LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { siteLocalToScene, planFeetToSiteLocal, type SitePlacement } from './interiorPlacement';
import OccupantFigure from './OccupantFigure'; // reuse the existing figure mesh SiteBuilding used for occFigures; extract if inline

const STOREY_M = 3; // matches groundChunkLoader heightM = storeys*3

export function occupantScenePosition(occ, hour, frame, placement: SitePlacement, surfaceY) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const st = occ.stationsByHour[h];
  if (!st) return null;
  const local = planFeetToSiteLocal(st.xFt, st.yFt, frame.widthFt, frame.depthFt);
  const { x, z } = siteLocalToScene(local.x, local.z, placement);
  return { x, y: surfaceY + st.level * STOREY_M, z };
}

const InteriorOccupants: React.FC<{ loaded: LoadedChunk[]; origin: SceneOrigin; hour: number }> = ({ loaded, origin, hour }) => {
  // Flatten loaded chunks → (occupant, placement, frame, surfaceY). Recompute
  // only when the loaded-chunk set changes; positions recompute on `hour`.
  const figures = useMemo(() => {
    const out: Array<{ key: string; occ: any; placement: SitePlacement; frame: any; surfaceY: number }> = [];
    for (const chunk of loaded) {
      const o = chunkOriginWorld(chunk.cx, chunk.cy);
      const cs = worldToScene(o.x, o.y, origin);
      for (const s of chunk.bundle.sites) {
        if (!s.occupants) continue;
        const placement: SitePlacement = {
          gx: cs.x + s.localX, gz: cs.z + s.localZ,
          rotationY: s.rotationY ?? 0, doorZSign: s.doorZSign ?? -1,
        };
        const frame = { widthFt: s.interiorWidthFt, depthFt: s.interiorDepthFt };
        for (const occ of s.occupants) out.push({ key: `${s.localX}:${s.localZ}:${occ.id}`, occ, placement, frame, surfaceY: s.surfaceY });
      }
    }
    return out;
  }, [loaded.map((c) => `${c.cx}|${c.cy}`).join(','), origin]);

  return (
    <>
      {figures.map((f) => {
        const pos = occupantScenePosition(f.occ, hour, f.frame, f.placement, f.surfaceY);
        if (!pos) return null; // OUT this hour — not rendered
        return <OccupantFigure key={f.key} body={f.occ.body} ageBand={f.occ.ageBand}
          position={[pos.x, pos.y, pos.z]} rotationY={f.placement.rotationY} />;
      })}
    </>
  );
};
export default InteriorOccupants;
```

> If the occupant figure mesh is currently inline in `SiteBuilding` (body+head boxes from `OccupantBody`), extract it into `OccupantFigure.tsx` so both the (removed) static path and this live layer share one figure renderer. v1 SNAPS between stations — no walk animation. Walk-lerp is a follow-up (note on the plan-map).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/World3D/__tests__/InteriorOccupants.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(interiors): live interior-occupant render layer (position resolver)"
```

---

### Task 9: Mount the occupant layer in the scene

**Files:**
- Modify: `src/components/World3D/World3DScene.tsx` (mount `InteriorOccupants` beside `InteriorLights` ~782, fed by `agentClock`)

- [ ] **Step 1: Mount**

```tsx
<InteriorLights loaded={loaded} origin={sceneOrigin} hour={agentClock ?? 12} />
<InteriorOccupants loaded={loaded} origin={sceneOrigin} hour={agentClock ?? 12} />
```

- [ ] **Step 2: Eyeball gate (REQUIRED — the payoff)**

Render a populated town. Without re-entering, step the clock:
- **02:00** — members in bedrooms (sleeping stations), none out.
- **08:00–17:00** — working members OUT (no figure); at-home members at day stations.
- **18:00** — meal station (table), then **19:00–21:00** hearthside.
- Confirm figures move room-to-room and floor-to-floor as hours pass, appear/disappear correctly, and stand on the right floor (level). Capture a night vs midday screenshot pair.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(interiors): occupants walk their day on the live clock"
```

---

## Verification before completion

- [ ] Full interior/bridge/world3d test run green:
  `npx vitest run src/systems/worldforge/bridge src/systems/worldforge/interior src/systems/worldforge/__integration__ src/components/World3D`
- [ ] The two eyeball gates (Task 4/5 lighting, Task 9 occupants) captured with before/after screenshots and sent to Remy per the visual-proof cadence.
- [ ] Grep confirms no remaining bake-time `emissiveHex` on window/hearth parts and no `(0,0)` anchor fallback (Task 1 replaced it with a throw).
- [ ] Plan-map node appended: "Living interiors — live clock" under the interiors branch, with the walk-animation follow-up noted.

## Self-review notes (author)

- **Spec coverage:** both halves the user chose (lighting + occupants) are covered — lighting in Phase 1 (Tasks 2-5), occupants in Phase 2 (Tasks 6-9), on the shared schedule foundation (Task 1). The drift-seam #3 fix rides along in Task 6.
- **Streaming constraint respected:** no task re-inits the worker or forces a chunk re-mesh; all liveness is render-side against `agentClock`, which already flows to the scene.
- **No-fallback:** Task 1 turns the silent `(0,0)` anchor default into a throw; window/hearth identity no longer depends on the bake hour.
- **Open design choice deferred, not skipped:** occupants SNAP between stations (v1). Walk-path animation and any eventual merge with the street agent-sim are follow-ups, flagged on the plan-map — not silently dropped.
