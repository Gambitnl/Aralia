---
schema_version: 1
project: Religion System
slug: religion
category: Gameplay Systems
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/religion
gap_signal: "G4 review-required; ritual consequence ownership decision pending"
protocol: living project doc set
next_step: Resolve the ritual ownership decision in the Required Review Brief, then resume G4 only if Religion keeps the consequence contract.
agent_comments: "Ritual interruption consequences now need an ownership decision between Religion and Rituals; no implementation changes were made."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Religion System North Star

Status: review-required
Last updated: 2026-06-09

## Purpose
This project covers implemented religion systems in the current codebase:

- deity data and doctrine triggers
- temple generation and service handling
- favor changes from prayer, combat events, and temple actions
- ritual side effects where they currently intersect the ritual runtime

## Dashboard Card Schema

Project: Religion System
Slug: religion
Category: Gameplay Systems
Status: review-required
Confidence: medium
Evidence: docs/projects/religion
Gap signal: G4 review-required; ritual consequence ownership decision pending
Protocol: living project doc set
Next step: Resolve the ritual ownership decision in the Required Review Brief, then resume G4 only if Religion keeps the consequence contract.
Required verification: docs_consistency
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Why this folder exists
Religion is already a registered project in `docs/projects/PROJECT_TRACKER.md`, but behavior is spread across system files, reducers, action types, and UI. This folder consolidates a practical cold-start map of what exists, how it is wired, and what is uncertain.

## Bounded Evidence Map

| Area | Files |
|---|---|
| Core data | `src/data/deities/index.ts`, `src/data/temples/index.ts`, `src/data/religion/blessings.ts` |
| Religion systems | `src/systems/religion/index.ts`, `src/systems/religion/TempleSystem.ts`, `src/systems/religion/CombatReligionAdapter.ts`, `src/systems/religion/__tests__/*` |
| Types/contracts | `src/types/religion.ts`, `src/types/state.ts`, `src/types/index.ts`, `src/types/actions.ts` |
| Reducers | `src/state/reducers/religionReducer.ts`, `src/state/reducers/townReducer.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts`, `src/state/actionTypes.ts` |
| Utilities | `src/utils/religionUtils.ts`, `src/utils/world/religionUtils.ts`, `src/utils/world/templeUtils.ts`, `src/utils/world/__tests__/religionUtils.test.ts` |
| Ritual bridge | `src/systems/rituals/RitualManager.ts`, `src/systems/rituals/__tests__/*`, `src/types/rituals.ts` |
| UI/modal flow | `src/components/Religion/TempleModal.tsx`, `src/components/Religion/DivineFavorPanel.tsx`, `src/components/layout/GameModals.tsx`, `src/state/reducers/townReducer.ts` |
| Action entry | `src/hooks/actions/actionHandlers.ts`, `src/components/layout/GameModals.tsx` |

## Implemented state and flow

- `OPEN_TEMPLE` generates a village temple via `generateVillageTemple` and opens `state.templeModal` in `townReducer`.
- `TempleSystem` validates service affordability and applies side effects through typed legacy adapters plus explicit structured effect handlers, keeping string compatibility while separating heal and non-heal service paths.
- `religionReducer` updates divine favor for `PRAY`, `TRIGGER_DEITY_ACTION`, and `USE_TEMPLE_SERVICE`, and writes updates into both `state.religion` and legacy `state.divineFavor`.
- `CombatReligionAdapter` maps combat log entries into religion triggers using deity-authored combat taxonomy labels plus legacy fallbacks (`DESTROY_UNDEAD`, `KILL_ELF`, `DEFEAT_ORC`, `HEAL_ALLY`, necromancy-related triggers).
- `worldReducer` runs ritual advancement on `ADVANCE_TIME`; `RitualManager` controls ritual progress and interruption.
- UI layer reads from `state.religion` in `DivineFavorPanel` and shows services in `TempleModal`, both surfaced by `GameModals`.

## Current gaps and next checks

- Highest-risk seam: G1 is now fenced in code: the reducer hydrates legacy favor into the canonical religion slice and mirrors writes back to both maps, while the temple registry remains a read-only compatibility seed.
- G2 temple service effects are now typed at the service boundary, with legacy strings still routed through an adapter map for compatibility.
- Combat trigger coverage now pulls from deity-authored combat taxonomy labels, but the remaining ritual and UI payload seams still need follow-up.
- Ritual interruption and backlash handling in `RitualManager`/`ritualReducer` is now review-required because the consequence contract crosses the Religion and Rituals project boundary.
- Faith action payload typing remains loose at UI and handler boundaries.

## Concrete next checks

1. Keep the G1 compatibility helper in place and do not assign forward Religion implementation while the ritual ownership decision is unresolved.
2. Keep the combat trigger taxonomy map in place and preserve the ritual reducer/manager boundary until the Required Review Brief is answered.
3. Keep ritual consequence and UI typing follow-ups queued behind the ownership decision instead of widening now.

## Required Review Brief

Title: Ritual consequence ownership and UI routing
Question: Which project owns the ritual interruption consequence contract, and where should backlash/output messaging be surfaced?

### Decision Panel

```text
Ritual interruption fires
          |
          v
  placeholder backlash / generic message
          |
          v
  ownership decision needed
      /                 \
     v                   v
Religion owns       Rituals owns
message/effect      consequence math
routing             and normalized output
     |                   |
     v                   v
Religion tests      Rituals tests first,
assert feedback     Religion consumes result
```

| Decision point | Option A: Religion-owned output | Option B: Rituals-owned contract |
|---|---|---|
| Source of consequence truth | Religion defines interruption output and message payload | Rituals defines backlash schema/effect math |
| Religion responsibility | Produce and route feedback directly | Consume normalized Rituals result |
| Main risk | Duplicates Rituals-owned consequence logic | Leaves Religion blocked until Rituals contract exists |
| First proof after decision | Religion reducer/manager message assertions | Rituals consequence tests, then Religion integration assertions |

Issue: `src/systems/rituals/RitualManager.ts` still returns placeholder backlash output, and `src/state/reducers/ritualReducer.ts` currently fabricates a generic interruption message with an empty backlash payload.
Current behavior: Ritual interruption pauses the active ritual and emits a generic system message, but the actual backlash/effect path is still placeholder-first and can be read as either Religion-owned messaging or Rituals-owned consequence math.
Why blocked: The same consequence seam is already tracked in the Rituals project, so Religion should not invent or duplicate the contract until the owner boundary is explicit.
Option A: Religion owns the explicit interruption effect output and routes the resulting message/UI feedback through the reducer and existing message surface.
Option B: Rituals owns the consequence schema and effect math, and Religion only consumes a normalized output without defining a new consequence contract.
Evidence: `docs/projects/religion/GAPS.md` G4; `docs/projects/rituals/GAPS.md` RG-3 and RG-4; `src/state/reducers/ritualReducer.ts`; `src/systems/rituals/RitualManager.ts`.
Decision owner: Human/product owner with Religion and Rituals owners.
Proof after decision: Focused ritual reducer/manager tests that assert the chosen consequence output, plus any message/UI assertions required by the selected owner boundary.

## Cold-start resume path

1. Read this file.
2. Read `docs/projects/religion/TRACKER.md`.
3. Read `docs/projects/religion/GAPS.md`.
4. Stop forward implementation until the Required Review Brief is answered, then resume from the decided owner boundary with the compatibility helper, combat taxonomy map, and temple service adapter intact.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
