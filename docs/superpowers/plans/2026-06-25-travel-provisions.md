# Travel Provisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate long-distance world travel on the party's food supply, and surface that limit on the world atlas *before* the player commits to a trip.

**Architecture:** A pure `provisioning.ts` computes days-of-food (from rations in the shared `GameState.inventory`), daily need (party size), and a per-trip status (`inRange` / `shortfallDays` / `severity`). Pure formatters in `travelReadout.ts` turn that into UI strings. MapPane consumes both to render a Travel-mode readout line and a graduated "provisions-short" overlay on out-of-range atlas cells. `handleTileClick` (App.tsx) consults the status before moving: in range → move + spend food; short → a choice flow (turn back / forage / half-rations / push-on). Push-on that runs out auto-halts and applies starvation conditions + companion loyalty loss.

**Tech Stack:** TypeScript, React, Vitest + Testing Library, existing reducer/action system (`ADD_ITEM`/`REMOVE_ITEM`/`ADVANCE_TIME`/`UPDATE_COMPANION_APPROVAL`), the atlas SVG renderer (`AtlasSvgView`), and the travel-route planner (`routePlanning.ts` → `RoutePlan.minutes`).

**Spec:** `docs/superpowers/specs/2026-06-25-travel-provisioning-design.md`

**Out of scope (deferred — see spec):** mounts as consumers, vendor-rapport auto-resupply, all non-party-NPC provisioning/consent.

---

## File Structure

- **Create** `src/systems/travel/provisioning.ts` — pure provisioning math. One responsibility: turn (inventory, party size, trip days, ration mode) into a provision status. No React.
- **Create** `src/systems/travel/__tests__/provisioning.test.ts` — unit tests for the math.
- **Modify** `src/data/items/` (rations item) — add a canonical `rations` food item to the item registry.
- **Modify** `src/systems/travel/travelReadout.ts` — add pure formatters for the provisions line.
- **Modify** `src/systems/travel/__tests__/travelReadout.test.ts` (create if absent) — tests for the new formatters.
- **Modify** `src/components/MapPane.tsx` — compute provision status for the hovered/picked cell; pass overlay data to `AtlasSvgView`; render the readout line.
- **Modify** `src/components/Worldforge/AtlasSvgView.tsx` — render the "provisions-short" cell overlay from a new optional prop.
- **Modify** `src/App.tsx` (`handleTileClick`) — gate the travel move on provision status; food spend; choice flow; starvation + desertion.
- **Modify** `src/state/actionTypes.ts` + a reducer — add `SET_PARTY_CONDITION` action for starvation.

---

## Task 1: Provisioning core — days of food

**Files:**
- Create: `src/systems/travel/provisioning.ts`
- Test: `src/systems/travel/__tests__/provisioning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { RATIONS_ITEM_ID, daysOfFood } from '../provisioning';
import type { Item } from '@/types/items';

const ration = (quantity: number): Item =>
  ({ id: RATIONS_ITEM_ID, name: 'Rations', description: '', type: 'food_drink', quantity }) as Item;

describe('daysOfFood', () => {
  it('sums ration-days across all rations stacks in inventory', () => {
    expect(daysOfFood([ration(3), ration(2)])).toBe(5);
  });
  it('ignores non-ration items', () => {
    const sword = { id: 'sword', name: 'Sword', description: '', type: 'weapon' } as Item;
    expect(daysOfFood([ration(4), sword])).toBe(4);
  });
  it('treats a ration stack with no quantity as 1 day', () => {
    expect(daysOfFood([{ id: RATIONS_ITEM_ID, name: 'R', description: '', type: 'food_drink' } as Item])).toBe(1);
  });
  it('is 0 for an empty inventory', () => {
    expect(daysOfFood([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: FAIL — cannot find module `../provisioning`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * @file provisioning.ts — pure travel-provisioning math (v1: player party only).
 *
 * Days-of-food comes from rations carried in the shared party inventory; daily
 * need is the party size. No React/DOM, no game-state mutation. Mounts and
 * non-party NPCs are deferred (see the design spec) — the consumer count is a
 * single number here so those can be folded into it later.
 */
import type { Item } from '@/types/items';

/** Canonical one-day-ration item id. A stack's `quantity` is its ration-days. */
export const RATIONS_ITEM_ID = 'rations';

/** Total ration-days carried in the party inventory. */
export function daysOfFood(inventory: readonly Item[]): number {
  let total = 0;
  for (const item of inventory) {
    if (item.id === RATIONS_ITEM_ID) total += item.quantity ?? 1;
  }
  return total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/travel/provisioning.ts src/systems/travel/__tests__/provisioning.test.ts
git commit -m "feat(travel): provisioning daysOfFood core"
```

