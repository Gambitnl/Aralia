---
schema_version: 1
project: Town Description System
slug: town-description-system
category: active project
main_category: "Content & Rules"
subcategory: "Items & Content Pipelines"
status: active
last_updated: 2026-06-25
iteration: 2
confidence: unknown
evidence: "docs/projects/town-description-system/TRACKER.md; docs/projects/town-description-system/GAPS.md"
gap_signal: 7 open gaps; metadata, persistence, consume path, description generation, presentation, and deferred expansion follow-ups remain open
protocol: living-project
next_step: Resume from TRACKER.md and keep the gap log aligned.
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
  - IMPLEMENTATION_PLAN.md
  - QUICK_START.md
  - README.md
  - TECHNICAL_SPEC.md
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-05
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Town Description System North Star

Status: active
Last updated: 2026-06-25

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Town Description System |
| Slug | town-description-system |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/town-description-system/TRACKER.md; docs/projects/town-description-system/GAPS.md |
| Gap signal | 7 open gaps; retired TASKS.md backlog imported into GAPS.md |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Purpose

This project defines the documentation-owned surface for town identity and town-description work.

## Scope

In scope:
- purpose, file map, evidence-backed implemented state, and gap ownership for town-description
- coupling between town runtime and source of settlement identity, cultural profile, and governing style
- where persistent town-description metadata should be stored when it is implemented

Out of scope:
- world-system architecture changes (`docs/projects/world`)
- town runtime behavior changes (`docs/projects/town`)
- runtime code edits during this docs-only pass

## File Map

Primary references:
- `src/utils/world/settlementGeneration.ts` (settlement identity, governingBody, culture, industry)
- `src/services/villageGenerator.ts` (VillagePersonality and integration profile)
- `src/services/worldSim/sites.ts` (site placement and `townSeed`)
- `src/services/worldSim/types.ts` (Site and WorldData contracts)
- `src/App.tsx` (town phase entry, `determineSettlementInfo`)
- `src/components/Town/TownCanvas.tsx` (receives settlement context, seeds from world coords)
- `src/components/Town/VillageScene.tsx` (full village context payload path)
- `src/components/Town/townUtils.ts` (biome mapping for town generation)
- `src/hooks/useTownController.ts` (town generation state control)
- `src/types/village.ts` (VillagePersonality)
- `src/types/world.ts` (MapData and WorldData)
- `src/types/actions.ts` and `src/state/actionTypes.ts` (action contracts)
- `src/state/reducers/townReducer.ts` (town state transitions)
- `src/types/state.ts` and `src/state/initialState.ts` (runtime state fields)
- `src/services/saveLoadService.ts` (current save path)
- project files in this folder: `README.md`, `TECHNICAL_SPEC.md`, `IMPLEMENTATION_PLAN.md`, `QUICK_START.md`

## Implemented State (Verified)

- Settlement identity exists as derived runtime input:
  - `determineSettlementInfo` is used when entering town view.
- Settlement profile fields exist in source data:
  - `VillagePersonality` includes `governingBody`, `culture`, `primaryIndustry`, `architecturalStyle`.
- `worldSim` contributes spatial coupling:
  - `Site` entries include `townSeed` and feed deterministic town flows.
- Town runtime entry exists:
  - `App` renders `TownCanvas` in `GamePhase.VILLAGE_VIEW`.
- Town persistence integration points are partial:
  - `GameState` has `townState` and `townEntryDirection`.
  - full save/load pipeline exists, but no stable town-description metadata lane is yet documented.

## Planned State (Not Yet Verified)

- one shared town metadata shape for identity + cultural profile + settlement traits
- one persistence path for generated town metadata and description data
- one shared description generation path from settlement profile + layout signals
- one first presentation attachment for town-description output
- optional performance layer only after correctness/persistence is in place
- retired `TASKS.md` backlog items are now routed through `GAPS.md` G6 and G7

## Integrations

- World-to-town coupling is present at generation and entry time.
- Town runtime consumes settlement context but does not consume full profile in `TownCanvas` rendering.
- `VillageScene` builds richer `VillageActionContext` (`integrationProfileId`, `culturalSignature`, `encounterHooks`) that is not currently used by the active `TownCanvas` path.
- Action contracts span both `ENTER_VILLAGE` and `ENTER_TOWN` paths, with different handling locations.

## Relationship to Adjacent Projects

- This project coordinates with `docs/projects/world` for source identity inputs.
- This project coordinates with `docs/projects/town` for runtime phase and movement behavior.
- This project should avoid redesigning world or town runtime contracts.

## Known Gaps / Uncertainties

- storage location for shared town-description metadata is unresolved
- persistence contract for governing style, cultural profile, and stable town id is not yet defined
- Town and world entry contract is split (`ENTER_TOWN` in action types/reducer, `ENTER_VILLAGE` in handler paths)
- `TownCanvas` currently receives settlement info as an optional prop but uses stub local interaction metadata

## Next Checks

- confirm one owner for metadata ownership and persistence placement in `TRACKER.md`
- confirm one canonical coupling boundary for town entry contracts and context payload path
- confirm whether `VillageScene` context model or `TownCanvas` prop model is the first surface to consume town description metadata
- continue from `GAPS.md` instead of restoring the retired `TASKS.md` checklist

## Resume Path

1. Read this file.
2. Read `docs/projects/town-description-system/TRACKER.md`.
3. Read `docs/projects/town-description-system/GAPS.md`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
