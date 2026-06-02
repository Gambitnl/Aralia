# Battle Map North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Battle Map is the tactical grid layer used by combat, with both 2D and 3D renderers sharing the same interaction contract. This project doc preserves current implementation shape, integrations, and known gaps so new agents can continue without losing scope.

## Intended Outcome

Maintain a cold-start handoff for Battle Map by documenting:
- implemented components, hooks, services, and data model,
- integration boundaries into combat orchestration,
- concrete gaps that must not be dropped during future slices.

## Current State

- Registry anchor is in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) under Feature/UI Projects with gap signal `GAPS.md present` and the specific follow-up `Define map state/events sync spec`.
- The active combat host is `src/components/Combat/CombatView.tsx`. It owns mode selection and orchestrates:
  - `useTurnManager`,
  - `useAbilitySystem`,
  - `useBattleMap` data flow,
  - and the choice between `BattleMap` and `BattleMap3D`.
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
| Task | Convert Battle Map folder to an implementation-accurate living-project checkpoint for cold-start continuity |
| Acceptance criteria | NORTH_STAR.md, TRACKER.md, and GAPS.md explain what is implemented, what owns map logic, how renderers connect, and next verified checks |
| Allowed boundaries | `docs/projects/battle-map/` only |
| Stop condition | No runtime edits; no new file types introduced beyond the three required docs |
| Verification | Re-read registry row, evidence files listed below, and internal task/gap rows for consistency |
| Owner | Battle Map documentation worker |
| Next action | Address tracker row T2 by confirming sync contract scope before behavior changes |

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
- The generator naming drift (`useBattleMapGeneration.ts` as utility) currently exists and should be preserved in docs until code/work ownership changes it.
- Registry gap signal about map state/events sync must stay visible across handoffs.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Define map state/events sync spec | adjacent_follow_up | Battle Map owner | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Draft and store event/state contract when map or combat orchestration changes |
| Ensure cave/dungeon map connectivity guarantee is explicit | in_scope_now | Battle Map owner | `src/services/battleMapGenerator.ts` | Verify `ensureConnectivity` behavior and add regression checks if disconnected movement zones appear |
| Confirm parity checks for 2D and 3D map overlays before adding new visual rules | adjacent_follow_up | Battle Map owner | `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/hooks/useBattleMap.ts` | Add a short parity acceptance checklist |
| Resolve naming drift for `useBattleMapGeneration.ts` if/when moving hook-level refactors | adjacent_follow_up | Battle Map owner | `src/hooks/useBattleMapGeneration.ts` | Decide rename vs keep and align exports/imports once callers are stable |

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
| Shared map interaction contract | Selection, move, path, click routing, action mode handling | `src/hooks/useBattleMap.ts` |
| Combat targeting + LOS contracts | Target/area computation and line-of-sight checks are shared utilities | `src/hooks/combat/useTargetSelection.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/utils/spatial/lineOfSight.ts` |
| Generator and setup helper | Deterministic terrain generation and spawn/setup logic | `src/services/battleMapGenerator.ts`, `src/hooks/useBattleMapGeneration.ts` |
| UI and renderer subtrees | Current production feature breadth and renderer split | `src/components/BattleMap/*` plus `src/components/BattleMap/terrain/*`, `camera/*`, `characters/*`, `vfx/*` |
| Test visibility points | Current verified test touchpoints for map UI and setup | `src/components/BattleMap/__tests__/AbilityButton.test.tsx`, `src/components/BattleMap/__tests__/ActionEconomyBar.test.tsx`, `src/components/BattleMap/__tests__/BattleMapTile.test.tsx`, `src/hooks/__tests__/useBattleMapGeneration.test.ts`, `src/hooks/combat/__tests__/useGridMovement.test.ts`, `src/hooks/combat/__tests__/useTargetSelection.test.ts` |
| Architecture context | Prior drift corrections and system boundaries | `docs/architecture/domains/battle-map.md`, `docs/architecture/COMBAT_MAP_ENGINE.md`, `src/components/BattleMap/BattleMap.README.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor and gap signal | active |
| `docs/projects/GLOBAL_GAPS.md` | Repo-level routing for non-local gaps | active |
| `docs/projects/battle-map/TRACKER.md` | Active bounded tasks and status | active |
| `docs/projects/battle-map/GAPS.md` | Durable unresolved findings | active |
| `docs/architecture/COMBAT_MAP_ENGINE.md` | Cross-subsystem map of combat map engine | active |

## Artifact Boundary

Keep durable evidence here (scope, contracts, status, and follow-up decisions). Keep local run logs, raw tool output, temporary screenshots, and one-off tests outside unless a concise summary is needed for future decisions.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Is map mode state part of combat state persistence, or UI-only state in CombatView? | Affects save/load and replay consistency across renderers | Battle Map + Combat owners | next parity-sensitive work |
| What minimal map event schema should be shared with any future combat timeline/logging tools? | Prevents duplicate validation logic and missed sync points | Battle Map owner | any integration pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/battle-map/TRACKER.md`.
3. Read `docs/projects/battle-map/GAPS.md`.
4. Confirm registry and global links in `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.
5. Continue from row `T2` in the tracker.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
