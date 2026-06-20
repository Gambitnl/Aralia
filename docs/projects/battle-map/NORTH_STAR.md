---
schema_version: 1
project: Battle Map
slug: battle-map
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-20
iteration: 8
confidence: medium
evidence: docs/projects/battle-map
gap_signal: "2 open gaps; G5 and CMA-G15 remain open after G6 tactical spawn scoring landed (2026-06-19) and D17 utility-contract documentation (2026-06-20)"
protocol: living project doc set
next_step: "D17 utility contract documented in NORTH_STAR.md ('D17 Utility Contract: `generateBattleSetup`'); G6 tactical spawn scoring implemented 2026-06-19. Next bounded slices are G5 VFX renderer-boundary proof and CMA-G15 actor/terrain render-parity proof (both routed from `docs/projects/code-modularization-audit/GAPS.md`); parity overlay follow-up stays gated by `PARITY_CHECKLIST.md`."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - PARITY_CHECKLIST.md
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-10
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Battle Map North Star

Status: active (D17 utility contract documented 2026-06-20; G6 tactical spawn scoring implemented 2026-06-19; awaiting routed CMA slices G5 and CMA-G15)
Last updated: 2026-06-20

## Why This Project Exists

Battle Map is the tactical grid layer used by combat, with both 2D and 3D renderers sharing the same interaction contract. This project doc preserves current implementation shape, integrations, and known gaps so new agents can continue without losing scope.

## Intended Outcome

Maintain a cold-start handoff for Battle Map by documenting:
- implemented components, hooks, services, and data model,
- integration boundaries into combat orchestration,
- concrete gaps that must not be dropped during future slices.

## Dashboard Card Schema

Project: Battle Map
Slug: battle-map
Category: Feature/UI Projects
Status: active (D17 utility contract documented 2026-06-20; G6 tactical spawn scoring implemented 2026-06-19)
Confidence: medium
Evidence: docs/projects/battle-map
Gap signal: 2 open gaps (G5 VFX renderer-boundary proof, CMA-G15 actor/terrain render-parity proof); G6 done 2026-06-19; G3 decided 2026-06-10 (D17, keep-as-is)
Protocol: living project doc set
Next step: D17 utility contract documented in NORTH_STAR.md ('D17 Utility Contract: `generateBattleSetup`'); G6 tactical spawn scoring implemented 2026-06-19. Next bounded slices are G5 VFX renderer-boundary proof and CMA-G15 actor/terrain render-parity proof (both routed from `docs/projects/code-modularization-audit/GAPS.md`); parity overlay follow-up stays gated by `PARITY_CHECKLIST.md`.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-19
Workflow gaps reviewed: 2026-06-20

## Required Review Brief

Title: Battle Map generation helper naming
Question: Should `src/hooks/useBattleMapGeneration.ts` be renamed to match its stateless utility role, or should the hook-shaped filename remain for caller stability?
Issue: The module exports a plain setup helper, but its filename still implies a hook. Current docs preserve that drift to avoid a risky caller sweep.
Current behavior: `CombatView` and other Battle Map callers import `generateBattleSetup` from `src/hooks/useBattleMapGeneration.ts`; the module is stateless and the parity checklist is already the gate for renderer changes.
Why blocked: Renaming without a coordinated caller sweep would churn stable imports and could obscure whether the contract was intentionally preserved.
Option A: Rename the file and update every caller, test, and doc in one coordinated sweep.
Option B: Keep the current filename, document the utility contract, and revisit the rename only when caller churn is already planned.
Evidence: `src/hooks/useBattleMapGeneration.ts`, `src/components/Combat/CombatView.tsx`, `src/components/BattleMap/BattleMapDemo.tsx`, `docs/projects/battle-map/GAPS.md`, `docs/projects/battle-map/PARITY_CHECKLIST.md`
Decision owner: Battle Map product owner or the person responsible for module naming and caller stability.
Proof after decision: Focused caller sweep, test update, and docs refresh that match the chosen name; re-run the Battle Map focused tests if code moves.

### Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D17 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Option B Ã¢â‚¬â€ keep the `useBattleMapGeneration.ts` filename.** No rename, no caller sweep.
- Document the stateless utility contract (the module exports a plain setup helper,
  `generateBattleSetup`, despite the hook-shaped filename) Ã¢â‚¬â€ this North Star and the gap
  registry are that documentation.
- Revisit the rename only when caller churn is already planned for other reasons.

Status: decision recorded 2026-06-10; the G3 review gate is cleared and no code movement
is required for this gap.

## D17 Utility Contract: `generateBattleSetup`

This section is the durable contract for the stateless setup helper exported from
`src/hooks/useBattleMapGeneration.ts`. Callers (`CombatView`, `BattleMapDemo`) rely on
the shape below; any change must preserve these guarantees or record a breaking
migration in `TRACKER.md` and `AUDIT_OR_PROOF.md`.

### Exported signature

```ts
export const generateBattleSetup = (
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
    initialCharacters: CombatCharacter[],
    presetMapData?: BattleMapData
): { mapData: BattleMapData, positionedCharacters: CombatCharacter[] }
```

One public export. No side effects, no module state, no React hook usage. The
hook-shaped filename is preserved for caller stability per D17.

### Inputs

| Parameter | Role |
|---|---|
| `biome` | Terrain flavor and obstacle palette. One of `forest`, `cave`, `dungeon`, `desert`, `swamp`. Biome does not affect spawn-zone shape — only terrain/decoration tables inside `BattleMapGenerator`. |
| `seed` | Single integer seed feeding `SeededRandom`. Same `(biome, seed, initialCharacters, presetMapData)` tuple must always produce the same output. |
| `initialCharacters` | Roster with `team: 'player' | 'enemy'` and `id`. `playerCount`/`enemyCount` are derived from this list; no extra roster metadata is consulted. |
| `presetMapData` | Optional pre-extracted ground map. When present, the generator is skipped and players are placed near `(20, 15)`, enemies near `(24, 18)` via `findNearestWalkableTile`. |

### Outputs

- `mapData: BattleMapData` — either freshly generated (`BattleMapGenerator.generate(biome, seed)` over `BATTLE_MAP_DIMENSIONS`) or the caller-supplied `presetMapData`. The helper never mutates `presetMapData` in place beyond the spawn-position assignment loop that also touches `positionedCharacters`.
- `positionedCharacters: CombatCharacter[]` — shallow copies of `initialCharacters` with `position` set when a legal tile is claimed; unchanged roster entries are returned as-is when no tile is available (never `undefined`).

### Procedural vs preset paths

| Path | Spawn config | Placement strategy |
|---|---|---|
| Procedural (`presetMapData` absent) | Seeded-random choice among `left-right`, `top-bottom`, `corners-tl-br`, `corners-tr-bl` | `getTacticalSpawnTiles` → `spreadTiles` with `MIN_SEP=2` first pass, same-zone fallback second pass, nearest-walkable-map-wide fallback third pass |
| Preset (`presetMapData` supplied) | N/A (ground-mode handoff) | `findNearestWalkableTile` around team anchors `(20, 15)` (player) and `(24, 18)` (enemy), occupied-set dedupe |

### Determinism guarantee

For identical `(biome, seed, initialCharacters, presetMapData)` inputs, the helper
returns byte-equivalent output. Randomness is consumed in a fixed order:

1. One `SeededRandom(seed)` instance constructed up front.
2. One `rng.next()` call to pick the procedural `SpawnConfig` (procedural path only).
3. One seeded shuffle of each team's zone tile list (inside `spreadTiles` / `getTacticalSpawnTiles`).
4. One seeded shuffle of the map-wide fallback list (inside `nearestFallbackTiles`).

Any future helper that needs randomness MUST draw from the same `rng` instance in a
documented order; introducing a second RNG, a `Math.random()` call, or a re-ordering
of draws breaks the determinism contract.

### Spawn zone rectangles

`spawnRectsForConfig(width, height, config)` keeps the legacy deployment shapes:

| Config | Player rect | Enemy rect |
|---|---|---|
| `left-right` | `x∈[0, floor(0.25·width))`, full height | `x∈[width−floor(0.25·width), width)`, full height |
| `top-bottom` | full width, `y∈[0, floor(0.25·height))` | full width, `y∈[height−floor(0.25·height), height)` |
| `corners-tl-br` | `cornerSize×cornerSize` at top-left | `cornerSize×cornerSize` at bottom-right |
| `corners-tr-bl` | `cornerSize×cornerSize` at top-right | `cornerSize×cornerSize` at bottom-left |

