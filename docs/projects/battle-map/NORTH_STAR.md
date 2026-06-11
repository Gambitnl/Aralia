---
schema_version: 1
project: Battle Map
slug: battle-map
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/battle-map
gap_signal: "G3 decided 2026-06-10 (D17, Option B: keep filename, document utility contract); G6 tactical spawn scoring is adjacent follow-up, parity proof recorded"
protocol: living project doc set
next_step: "G3 decided 2026-06-10 (D17): keep useBattleMapGeneration.ts filename and the documented stateless utility contract; revisit rename only with planned caller churn. G6 spawn scoring is the next bounded adjacent slice."
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
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Battle Map North Star

Status: active (G3 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

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
Status: active (G3 decision recorded 2026-06-10; implementation lane open)
Confidence: medium
Evidence: docs/projects/battle-map
Gap signal: G3 decided 2026-06-10 (D17, Option B: keep filename, document utility contract); G6 tactical spawn scoring is adjacent follow-up, parity proof recorded
Protocol: living project doc set
Next step: G3 decided 2026-06-10 (D17): keep `useBattleMapGeneration.ts` and the documented stateless utility contract; revisit rename only with planned caller churn. G6 spawn scoring is the next bounded adjacent slice.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-10

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

- **Option B — keep the `useBattleMapGeneration.ts` filename.** No rename, no caller sweep.
- Document the stateless utility contract (the module exports a plain setup helper,
  `generateBattleSetup`, despite the hook-shaped filename) — this North Star and the gap
  registry are that documentation.
- Revisit the rename only when caller churn is already planned for other reasons.

Status: decision recorded 2026-06-10; the G3 review gate is cleared and no code movement
is required for this gap.

## Current State

- Registry anchor is in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) under Feature/UI Projects with gap signal `GAPS.md present`, status `partial`, confidence `medium`, while the project-local follow-up is now review-required through the G3 naming decision and parity checklist gate.
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
- `useBattleMapGeneration.ts` stays hook-shaped in filename for caller stability, but the exported setup helper is intentionally stateless. The naming choice is now review-required, and the rename stays deferred until the Required Review Brief is resolved. (Decided 2026-06-10, D17: keep the filename and the documented stateless utility contract; revisit the rename only with planned caller churn.)
- T3 decision: G2 connectivity and G3 naming drift do not belong in the same implementation slice. G2 stays the runtime/pathability proof slice; G3 is now the review-required naming decision until the brief resolves it.
- G2 runtime proof: `ensureConnectivity()` now carves deterministic corridors for cave/dungeon maps when generation splits walkable regions, and the focused seed-2 regression keeps that guarantee visible.
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
| Task | G3 naming contract review gate - decide whether `useBattleMapGeneration.ts` stays as-is or is renamed in a coordinated sweep |
| Acceptance criteria | Keep the G3 naming contract explicit, create and maintain the Required Review Brief, and do not expand renderer behavior without the parity checklist |
| Allowed boundaries | `docs/projects/battle-map/`, plus narrow BattleMap source/tests only if the naming decision approves a coordinated rename |
| Stop condition | Do not rename `useBattleMapGeneration.ts` blindly and do not expand renderer behavior unless the parity checklist stays current and the naming decision is recorded |
| Verification | Docs consistency sweep plus proof that the Required Review Brief is present; focused Battle Map tests only if code changes are approved |
| Owner | Battle Map implementation worker |
| Next action | G3 decided 2026-06-10 (D17, Option B): keep the filename and documented utility contract; no rename or caller sweep. Keep the parity checklist as the renderer gate; G6 spawn scoring is the next bounded slice |

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

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Define map state/events sync spec | done | Battle Map owner | `src/components/Combat/CombatView.tsx`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/useAbilitySystem.ts` | Contract stored below; re-check when map persistence or event schema changes |
| Ensure cave/dungeon map connectivity guarantee is explicit | done | Battle Map owner | `src/services/battleMapGenerator.ts`, `src/services/__tests__/battleMapGenerator.test.ts` | Deterministic corridor repair is now implemented; keep the regression in place and re-run if generator terrain logic changes |
| Confirm parity checks for 2D and 3D map overlays before adding new visual rules | adjacent_follow_up | Battle Map owner | `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/hooks/useBattleMap.ts` | Add a short parity acceptance checklist |
| Resolve naming drift for `useBattleMapGeneration.ts` if/when moving hook-level refactors | done | Battle Map owner | `src/hooks/useBattleMapGeneration.ts`, `docs/architecture/COMBAT_MAP_ENGINE.md`, `docs/architecture/domains/battle-map.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D17 | Naming choice decided 2026-06-10 (D17, Option B): keep the filename and the documented stateless utility contract | No rename or caller sweep; revisit only when caller churn is already planned | Decision recorded 2026-06-10 (keep-as-is); utility contract documented in this North Star |
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
5. Continue from the next gap row in `TRACKER.md`: G3 is review-required, so keep the naming decision visible and use the parity checklist before any renderer behavior expansion. (Update 2026-06-10: G3 is decided — D17, keep-as-is — so the next open lanes are G6 spawn scoring and the routed CMA gaps; the parity checklist gate still applies.)



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
