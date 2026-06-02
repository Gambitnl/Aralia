# NORTH_STAR: RealmSmith Service

Status: active
Last updated: 2026-05-31

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

## Implemented State

- Registry evidence exists: `docs/projects/PROJECT_TRACKER.md` row for RealmSmith Service.
- Generation is active and wired to UI flow through `useTownController`.
- Rendering is active through `TownCanvas -> AssetPainter -> painter modules`.
- Types and constants already define terrain, biome, and tile/building payload shape.

## Active Task

| Field | Value |
|---|---|
| Task | Refresh docs into a concise cold-start map and record durable gaps. |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS describe current file map, integration points, and concrete open items. |
| Allowed boundaries | `docs/projects/realmsmith-service/*`, `docs/projects/PROJECT_TRACKER.md`, `docs/projects/GLOBAL_GAPS.md`. |
| Stop condition | no code or API changes in this pass. |
| Verification | source scan confirms all paths and contracts listed above. |
| Owner | Codex agent |
| Next action | resolve listed gaps in implementation-aware follow-up. |

## Scope Boundaries

In scope:
- current implementation surface in source
- contracts inferred from source and tests
- retry policy and API-shape follow-up classification

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
| No explicit RealmSmith service API contract and error envelope across generator + painter boundaries | adjacent_follow_up | pending | `src/hooks/useTownController.ts`, `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts` | define an explicit API contract for callers and failures |
| No documented retry/backoff policy for generation/render failure handling | adjacent_follow_up | pending | `src/services/RealmSmithTownGenerator.ts`, `src/services/README.md`, repo-wide retry search | align with or justify deviation from service retry standards |
| World/content generation assumptions are not versioned as a stable interface | support_needed_now | pending | `src/types/realmsmith.ts`, `src/components/Town/TownCanvas.tsx`, `src/services/RealmSmithTownGenerator.ts` | add contract checks before future generator/painter refactors |

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

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should RealmSmith adopt a standardized service result model, or remain a sync value-returning service? | impacts all call site error behavior and retries | pending | next implementation task |
| Should generation failures be recoverable with retry, fallback, or hard fail only? | impacts user-visible stability | pending | next implementation task |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/realmsmith-service/TRACKER.md`.
3. Read `docs/projects/realmsmith-service/GAPS.md`.
4. Validate the file map against source.
5. Continue from: "stabilize RealmSmith service contract and retry policy boundary."


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