`cornerSize = floor(min(width, height) * 0.35)`. Rects are clamped to map bounds
inside `walkableTilesInRect` so fixtures with non-standard dimensions stay safe.

### Tactical scoring invariants (G6)

`getTacticalSpawnTiles` ranks each walkable candidate with
`tacticalSpawnScore = coverScore + elevation·2 + chokepointScore + enemyDistanceScore`.
Weights are integers by design; the spread pass stable-sorts best-first AFTER the
seeded shuffle so equal scores tie-break deterministically.

| Component | Source | Range (current weights) |
|---|---|---|
| `coverScore` | 8-neighbors that `blocksMovement`, `blocksLoS`, or `providesCover` | `0` (open), `+4..+5` (1-3 cover neighbors, bonus if tile itself provides cover), `+1` (4-5 neighbors), `−4` (≥6 neighbors, wedged pocket) |
| `elevation` | `tile.elevation` (0-3 typical) | `0..6` |
| `chokepointScore` | Cardinal walkable exits | `−3` (≤1 exit, dead end), `+2` (2 exits), `+1` (3 exits), `0` (4 exits) |
| `enemyDistanceScore` | Euclidean distance to closest enemy anchor | `−8` (<5), `+1` (5-8), `+5` (8-18), `+2` (18-26), `−2` (>26) |

Anchor for the enemy-distance term is the enemy zone center when the enemy team has
not yet been placed, and actual placed enemy tiles once placement begins. Player
placement runs first against the enemy anchor; enemy placement runs second with the
player tiles already in the occupied set.

### MIN_SEP formation rule

`MIN_SEP = 2` (Chebyshev). `hasNearbyFriendly` rejects any candidate within
`MIN_SEP` of an already-claimed teammate during the first pass. When the preferred
zone cannot supply `count` separated tiles, the same-zone fallback (second pass) and
the map-wide nearest-walkable fallback (third pass) drop the MIN_SEP requirement so
roster coverage is preserved on dense maps.

### Exhaustion fallback

`nearestFallbackTiles` sorts all unclaimed walkable tiles on the map by
`(distance to zone center, −tactical score)` and hands them out in order. This
guarantees every character receives a defined tile on any map that has at least
`playerCount + enemyCount` walkable tiles total. If a caller supplies a map with
fewer walkable tiles than characters, remaining roster entries are returned
unchanged — never with a fabricated position.

### Budget

`AUDIT_OR_PROOF.md` records a ≤50 ms wall-clock budget for a default 40×30 forest
setup on reference hardware. Any change to scoring, fallback, or zone geometry must
re-run the budget test in `src/hooks/__tests__/useBattleMapGeneration.test.ts`.

### Contract boundaries (not covered)

The helper does NOT own and must NOT be extended to cover:

- Renderer behavior, overlay rendering, or VFX (see `PARITY_CHECKLIST.md`).
- Line-of-sight, targeting, or movement — those live in `src/utils/spatial/lineOfSight.ts` and `src/hooks/combat/useGridMovement.ts`.
- Encounter content, difficulty, or AI (`docs/projects/encounter-generator`).
- Save/load persistence of `mapData` (open question in this North Star).
- Ground-mode pathfinding around the `(20, 15)` / `(24, 18)` anchors — preset placement is a nearest-walkable search, not a navmesh walk.

Callers needing behavior from any of those lanes must add it outside this helper.

## Current State

- Registry anchor is in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) under Feature/UI Projects with gap signal `GAPS.md present`, status `active`, confidence `medium`. The project-local next step is awaiting the routed CMA slices (G5, CMA-G15) and the parity overlay follow-up.
- The active combat host is `src/components/Combat/CombatView.tsx`. It owns map-mode selection and orchestrates:
  - `useTurnManager`,
  - `useAbilitySystem`,
  - `useBattleMap` data flow,
  - and the choice between `BattleMap` and `BattleMap3D`.
