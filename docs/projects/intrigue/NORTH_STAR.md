---
schema_version: 1
project: Intrigue System
slug: intrigue
category: Feature/System Projects
main_category: "Game & Simulation"
subcategory: Core Sim Systems
status: active
last_updated: 2026-06-15
iteration: 3
confidence: medium
evidence: docs/projects/intrigue
gap_signal: 6 open gaps in GAPS.md
protocol: living project doc set
next_step: Continue I3 by resolving rumor lead handling contract.
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
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-15
workflow_gaps_reviewed: 2026-06-15
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Intrigue System North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: Intrigue System
Slug: intrigue
Category: Feature/System Projects
Status: active
Confidence: medium
Evidence: docs/projects/intrigue
Gap signal: 6 open gaps in `GAPS.md`
Protocol: living project doc set
Next step: Continue `I3` by resolving rumor lead handling contract.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-15
Workflow gaps reviewed: 2026-06-15

Purpose
Intrigue connects social intelligence, faction politics, and rumor-driven world state with the rest of Aralia. It is implemented as three layers:

- Core identity and leverage logic in `src/systems/intrigue/*`
- Daily world-level intrigue events in `src/systems/world/*`
- UI discovery paths in taverns/merchant flow

Scope
- In scope: factions, rumors, secrets, reputation effects, and their state/update integration points.
- Explicitly not in scope: making major design changes to combat, UI architecture, or quest story engine ownership.

Concrete file map
- Core intrigue:
  - `src/systems/intrigue/IdentityManager.ts`
  - `src/systems/intrigue/LeverageSystem.ts`
  - `src/systems/intrigue/SecretGenerator.ts`
  - `src/systems/intrigue/NobleHouseGenerator.ts`
  - `src/systems/intrigue/TavernGossipSystem.ts`
- World integration:
  - `src/systems/world/WorldEventManager.ts`
  - `src/systems/world/NobleIntrigueManager.ts`
  - `src/systems/world/FactionManager.ts`
  - `src/utils/factionUtils.ts`
  - `src/utils/world/factionUtils.ts`
- State and action integration:
  - `src/state/actionTypes.ts` (`CREATE_ALIAS`, `EQUIP_DISGUISE`, `REMOVE_DISGUISE`, `LEARN_SECRET`)
  - `src/state/reducers/identityReducer.ts`
  - `src/state/reducers/worldReducer.ts`
  - `src/state/appState.ts` (`START_NEW_GAME_SETUP`, `START_GAME_SUCCESS` paths initialize intrigue-relevant factions and standings)
- Types:
  - `src/types/identity.ts`
  - `src/types/factions.ts`
  - `src/types/state.ts`
  - `src/types/world.ts` (`WorldRumor`)
- UI integration:
  - `src/components/Town/Intrigue/RumorMill.tsx`
  - `src/components/Trade/MerchantModal.tsx`
  - `src/components/debug/NobleHouseList.tsx`
- Tests:
  - `src/systems/intrigue/__tests__/SecretSystem.test.ts`
  - `src/systems/intrigue/__tests__/LeverageSystem.test.ts`
  - `src/systems/intrigue/__tests__/TavernGossipSystem.test.ts`
  - `src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts`
  - `src/systems/world/__tests__/NobleIntrigueManager.test.ts`
  - `src/systems/world/__tests__/WorldEventManager.test.ts`
  - `src/systems/world/__tests__/FactionManager.test.ts`

Implemented state (current evidence)
- Identity state exists and initializes per character via `IdentityManager.createInitialState`, and aliases/disguises/secrets can be mutated by reducer.
- Secret and rumor generation are deterministic by seed/day/location in several paths (`SecretGenerator`, `TavernGossipSystem`, `NobleIntrigueManager`, world skirmish rumors).
- World tick integration exists: `ADVANCE_TIME` can call `processWorldEvents`, which runs intrigue and skirmish/event paths and appends rumor/state changes.
- Player rumor acquisition path is implemented: tavern/merchant UI calls `TavernGossipSystem.getAvailableRumors` and purchases create inventory note items via `BUY_ITEM`.

Integration points to preserve
- `factions` + `playerFactionStandings` are seeded from `data/factions.ts` and `getAllFactions(worldSeed)` at game setup.
- `processWorldEvents` owns rumor lifecycle: daily cleanup, propagation, event-driven adds, and eventual expiry.
- `NobleIntrigueManager` writes `WorldRumor` records and faction relationship changes into state.
- `FactionManager.applyReputationChange` wraps visible/reputation delta logic and can generate secondary rumors.
- `RumorMill` marks rumor content as purchased by writing `note` items with id prefix `rumor_`.

Current gaps and uncertainties to carry forward
- `IntrigueCheckResult` is defined in `src/types/identity.ts` but not used by any live reducer or action flow.
- `LeverageSystem` is now wired with `APPLY_LEVERAGE` action type (actionTypes.ts:245), identityReducer case (identityReducer.ts:109), `LeverageUI.tsx` component, and integration tests. Next step for leverage: integrate the LeverageUI into a dialog/npc-interaction surface so players can invoke it in context.
- `TavernGossipSystem` marks `lead` option payload as `undefined` with a TODO to connect quest/world hookups.
- `TavernGossipSystem` and two noble/secret generator families show partial overlap and different payload conventions.
- Reputation/rumor hooks are present, but the player-facing chain for applying discovered secret leverage now has an action path and UI component awaiting dialog surface integration.

Resume path
1. Start with `TRACKER.md` row `I3`.
2. Resolve rumor lead handling contract (lead type currently non-actionable).
3. Keep the active gap list aligned with `GAPS.md` before opening any new work.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- if no valid in-scope project gaps exist, identify real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