---

## Task 2: Provisioning core — daily need, food range, trip days

**Files:**
- Modify: `src/systems/travel/provisioning.ts`
- Test: `src/systems/travel/__tests__/provisioning.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { dailyNeed, foodRangeDays, tripDaysFromMinutes } from '../provisioning';

describe('dailyNeed', () => {
  it('is one ration per consumer at full rations', () => {
    expect(dailyNeed(4, 'full')).toBe(4);
  });
  it('halves consumption (rounded up) on half rations', () => {
    expect(dailyNeed(4, 'half')).toBe(2);
    expect(dailyNeed(3, 'half')).toBe(2); // ceil(1.5)
  });
  it('is 0 for an empty party (defensive — no gate)', () => {
    expect(dailyNeed(0, 'full')).toBe(0);
  });
});

describe('foodRangeDays', () => {
  it('is days of food divided by per-day need, floored', () => {
    expect(foodRangeDays(10, 4, 'full')).toBe(2);   // floor(10/4)
    expect(foodRangeDays(10, 4, 'half')).toBe(5);    // floor(10/2)
  });
  it('is Infinity when there are no consumers', () => {
    expect(foodRangeDays(0, 0, 'full')).toBe(Infinity);
  });
});

describe('tripDaysFromMinutes', () => {
  it('rounds partial days up to whole travel-days', () => {
    expect(tripDaysFromMinutes(60)).toBe(1);       // 1h -> 1 day
    expect(tripDaysFromMinutes(24 * 60)).toBe(1);  // exactly 1 day
    expect(tripDaysFromMinutes(25 * 60)).toBe(2);  // spills into day 2
  });
  it('is 0 for a zero-length trip', () => {
    expect(tripDaysFromMinutes(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: FAIL — `dailyNeed`/`foodRangeDays`/`tripDaysFromMinutes` not exported.

- [ ] **Step 3: Implement**

Append to `src/systems/travel/provisioning.ts`:

```ts
export type RationMode = 'full' | 'half';

/** Per-day ration consumption for `consumers` people at the given ration mode. */
export function dailyNeed(consumers: number, mode: RationMode): number {
  if (consumers <= 0) return 0;
  return mode === 'half' ? Math.ceil(consumers / 2) : consumers;
}

/** Whole travel-days a trip of `minutes` costs (partial day rounds up). */
export function tripDaysFromMinutes(minutes: number): number {
  return Math.ceil(Math.max(0, minutes) / (24 * 60));
}