- CombatView also owns and mutates the current battle map model (`mapData`) and pushes map updates into the combat hooks.
- Map rendering surface:
  - 2D: `src/components/BattleMap/BattleMap.tsx`.
  - 3D: `src/components/BattleMap/BattleMap3D.tsx`.
- Core orchestration and gameplay support:
  - `src/hooks/useBattleMap.ts`,
  - `src/hooks/useAbilitySystem.ts`,
  - `src/hooks/combat/useGridMovement.ts`,
  - `src/hooks/combat/useTargetSelection.ts`,
  - `src/hooks/combat/useTargetValidator.ts`,
  - `src/hooks/combat/useTargeting.ts`,
  - `src/services/battleMapGenerator.ts`,
  - `src/hooks/useBattleMapGeneration.ts`.
- `useBattleMapGeneration.ts` stays hook-shaped in filename for caller stability, but the exported setup helper is intentionally stateless. Decided 2026-06-10 (D17, Option B): keep the filename; the full utility contract is now documented in the "D17 Utility Contract: `generateBattleSetup`" section of this file.
- T3 decision: G2 connectivity and G3 naming drift do not belong in the same implementation slice. G2 stays the runtime/pathability proof slice; G3 is closed with the D17 decision recorded.
- G2 runtime proof: `ensureConnectivity()` now carves deterministic corridors for cave/dungeon maps when generation splits walkable regions, and the focused seed-2 regression keeps that guarantee visible.
- G6 tactical spawn scoring (2026-06-19): `getTacticalSpawnTiles` ranks candidates by cover/elevation/chokepoint/enemy-distance with `MIN_SEP=2` spread, same-zone fallback, and map-wide nearest-walkable fallback; the budget test in `src/hooks/__tests__/useBattleMapGeneration.test.ts` keeps the 40x30 setup under 50 ms. The full scoring contract is recorded in the D17 Utility Contract section above.
- Parity proof: `docs/projects/battle-map/PARITY_CHECKLIST.md` now records the 2D/3D state-update, overlay, and highlighting contract, with focused renderer tests backing the proof.
- Types and shared utilities:
  - `src/types/combat.ts`,
  - `src/utils/pathfinding.ts`,
  - `src/utils/movementUtils.ts`,
  - `src/utils/spatial/lineOfSight.ts`.
- Verified doc support in `docs/architecture/COMBAT_MAP_ENGINE.md` and `docs/architecture/domains/battle-map.md`.
- Nearby implementation siblings in BattleMap include `CharacterToken`, `BattleMapTile`, `BattleMapOverlay`, `AbilityPalette`, `InitiativeTracker`, `ActionEconomyBar`, `CombatLog`, `PartyDisplay`, `DamageNumberOverlay`, `AISpellInputModal`, and `CombatCharacterInspector`.

## Active Task

| Field | Value |
|---|---|
| Task | D17 utility-contract documentation slice — make the `generateBattleSetup` contract specific enough for a later implementation agent to rely on without inventing scope |
| Acceptance criteria | D17 utility contract is recorded in NORTH_STAR.md with signature, determinism guarantee, scoring invariants, MIN_SEP rule, fallback behavior, and explicit contract boundaries; parity checklist remains the renderer-change gate; routed CMA slices (G5, CMA-G15) stay tracked in `GAPS.md` |
| Allowed boundaries | `docs/projects/battle-map/` (no source or test changes this slice) |
| Stop condition | Do not rename `useBattleMapGeneration.ts`, do not expand renderer behavior, and do not add scoring or spawn features — the slice is documentation only |
| Verification | Docs consistency sweep across Battle Map handoff files; `git diff --check`; no Battle Map runtime tests required because no code moves |
| Owner | Battle Map documentation worker |
| Next action | D17 utility contract documented 2026-06-20; G6 implemented 2026-06-19. Await an implementation agent accepting G5 VFX renderer-boundary proof or CMA-G15 actor/terrain render-parity proof (both routed from `docs/projects/code-modularization-audit/GAPS.md`); parity overlay follow-up stays gated by `PARITY_CHECKLIST.md` |

## Scope Boundaries

In scope:
- Update and keep current only:
  - `docs/projects/battle-map/NORTH_STAR.md`
  - `docs/projects/battle-map/TRACKER.md`
  - `docs/projects/battle-map/GAPS.md`
