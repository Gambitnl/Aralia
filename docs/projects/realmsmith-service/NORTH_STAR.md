---
schema_version: 1
project: RealmSmith Service
slug: realmsmith-service
category: Runtime Support
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-05
confidence: medium
evidence: docs/projects/realmsmith-service
gap_signal: 3 open gaps (2 support-needed, 1 adjacent follow-up)
protocol: living project doc set
next_step: Confirm the service contract and retry policy from source before the next implementation change.
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
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: RealmSmith Service

Status: active
Last updated: 2026-06-05

## Why This Project Exists

RealmSmith is the deterministic town generation and rendering path used by the live
TownCanvas surface. This doc exists to preserve current ownership, dependencies,
and unresolved decisions for future work without inventing a parallel service model.

## Intended Outcome

- Keep a cold-start map for the project in plain text.
- Preserve implementation intent and boundaries.
- Record the minimum durable gaps required for continuity.

## File Map

- `src/services/RealmSmithTownGenerator.ts` -> `TownGenerator` entry class.
- `src/services/RealmSmithAssetPainter.ts` -> `AssetPainter` entry class.
- `src/services/realmsmith/painters/*` -> render sub-modules (tile, building, doodad, overlay, player).
- `src/services/{BuildingGenerator.ts,RoadGenerator.ts,TerrainGenerator.ts,DoodadGenerator.ts}` -> generation passes.
- `src/constants/realmsmith.ts`, `src/data/realmsmithBiomes.ts`, `src/types/realmsmith.ts` -> generation constants and contracts.
- `src/hooks/useTownController.ts` -> `TownGenerator` orchestration for state/UI.
- `src/components/Town/TownCanvas.tsx` -> `AssetPainter` invocation and interactions.
- `src/hooks/__tests__/useTownController.test.tsx` -> mocked contract test shape.

## Dashboard Card Schema

Project: RealmSmith Service
Slug: realmsmith-service
Category: Runtime Support
Status: active
Confidence: medium
Evidence: docs/projects/realmsmith-service
Gap signal: 3 open gaps (2 support-needed, 1 adjacent follow-up)
Protocol: living project doc set
Next step: Confirm the service contract and retry policy from source before the next implementation change.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Implemented State

- Registry evidence exists: `docs/projects/PROJECT_TRACKER.md` row for RealmSmith Service.
- Generation is active and wired to UI flow through `useTownController`.
- Rendering is active through `TownCanvas -> AssetPainter -> painter modules`.
- Types and constants already define terrain, biome, and tile/building payload shape.
- The project packet now exposes dashboard-facing state directly in this North Star.

## Active Task

| Field | Value |
|---|---|
| Task | Confirm RealmSmith service contract and retry policy before the next implementation change. |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS agree on the current contract surface, retry policy, and next proof step. |
| Allowed boundaries | `docs/projects/realmsmith-service/*`, `docs/projects/GLOBAL_GAPS.md`, `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` if the workflow ambiguity recurs. |
| Stop condition | no code or API changes in this pass. |
| Verification | docs consistency plus a source scan of the generator/painter contract surface before implementation. |
| Owner | Codex agent |
| Next action | source-scan the service contract and record the chosen retry/failure policy in the project packet. |

## Scope Boundaries

In scope:
- current implementation surface in source
- contracts inferred from source and tests
- retry policy and API-shape follow-up classification
- dashboard-facing project state and handoff continuity

Adjacent but not in this slice:
- generator math tuning
- painter quality, pixel style, and content balancing

Out of scope:
- new gameplay mechanics
- refactoring non-RealmSmith town systems

## What Must Not Be Lost

- The service split is real: generation and rendering are in different entry classes.
- The map contract is currently inferred from `TownOptions` -> `TownMap` in TypeScript.
- The project should remain aligned with tracker status in `docs/projects/PROJECT_TRACKER.md`.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| No explicit RealmSmith service API contract or error envelope across generator + painter boundaries | support_needed_now | pending | `src/hooks/useTownController.ts`, `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts` | define the caller contract and failure shape before the next implementation change |
| No documented retry/backoff policy for generation or paint failures | support_needed_now | pending | `src/services/RealmSmithTownGenerator.ts`, `src/services/README.md`, retry-policy scan | record the chosen hard-fail versus retry/fallback stance in the project packet |
| World/content generation assumptions are not versioned as a stable interface | adjacent_follow_up | pending | `src/types/realmsmith.ts`, `src/components/Town/TownCanvas.tsx`, `src/services/RealmSmithTownGenerator.ts` | add contract notes before future generator/painter refactors |

## Global Gap Imports

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | no external global gap moved into this project yet |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Generator contract | source to UI wiring | `src/hooks/useTownController.ts`, `src/services/RealmSmithTownGenerator.ts` |
| Paint contract | map rendering path | `src/services/RealmSmithAssetPainter.ts`, `src/components/Town/TownCanvas.tsx` |
| Domain schema | shared biome and payload data | `src/types/realmsmith.ts`, `src/data/realmsmithBiomes.ts`, `src/constants/realmsmith.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | registry and broad continuity | active |
| `docs/projects/GLOBAL_GAPS.md` | cross-project routing | active |
| `docs/projects/realmsmith-service/TRACKER.md` | active queue and next action | active |
| `docs/projects/realmsmith-service/GAPS.md` | durable unresolved findings | active |

## Artifact Boundary

Keep durable intent, boundaries, and gap entries in docs.
Do not store transient logs, generated debug traces, or raw test artifacts here.

## Open Questions

| Question | Why it matters | Owner | Needed by | Last updated |
|---|---|---|---|---|
| Should RealmSmith adopt a standardized service result model, or remain a sync value-returning service? | impacts call-site error behavior and retry handling | pending | next implementation task | 2026-06-05 |
| Should generation failures be recoverable with retry, fallback, or hard fail only? | impacts user-visible stability | pending | next implementation task | 2026-06-05 |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/realmsmith-service/TRACKER.md`.
3. Read `docs/projects/realmsmith-service/GAPS.md`.
4. Validate the file map and contract surface against source.
5. Continue from: "confirm RealmSmith service contract and retry policy before the next implementation change."


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- confirm the active contract/retry gap set before any implementation change
- add only real new gaps discovered during the bounded sweep
- route any cross-project ambiguity to `docs/projects/GLOBAL_GAPS.md` instead of burying it here