/** How many travel-days the party can sustain before food runs out. */
export function foodRangeDays(days: number, consumers: number, mode: RationMode): number {
  const need = dailyNeed(consumers, mode);
  if (need <= 0) return Infinity; // no consumers → never gated (defensive)
  return Math.floor(days / need);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/travel/provisioning.ts src/systems/travel/__tests__/provisioning.test.ts
git commit -m "feat(travel): provisioning daily need, range, trip days"
```

---

## Task 3: Provisioning core — per-trip status + severity

**Files:**
- Modify: `src/systems/travel/provisioning.ts`
- Test: `src/systems/travel/__tests__/provisioning.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { provisionStatusForTrip } from '../provisioning';

describe('provisionStatusForTrip', () => {
  const opts = (tripDays: number, days: number, consumers: number, mode: 'full' | 'half' = 'full') =>
    provisionStatusForTrip({ tripDays, daysOfFood: days, consumers, mode });

  it('is in range when food covers the whole trip', () => {
    const s = opts(2, 10, 4); // range 2, trip 2
    expect(s).toEqual({ inRange: true, shortfallDays: 0, severity: 'none', foodRangeDays: 2, tripDays: 2 });
  });
  it('flags a minor shortfall (<= one third of the trip)', () => {
    const s = opts(6, 10, 2); // range 5, trip 6 -> short 1 of 6
    expect(s.inRange).toBe(false);
    expect(s.shortfallDays).toBe(1);
    expect(s.severity).toBe('minor');
  });
  it('flags a major shortfall (> one third of the trip)', () => {
    const s = opts(6, 2, 2); // range 1, trip 6 -> short 5 of 6
    expect(s.inRange).toBe(false);
    expect(s.shortfallDays).toBe(5);
    expect(s.severity).toBe('major');
  });
  it('never gates an empty party', () => {
    const s = opts(9, 0, 0);
    expect(s.inRange).toBe(true);
    expect(s.severity).toBe('none');
  });
  it('never gates a zero-day trip', () => {
    const s = opts(0, 0, 4);
    expect(s.inRange).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: FAIL — `provisionStatusForTrip` not exported.

- [ ] **Step 3: Implement**

Append to `src/systems/travel/provisioning.ts`:

```ts
export type ProvisionSeverity = 'none' | 'minor' | 'major';

export interface ProvisionStatus {
  inRange: boolean;
  /** Travel-days the trip exceeds the food range (0 when in range). */
  shortfallDays: number;
  severity: ProvisionSeverity;
  foodRangeDays: number;
  tripDays: number;
}

export interface ProvisionInput {
  tripDays: number;
  daysOfFood: number;
  consumers: number;
  mode: RationMode;
}

/** Severity threshold: a shortfall up to this fraction of the trip reads "minor". */
const MINOR_SHORTFALL_FRACTION = 1 / 3;

export function provisionStatusForTrip(input: ProvisionInput): ProvisionStatus {
  const range = foodRangeDays(input.daysOfFood, input.consumers, input.mode);
  const tripDays = Math.max(0, Math.floor(input.tripDays));
  const safeRange = Number.isFinite(range) ? range : tripDays; // no consumers → always in range
  const shortfallDays = Math.max(0, tripDays - safeRange);
  const inRange = shortfallDays === 0;
  let severity: ProvisionSeverity = 'none';
  if (!inRange) {
    severity = shortfallDays <= Math.ceil(tripDays * MINOR_SHORTFALL_FRACTION) ? 'minor' : 'major';
  }
  return { inRange, shortfallDays, severity, foodRangeDays: safeRange, tripDays };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/travel/provisioning.ts src/systems/travel/__tests__/provisioning.test.ts
git commit -m "feat(travel): provisioning per-trip status + severity"
```

---

## Task 4: The Rations item

**Files:**
- Modify: the item registry. First locate it: `npx tsx -e "0"` is not needed — run `grep -rl "id: 'torch'" src/data` to find the file that defines basic gear items; add rations there. If no such file, create `src/data/items/provisionItems.ts` and export it from the same index the other item data uses.
- Test: `src/systems/travel/__tests__/provisioning.test.ts` (extend) OR a small data test.

- [ ] **Step 1: Find where simple items are registered**

Run: `grep -rln "ItemType.FoodDrink\|food_drink" src/data | head`
Expected: a data file listing food/drink items. Open it; mirror its export pattern.

- [ ] **Step 2: Add the rations item**

Add an item object (matching the file's existing shape) with:

```ts
{
  id: 'rations',                 // MUST equal RATIONS_ITEM_ID
  name: 'Rations (1 day)',
  description: 'A day of trail food for one traveler — dried meat, hardtack, and nuts.',
  type: 'food_drink',
  weight: 2,
  costInGp: 0.5,
  quantity: 1,
}
```

- [ ] **Step 3: Verify it resolves through the item lookup**

Run: `grep -rn "getItemById\|ITEMS_BY_ID\|itemRegistry" src/data | head`
Confirm `rations` is reachable via the same lookup `ADD_ITEM`/`REMOVE_ITEM` use (so `ADD_ITEM { itemId: 'rations', count }` works). If items are looked up by id from a map, ensure the new item is included in that map.

- [ ] **Step 4: Smoke test**

Run: `npx vitest run src/systems/travel/__tests__/provisioning.test.ts`
Expected: PASS (unchanged — this task is data only; the import path for the id is already covered).

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(items): add canonical Rations (1 day) item"
```

---

## Task 5: Provision readout formatters

**Files:**
- Modify: `src/systems/travel/travelReadout.ts`
- Test: Create `src/systems/travel/__tests__/travelReadout.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { formatProvisionLine } from '../travelReadout';

describe('formatProvisionLine', () => {
  it('reads OK and shows remaining margin when in range', () => {
    const line = formatProvisionLine({ inRange: true, shortfallDays: 0, severity: 'none', foodRangeDays: 6, tripDays: 4 });
    expect(line.text).toContain('Food: 6 days');
    expect(line.ok).toBe(true);
  });
  it('reads the shortfall when short', () => {
    const line = formatProvisionLine({ inRange: false, shortfallDays: 2, severity: 'minor', foodRangeDays: 3, tripDays: 5 });
    expect(line.text).toContain('short 2 days');
    expect(line.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/systems/travel/__tests__/travelReadout.test.ts`
Expected: FAIL — `formatProvisionLine` not exported.

- [ ] **Step 3: Implement**

Append to `src/systems/travel/travelReadout.ts`:

```ts
import type { ProvisionStatus } from './provisioning';

export interface ProvisionLine {
  text: string;
  ok: boolean;
  /** Color for the chip/line, matching severity. */
  color: string;
}

/** One-line provisions readout: "Food: 6 days" or "Food: 3 days · short 2 days". */
export function formatProvisionLine(status: ProvisionStatus): ProvisionLine {
  const base = `Food: ${status.foodRangeDays} day${status.foodRangeDays === 1 ? '' : 's'}`;
  if (status.inRange) return { text: base, ok: true, color: '#22c55e' };
  const color = status.severity === 'major' ? '#ef4444' : '#eab308';
  return { text: `${base} · short ${status.shortfallDays} day${status.shortfallDays === 1 ? '' : 's'}`, ok: false, color };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/travel/__tests__/travelReadout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/travel/travelReadout.ts src/systems/travel/__tests__/travelReadout.test.ts
git commit -m "feat(travel): provision readout formatter"
```

---

## Task 6: AtlasSvgView — provisions-short cell overlay

**Files:**
- Modify: `src/components/Worldforge/AtlasSvgView.tsx`
- Test: `src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`

- [ ] **Step 1: Write failing test**

Add to the existing AtlasSvgView test file:

```ts
it('renders a provisions-short overlay for each shortfall cell index', () => {
  const { container } = render(
    <AtlasSvgView atlas={stub} width={300} height={300} provisionShortCellIds={[1]} />,
  );
  expect(container.querySelectorAll('[data-testid="atlas-provisions-short"]')).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`
Expected: FAIL — overlay not rendered / prop unknown.

- [ ] **Step 3: Implement**

In `AtlasSvgView.tsx`:
1. Add to the props interface: `provisionShortCellIds?: number[];`
2. Destructure it in the component signature with a default: `provisionShortCellIds = []`.
3. In the SVG body (inside the zoom transform group, alongside the existing hovered-cell outline render), add an overlay layer. Use the existing `cellPolygonPoints(atlas, i)` helper that the hover outline already uses:

```tsx
{provisionShortCellIds.map((i) => (
  <polygon
    key={`prov-short-${i}`}
    data-testid="atlas-provisions-short"
    points={cellPolygonPoints(atlas, i)}
    fill="rgba(234,179,8,0.22)"
    stroke="#eab308"
    strokeWidth={0.5}
    pointerEvents="none"
  />
))}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`
Expected: PASS (all tests incl. the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/Worldforge/AtlasSvgView.tsx src/components/Worldforge/__tests__/AtlasSvgView.test.tsx
git commit -m "feat(atlas): provisions-short cell overlay prop"
```

---

## Task 7: MapPane — compute status, feed overlay + readout

**Files:**
- Modify: `src/components/MapPane.tsx`
- Test: `src/components/__tests__/MapPane.test.tsx`

**Context:** MapPane already builds a travel-route preview in travel mode and renders `AtlasSvgView`. It receives `mapData` (→ `inventory` is NOT on mapData; the party inventory + size must be passed in as props from `GameModals`/App). Add two props.

- [ ] **Step 1: Add props (no test yet)**

In MapPane's props interface add:
```ts
/** Shared party inventory — for the provisions readout/overlay (travel mode). */
provisionInventory?: import('@/types/items').Item[];
/** Number of party members consuming rations. */
partySize?: number;
```
Destructure with defaults: `provisionInventory = []`, `partySize = 0`.

- [ ] **Step 2: Compute the food range + short-cell ids**

Near the existing travel-route memo, add:
```ts
import { daysOfFood, foodRangeDays, tripDaysFromMinutes, provisionStatusForTrip } from '@/systems/travel/provisioning';
```
Then a memo that, when `interactionMode === 'travel'`, walks the reachable cells of the current travel field and marks those whose `tripDays > foodRangeDays(...)`:
```ts
const provisionShortCellIds = useMemo<number[]>(() => {
  if (interactionMode !== 'travel' || !worldforgeAtlas) return [];
  const days = daysOfFood(provisionInventory);
  const range = foodRangeDays(days, partySize, 'full');
  if (!Number.isFinite(range)) return [];
  const out: number[] = [];
  // travelField is the Dijkstra field already computed for the route preview.
  // For each atlas cell with a known minutes-cost, flag it if it is out of range.
  for (const [cellId, minutes] of travelFieldEntries()) {
    if (tripDaysFromMinutes(minutes) > range) out.push(cellId);
  }
  return out;
}, [interactionMode, worldforgeAtlas, provisionInventory, partySize, /* travel field dep */]);
```
Implement `travelFieldEntries()` against whatever structure the existing route-preview memo exposes (the Dijkstra `field` from `planRoutesFrom`/`buildAtlasTravelGraph`). If the field only exposes `to(goal)`, instead compute short-cell ids lazily for the hovered cell only (simpler v1): flag just the hovered cell when its route is out of range.

- [ ] **Step 3: Pass overlay + readout to AtlasSvgView**

- Pass `provisionShortCellIds={provisionShortCellIds}` to `<AtlasSvgView ... />`.
- In the hovered-cell travel readout (where `formatRouteSummary` is shown), also compute and render the provision line:
```ts
import { formatProvisionLine } from '@/systems/travel/travelReadout';
// when a route is hovered in travel mode:
const status = provisionStatusForTrip({
  tripDays: tripDaysFromMinutes(hoveredRoute.minutes),
  daysOfFood: daysOfFood(provisionInventory),
  consumers: partySize,
  mode: 'full',
});
const provLine = formatProvisionLine(status);
// render: <div style={{ color: provLine.color }} data-testid="travel-provision-line">{provLine.text}</div>
```

- [ ] **Step 4: Test the readout appears**

Add to `MapPane.test.tsx` a test that renders MapPane with `allowTravel`, a `partySize` of 4, an empty `provisionInventory`, and asserts that after hovering a far cell the `travel-provision-line` testid shows "short". (If hover simulation is impractical in jsdom, assert the simpler invariant: with `partySize=4` and no rations, `provisionShortCellIds` is non-empty by exposing it via a data attribute on the viewport for test visibility.)

Run: `npx vitest run src/components/__tests__/MapPane.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapPane.tsx src/components/__tests__/MapPane.test.tsx
git commit -m "feat(map): travel-mode provisions readout + short-cell overlay"
```

---

## Task 8: Wire party inventory + size into MapPane

**Files:**
- Modify: `src/components/layout/GameModals.tsx` (passes props to MapPane), `src/App.tsx` (provides them).

- [ ] **Step 1: Thread the props**

In `GameModals.tsx` where `<MapPane ... onTileClick={onTileClick} />` is rendered, add:
```tsx
provisionInventory={gameState.inventory}
partySize={gameState.party.length}
```
(Plumb `gameState.inventory` / `gameState.party` through GameModals props if not already present — follow how `onTileClick` is already threaded.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "MapPane|GameModals" || echo "clean"`
Expected: `clean` (no type errors in these files).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/GameModals.tsx src/App.tsx
git commit -m "feat(map): thread party inventory + size to MapPane"
```

---

## Task 9: `SET_PARTY_CONDITION` action + reducer (starvation)

**Files:**
- Modify: `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts` (+ its test).

- [ ] **Step 1: Add failing reducer test**

In `src/state/reducers/__tests__/characterReducer.test.ts`:
```ts
it('SET_PARTY_CONDITION adds a condition to every party member (no duplicates)', () => {
  const state = makeStateWithParty(2); // helper already used in this file
  const next = characterReducer(state, { type: 'SET_PARTY_CONDITION', payload: { condition: 'starving' } });
  for (const pc of next.party!) expect(pc.conditions).toContain('starving');
  const again = characterReducer({ ...state, party: next.party! }, { type: 'SET_PARTY_CONDITION', payload: { condition: 'starving' } });
  expect(again.party![0].conditions!.filter((c) => c === 'starving')).toHaveLength(1);
});
```
(If `makeStateWithParty` doesn't exist, build a minimal `party: [{ ...minimalPC, conditions: [] }]` inline.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/state/reducers/__tests__/characterReducer.test.ts`
Expected: FAIL — action type not handled.

- [ ] **Step 3: Implement**

In `actionTypes.ts`, add to the union:
```ts
| { type: 'SET_PARTY_CONDITION'; payload: { condition: string } }
| { type: 'CLEAR_PARTY_CONDITION'; payload: { condition: string } }
```
In `characterReducer.ts`, handle both:
```ts
case 'SET_PARTY_CONDITION': {
  const party = state.party.map((pc) =>
    pc.conditions?.includes(action.payload.condition)
      ? pc
      : { ...pc, conditions: [...(pc.conditions ?? []), action.payload.condition] },
  );
  return { party };
}
case 'CLEAR_PARTY_CONDITION': {
  const party = state.party.map((pc) => ({
    ...pc,
    conditions: (pc.conditions ?? []).filter((c) => c !== action.payload.condition),
  }));
  return { party };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/state/reducers/__tests__/characterReducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/actionTypes.ts src/state/reducers/characterReducer.ts src/state/reducers/__tests__/characterReducer.test.ts
git commit -m "feat(state): SET/CLEAR_PARTY_CONDITION for starvation"
```

---

## Task 10: Gate the travel move + food spend (in range)

**Files:**
- Modify: `src/App.tsx` (`handleTileClick`, around lines 628-713)
- Test: `src/App` reducer-level — if `handleTileClick` is not unit-testable in isolation, extract the provision decision into a pure helper and test that.

- [ ] **Step 1: Extract a pure decision helper (TDD)**

Create `src/systems/travel/travelProvisionDecision.ts`:
```ts
import { daysOfFood, provisionStatusForTrip, tripDaysFromMinutes, type RationMode } from './provisioning';
import type { Item } from '@/types/items';

export interface TravelProvisionDecision {
  status: ReturnType<typeof provisionStatusForTrip>;
  /** Rations to remove if the trip proceeds at this mode (capped at what's carried). */
  rationsToSpend: number;
}

export function decideTravelProvision(args: {
  inventory: Item[];
  partySize: number;
  routeMinutes: number;
  mode: RationMode;
}): TravelProvisionDecision {
  const days = daysOfFood(args.inventory);
  const tripDays = tripDaysFromMinutes(args.routeMinutes);
  const status = provisionStatusForTrip({ tripDays, daysOfFood: days, consumers: args.partySize, mode: args.mode });
  const need = args.mode === 'half' ? Math.ceil(args.partySize / 2) : args.partySize;
  const rationsToSpend = Math.min(days, need * Math.min(tripDays, status.foodRangeDays));
  return { status, rationsToSpend };
}
```
Test `src/systems/travel/__tests__/travelProvisionDecision.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { decideTravelProvision } from '../travelProvisionDecision';
import { RATIONS_ITEM_ID } from '../provisioning';
const ration = (q: number) => ({ id: RATIONS_ITEM_ID, name: 'R', description: '', type: 'food_drink', quantity: q }) as any;

it('spends full need for an in-range trip', () => {
  const d = decideTravelProvision({ inventory: [ration(20)], partySize: 4, routeMinutes: 2 * 24 * 60, mode: 'full' });
  expect(d.status.inRange).toBe(true);
  expect(d.rationsToSpend).toBe(8); // 4/day * 2 days
});
it('caps spend at the sustainable distance when short', () => {
  const d = decideTravelProvision({ inventory: [ration(4)], partySize: 4, routeMinutes: 5 * 24 * 60, mode: 'full' });
  expect(d.status.inRange).toBe(false);
  expect(d.rationsToSpend).toBe(4); // only 1 day sustainable * 4
});
```
Run: `npx vitest run src/systems/travel/__tests__/travelProvisionDecision.test.ts` → FAIL then PASS after creating the file.

- [ ] **Step 2: Use it in `handleTileClick` for the in-range path**

In `App.tsx handleTileClick`, before the existing discovered-move branches, compute:
```ts
const decision = decideTravelProvision({
  inventory: gameState.inventory,
  partySize: gameState.party.length,
  routeMinutes: (travelMeta?.seconds ?? 3600) / 60,
  mode: 'full',
});
```
When the move proceeds (the existing `MOVE_PLAYER` + `ADVANCE_TIME` block), also dispatch:
```ts
if (decision.rationsToSpend > 0) {
  dispatch({ type: 'REMOVE_ITEM', payload: { itemId: 'rations', count: decision.rationsToSpend } });
}
```
For an in-range trip this fully provisions the journey. (Short trips handled in Task 11.)

- [ ] **Step 3: Typecheck + run travel tests**

Run: `npx vitest run src/systems/travel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/systems/travel/travelProvisionDecision.ts src/systems/travel/__tests__/travelProvisionDecision.test.ts
git commit -m "feat(travel): spend rations on in-range world travel"
```

---

## Task 11: Underprovisioned choice flow (turn back / forage / half / push-on)

**Files:**
- Modify: `src/App.tsx` (`handleTileClick`), and a small modal component for the choice. Use the existing message/confirm UI pattern in the codebase (search `addMessage` callers and any existing confirm modal).

- [ ] **Step 1: Branch on `!decision.status.inRange`**

When the picked trip is short, do NOT move immediately. Instead surface a choice with these options (reuse the existing modal/confirm component — find it via `grep -rn "confirm\|ConfirmModal\|PromptModal" src/components | head`):
- **Turn back** → `addMessage('You decide not to set out underprovisioned.', 'system')`; return.
- **Half rations** → recompute `decideTravelProvision({ ..., mode: 'half' })`; if now in range, proceed as Task 10 but with `mode: 'half'` and dispatch `SET_PARTY_CONDITION { condition: 'fatigued' }`.
- **Forage** → proceed (push-on) but pre-roll a survival offset: extend `travelSeconds` by 25% and reduce shortfall by a fixed `forageDays = 1` (document the simple v1 rule inline). 
- **Push on** → proceed to Task 12 (partial-stop).

- [ ] **Step 2: Severity-colored confirm copy**

Use `decision.status.severity` to pick wording: `minor` → amber "You're a little short on food. Continue?"; `major` → red "You do not have nearly enough food. This could be deadly. Continue?".

- [ ] **Step 3: Manual verification (preview server)**

Use the `wf-town3d` preview server (port 5181): enter play, open the world map, Travel mode, hover a far cell → confirm the provisions line + amber/red overlay appear; click → confirm the choice flow opens. (jsdom can't exercise the full modal; this step is manual via preview_eval-driven clicks.)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components
git commit -m "feat(travel): underprovisioned choice flow"
```

---

## Task 12: Partial-stop + starvation on push-on

**Files:**
- Modify: `src/App.tsx` (`handleTileClick` push-on branch)

- [ ] **Step 1: Resolve the halt cell**

When the player pushes on underprovisioned, the party can only reach `foodRangeDays` worth of the route. Walk the route's `cells` array (from the `RoutePlan`) to the cell at the cumulative travel-time equal to `foodRangeDays` and treat THAT cell as the destination (not the clicked one). Move there, advance time by the partial duration, spend all carried rations (`REMOVE_ITEM { itemId: 'rations', count: daysOfFood(inventory) }`).

- [ ] **Step 2: Apply starvation**

Dispatch `SET_PARTY_CONDITION { condition: 'starving' }` and `addMessage('Your food runs out on the road. The party is starving and halts at <place>.', 'system')`.

- [ ] **Step 3: Manual verification**

Via preview server: push on with no rations → party stops short of the target, message + `starving` condition present (`window.__araliaState.party[0].conditions`).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(travel): partial-stop + starvation on underprovisioned push-on"
```

---

## Task 13: Companion loyalty hit + desertion

**Files:**
- Modify: `src/App.tsx` (the starvation branch from Task 12)

- [ ] **Step 1: Drain loyalty / approval while starving**

In the push-on/starvation branch, for each companion in `gameState.companions`, dispatch:
```ts
dispatch({ type: 'UPDATE_COMPANION_APPROVAL', payload: { companionId: c.id, change: -10, reason: 'Marched without food', source: 'starvation' } });
```
(Confirm `UPDATE_COMPANION_APPROVAL` is the loyalty/approval channel by reading its reducer; if loyalty is a separate field, use the matching action.)

- [ ] **Step 2: Desertion check**

After the approval update, read each companion's resulting loyalty; if below a threshold (e.g. `< 20`), `addMessage('<name> can bear no more — they abandon the party.', 'system')` and dispatch the existing "companion leaves" action (find via `grep -rn "LEAVE\|REMOVE_COMPANION\|companion.*leave" src/state`). If no such action exists, this sub-step is deferred — note it in the message only.

- [ ] **Step 3: Manual verification + commit**

Via preview server: confirm approval drops after a starving halt. Commit:
```bash
git add src/App.tsx
git commit -m "feat(travel): companion loyalty loss + desertion on starvation"
```

---

## Task 14: Full suite + cleanup

- [ ] **Step 1: Run the travel + map + state suites**

Run: `npx vitest run src/systems/travel src/components/__tests__/MapPane.test.tsx src/components/Worldforge/__tests__/AtlasSvgView.test.tsx src/state/reducers/__tests__/characterReducer.test.ts`
Expected: all PASS.

- [ ] **Step 2: Typecheck the touched files**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "provisioning|travelReadout|travelProvisionDecision|MapPane|AtlasSvgView|App.tsx|characterReducer" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Update memory**

Update `travel-provisioning-deferred.md`: mark v1 shipped; keep the deferred table.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(travel): provisions v1 verification + memory update"
```

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-06-25-travel-provisions.md","sha256WithoutMarker":"7b456d6bef8967d3a6ea5b8e4d09350819bef56ce38d6938d2ede96ad6b19d7e","markedAtUtc":"2026-06-25T23:16:33.015Z"} -->