- Evidence linkage to runtime and architecture docs for recovery.

Adjacent but not in scope:
- Runtime changes in generation, combat, movement, targeting, tests, or renderer internals.
- Owning cross-project issues not tied to Battle Map parity and map state continuity.

Out of scope:
- Editing [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md).
- Global planning docs not tied to Battle Map continuity.

## What Must Not Be Lost

- 2D/3D parity is a contract; both renderers share the same movement, targeting, and turn/economy data.
- `CombatView` is the live host and should remain the coordinator over renderer internals.
- Combat rules stay in hooks/utilities, not in renderer-only components.
- Map terrain/state (`mapData`) is a shared read model for both renderers, not a renderer-owned mutable state.
- `combatEvents` remains a rule/event bus for combat side effects; map-state change propagation uses `onMapUpdate` callbacks.
- The generator naming drift (`useBattleMapGeneration.ts` as utility) currently exists and should be preserved in docs until the review decision resolves it. (Resolved 2026-06-10, D17: keep the filename; the documented stateless utility contract is the durable record.)
- The parity checklist is the gating proof for future movement, targeting, overlay, and highlight changes.
- Registry gap signal about map state/events sync must stay visible across handoffs.

## Known Gaps And Follow-Ups

| Gap | Status | Classification | Owner | Evidence | Next action | Next proof |
|---|---|---|---|---|---|---|
| Define map state/events sync spec | done | Battle Map owner | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts` | Contract stored below; re-check when map persistence or event schema changes |
| Ensure cave/dungeon map connectivity guarantee is explicit | done | Battle Map owner | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts` | Deterministic corridor repair is now implemented; keep the regression in place and re-run if generator terrain logic changes |
| Confirm parity checks for 2D and 3D map overlays before adding new visual rules | adjacent_follow_up | Battle Map owner | `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/hooks/useBattleMap.ts` | Add a short parity acceptance checklist |
| Resolve naming drift for `useBattleMapGeneration.ts` if/when moving hook-level refactors | done | Battle Map owner | `src/hooks/useBattleMapGeneration.ts`, `docs/architecture/COMBAT_MAP_ENGINE.md`, `docs/architecture/domains/battle-map.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D17 | Naming choice decided 2026-06-10 (D17, Option B): keep the filename and the documented stateless utility contract | No rename or caller sweep; revisit only when caller churn is already planned | Decision recorded 2026-06-10 (keep-as-is); utility contract documented in this North Star under "D17 Utility Contract: `generateBattleSetup`" |
| Create and run a parity checklist for 2D and 3D map overlays before adding new visual rules | done | Battle Map owner | `docs/projects/battle-map/PARITY_CHECKLIST.md`, `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`, `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx` | Checklist and focused tests now gate the next renderer-change slice; re-run if movement/overlay/highlight behavior changes |

## Global Gap Imports

Check the global gap tracker before expanding scope:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| no | no | none | No global gaps were explicitly imported for this pass |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Registry row + gap signal | Project ownership and unresolved contract direction | `docs/projects/PROJECT_TRACKER.md` |
| Live runtime host | 2D/3D map is rendered through CombatView with turn/economy hooks | `src/components/Combat/CombatView.tsx` |
| Map data write channels | Map terrain/state updates route through `setMapData` callbacks from Turn Manager and Ability System | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts` |
| Shared map interaction contract | Selection, move, path, click routing, action mode handling | `src/hooks/useBattleMap.ts` |
| Combat targeting + LOS contracts | Target/area computation and line-of-sight checks are shared utilities | `src/hooks/combat/useTargetSelection.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/utils/spatial/lineOfSight.ts` |
| Generator and setup helper | Deterministic terrain generation, spawn/setup logic, and corridor repair when cave/dungeon maps split into islands | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts`, `src/hooks/useBattleMapGeneration.ts` |
| Parity checklist and focused renderer tests | State updates, overlays, and highlighting now have a durable 2D/3D proof gate | `docs/projects/battle-map/PARITY_CHECKLIST.md`, `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`, `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx`, `src/components/BattleMap/__tests__/BattleMap.visibility.test.tsx`, `src/components/BattleMap/__tests__/BattleMap3D.visibility.test.tsx` |
| UI and renderer subtrees | Current production feature breadth and renderer split | `src/components/BattleMap/*` plus `src/components/BattleMap/terrain/*`, `camera/*`, `characters/*`, `vfx/*` |
| Test visibility points | Current verified test touchpoints for map UI, setup, connectivity repair, and parity proof | `src/components/BattleMap/__tests__/AbilityButton.test.tsx`, `src/components/BattleMap/__tests__/ActionEconomyBar.test.tsx`, `src/components/BattleMap/__tests__/BattleMapTile.test.tsx`, `src/hooks/__tests__/useBattleMapGeneration.test.ts`, `src/hooks/combat/__tests__/useGridMovement.test.ts`, `src/hooks/combat/__tests__/useTargetSelection.test.ts`, `src/services/__tests__/battleMapGenerator.test.ts` |
| Architecture context | Prior drift corrections and system boundaries | `docs/architecture/domains/battle-map.md`, `docs/architecture/COMBAT_MAP_ENGINE.md`, `src/components/BattleMap/BattleMap.README.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor and gap signal | active |
| `docs/projects/GLOBAL_GAPS.md` | Repo-level routing for non-local gaps | active |
| `docs/projects/battle-map/TRACKER.md` | Active bounded tasks and status | active |
| `docs/projects/battle-map/GAPS.md` | Durable unresolved findings | active |
| `docs/projects/battle-map/PARITY_CHECKLIST.md` | Renderer parity proof gate for state updates, overlays, and highlights | active |
| `docs/architecture/COMBAT_MAP_ENGINE.md` | Cross-subsystem map of combat map engine | active |

## Artifact Boundary

Keep durable evidence here (scope, contracts, status, and follow-up decisions). Keep local run logs, raw tool output, temporary screenshots, and one-off tests outside unless a concise summary is needed for future decisions.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Is map mode state part of combat state persistence, or UI-only state in CombatView? | Affects save/load and replay consistency across renderers | Battle Map + Combat owners | resolve |
| What minimal map event schema should be shared with any future combat timeline/logging tools? | Prevents duplicate validation logic and missed sync points | Battle Map owner | any integration pass |

## Map-State / Event Sync Contract

- Map topology/state source-of-truth: `CombatView` owns `mapData` (`useState`) and passes it read-only to both `BattleMap` and `BattleMap3D`.
- Write channels:
  - `useTurnManager` via `onMapUpdate`, currently for round-based environmental tile updates in `useCombatEngine.updateRoundBasedEffects`.
  - `useAbilitySystem` via `onMapUpdate`, when command execution returns a changed `finalState.mapData` (terrain-command and other map-mutating command outputs).
- Ownership boundaries:
  - UI mode (`renderMode`) and interaction affordances are owned by UI/components and `useBattleMap`.
  - Movement/target/path overlays are derived state from shared hooks and are parity-consumed by both renderers.
  - Rule-side combat events (`unit_move`, `unit_attack`, etc.) go through `combatEvents` and are not map-state write channels.
- Persistence note:
  - Current storage/persistence of `mapData` in encounter-wide save/load is not implemented in this doc slice; it remains a follow-up decision for later if replay or deterministic restore is required.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/battle-map/TRACKER.md`.
3. Read `docs/projects/battle-map/GAPS.md`.
4. Confirm registry and global links in `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.
5. Read the "D17 Utility Contract: `generateBattleSetup`" section before touching any spawn, scoring, or map-setup code — that section is the durable contract and any change must preserve its listed invariants.
6. Continue from the next open gap in `GAPS.md`: G5 VFX renderer-boundary proof and CMA-G15 actor/terrain render-parity proof, both routed from `docs/projects/code-modularization-audit/GAPS.md`. The parity checklist (`PARITY_CHECKLIST.md`) remains the gate for any renderer-behavior expansion. (G3 is decided 2026-06-10 (D17, keep-as-is); G6 is implemented 2026-06-19; neither needs further work unless their invariants change.)



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass — G5 VFX renderer-boundary proof and CMA-G15 actor/terrain render-parity proof are the currently open, routed candidates
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
