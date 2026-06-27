# Maritime Travel — Plan 3: Owned-ship naval bridge + open-water sailing

Status: in progress (2026-06-26). Owner: Remy. Executor: subagent-driven, same session.
Spec: `docs/superpowers/specs/2026-06-25-maritime-travel-design.md` (see "Iteration II").
Prereq: Plans 1–2 built; **Task 1 done** — `ensureIslandHarbors` now default-ON (DECISIONS.md D3),
142 maritime tests green, working tree (no commits — owner holds; 2am snapshot captures).

## Goal of Plan 3 (locked decisions 8–10, 2026-06-26)

Two-tier maritime travel. **Ferries** stay lightweight lane-bound for-hire crossings. **Owned
ships** become the deep option: route over *any* sea cell (open water), gated on the ship being
docked at the embark port, and "set sail" drives the existing **naval voyage sim**
(`NAVAL_START_VOYAGE` → day-by-day weather/supplies/crew). Bridge — do **not** duplicate — the
dormant naval system: the owned-ship transport IS the player's naval `Ship`; populate
`naval.knownPorts` from FMG burg ports; a completed voyage re-docks the ship at the arrival port.

Honor `remy-no-fallback-directive`: today `kind:'ship'` collapses to `kind:'ferry'` (both lane-only
via `isFerryWater`). That is the degraded path this plan removes — one real open-water path.

### Reality notes (verified on disk 2026-06-26)
- `ownedShips` exists **only in the spec prose** — never coded. "Drop the array" = don't build it.
- `Ship`/`NavalState` have **no current/docked-port field**. Bridging requires adding one.
- `NAVAL_START_VOYAGE` payload = `{ destinationId, distance }`, operates on `naval.activeShipId`.
- `SeaPreference = 'none' | 'ferry'` in MapPane; `travelMmField` hardcodes `sea:{kind:'ferry',speedMph:8}`.
- Graph danger field already tiers land; sea is a flat `FERRY_LANE_DANGER` (0.12).

---

## Subtask 3A — Open-water ship passability + sea danger tiers (PURE GRAPH) ← FIRST

File: `src/systems/worldforge/travel/multiModalAtlasGraph.ts` (+ its test). No naval/UI coupling.

Today (lane-only collapse): `canEnter` admits a water cell only if `opts.sea && isFerryWater(cell)`,
and `neighbors` crosses land↔sea only at `isPortTransfer`. `kind:'ship'` == `kind:'ferry'`.

Change so that **when `opts.sea.kind === 'ship'`**:
- **Passability:** a ship may enter ANY sea cell (`!isLand(cell)`), not just ferry lanes.
  Embarkation/disembarkation across the land↔sea boundary still happens ONLY through
  `isPortTransfer` pairs (you board/leave at a port). Sea↔sea is free anywhere.
- **Danger tiers (lane < coastal < open ocean):** classify each sea cell —
  - `lane`  = in `ferryLaneCells` → keep `FERRY_LANE_DANGER` (0.12)
  - `coastal` = sea cell with ≥1 land neighbor (via `cells.c`), not a lane → mid (~0.3)
  - `open`  = sea cell, no land neighbor, not a lane → high (~0.5)
  Constants named (`SEA_DANGER_LANE/COASTAL/OPEN`). Ferries are unaffected (still lane-only, 0.12).
- **Cost:** `edgeMinutes` already uses `opts.sea.speedMph` for sea legs — unchanged; open water
  is naturally costlier by distance. (Optional: a small open-ocean time multiplier — only if it
  reads cleanly; do NOT invent a fudge factor.)

Ferry behavior (`kind:'ferry'`) must be **byte-for-byte unchanged** — guard every new branch on
`opts.sea.kind === 'ship'`.

TDD (write tests first):
1. ferry trip across a non-lane sea gap → no route (lanes still bind ferries). [regression guard]
2. ship trip across the same non-lane open water → route exists, embarks/disembarks at ports only.
3. ship cannot step land→sea except at a port transfer (interior coast with no port = no embark).
4. danger tiers: a known lane cell < a coastal cell < an open-ocean cell for `kind:'ship'`.
5. ferry danger for the same cells is unchanged (still flat lane danger / lane-bound).

Acceptance: all existing multiModal/travel tests stay green; ship≠ferry is now real.

---

## Subtask 3B — Naval bridge state (knownPorts ← FMG ports; ship docked-port) — DESIGN

Pure state/helpers, testable, no UI. Resolve these forks before dispatch:
- **Where the docked port lives.** Add `dockedPortBurgId?: number` (FMG burg id) to `Ship`
  (additive optional on a CRITICAL CORE type — low risk) vs a parallel map in `NavalState`.
  Lean: on `Ship` (one ship = one dock; survives `playerShips` map updates).
- **`knownPorts` shape.** Currently `string[]` (dead). Populate from FMG burgs where `burg.port`
  truthy. Decide port identity: burg id as string vs a `{burgId,name,cell}` — `knownPorts` typed
  `string[]` today; either widen the type or store ids-as-strings. Lean: store burg ids.
- Helper `voyageDistanceFromRoute(route)` → sea-miles of the open-water leg (feeds
  `NAVAL_START_VOYAGE.distance`). Pure; unit-tested against a segmented route.
- Helper to set/refresh `knownPorts` from an atlas/pack (called when a world loads).

## Subtask 3C — "Set sail" voyage UX — HEAVY (decomposed)

**Fork RESOLVED (Remy, 2026-06-26):** (1) **Inline day-by-day** — set sail advances game time one
sea-day at a time via the naval sim. (2) **Reuse & wire ShipPane** as the voyage surface. (3)
**Advance the world daily loop each sea-day.** (3D/leaf helm stays OUT — world-map abstraction.)

### Recon facts (verified on disk 2026-06-26)
- `ShipPane` (`src/components/Naval/ShipPane.tsx`) props `{ ship, onClose }`; tabs overview/crew/cargo;
  renders NO voyage state; NO start/advance control. Mounted in `GameModals.tsx` (`isNavalDashboardVisible`)
  which HAS game state + dispatch. 4 existing tests must stay green.
- `MapPane` is **pure presentation** — no dispatch/naval state; commits a trip via
  `onTileClick(tx,ty,tile,travelMeta)` (→ `handleMovement.ts` dispatches `MOVE_PLAYER` + `ADVANCE_TIME`).
  `seaPref` state exists (`'none'|'ferry'`). 3 tests must stay green.
- `ADVANCE_TIME {seconds}` → `worldReducer` daily loop (Steps 1–6); one dispatch can span multiple days.
- Ship speed: `stats.speed/10` = mph (Sloop 60→6mph→144 mi/day). `VoyageManager.advanceDay` = per-day math.
- Arrival relocation: burgId → grid tile via `getTownTilesForGrid(seed,cols,rows).filter(t=>t.burgId===id)`,
  then `MOVE_PLAYER`. `NAVAL_SET_KNOWN_PORTS` action exists (3B) but is never dispatched yet.
- Architecture decision: keep MapPane pure — add an `onSetSail(destBurgId, seaMiles)` callback prop +
  pass `activeShip`/embark-gate as props from the parent (mirrors `onTileClick`). NOT a context refactor.

### 3C-1 — ShipPane voyage surface (isolated; no map coupling) ← FIRST
Extend ShipPane to render `state.naval.currentVoyage` when active (status, daysAtSea, distance
travelled/remaining, weather, log) and add an **"Advance a day"** control that ticks ONE sea-day:
dispatch `NAVAL_ADVANCE_VOYAGE` AND `ADVANCE_TIME` for that day's seconds (so the world moves each
sea-day, decision #3). Disable/hide once `status==='Docked'`. Wire dispatch from GameModals (it has the
store). Keep the 4 ShipPane tests green; add voyage-display + advance-day tests.

### 3C-2 — knownPorts population effect (small)
When the atlas loads, dispatch `NAVAL_SET_KNOWN_PORTS(knownPortsFromPack(pack))` from the parent that
has both atlas + dispatch. Idempotent. Test the effect fires with the right ports.

### 3C-3 — Map embark + start voyage (the architectural piece)
`SeaPreference` gains `'ship'`, enabled only when the active ship is docked at the player's current
port (embark gate; parent passes `activeShip` + `embarkPortBurgId`). Build the graph with
`sea:{kind:'ship',speedMph: activeShip.stats.speed/10}`. Committing a ship destination calls a NEW
`onSetSail(destBurgId, route.seaMiles)` callback (NOT instant `onTileClick`) → parent dispatches
`NAVAL_START_VOYAGE {destinationId:String(destBurgId), distance:route.seaMiles}` and opens ShipPane.

### 3C-4 — Voyage arrival relocates the player (couples to completion)
When the voyage reaches `Docked`, map `currentVoyage.destinationId` (burg id) → grid tile and dispatch
`MOVE_PLAYER` so the player ends at the arrival port. (Ship dock already set by 3B.) Then clear the voyage.

## Subtask 3D — Sea-danger encounter roll on sea segments (immersion; Plan 6 seed)

Remy chose "most immersive" = **cost + encounter rolls**. Add a `seaDanger`-driven encounter roll
that fires when a trip executes a sea segment, using 3A's per-cell danger tiers (open ocean rolls
hotter). Non-tactical roll in v1 (Plan 6 makes piracy/weather playable). Scope after 3C lands.

---

## Constraints (owner directives — override default workflow)
- No commits, no branches. Work stays in the master working tree (2am snapshot captures it).
- No fallback/graceful-degradation layers — one real path, fail honestly.
- Visual-inspection rule: before declaring Plan 3 done, render a headless mainland→island trip
  showing a **ferry** route and an **owned-ship open-water** route, and eyeball the segmented line.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-06-26-maritime-travel-plan3-naval-bridge.md","sha256WithoutMarker":"c03b68d756bef5c2bb0b59090a88086eab6eb1f1c351b95172cce46f6b087d98","markedAtUtc":"2026-06-26T13:41:46.767Z"} -->
