# RealmSmith Service Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are specific to RealmSmith.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | pending | `docs/projects/realmsmith-service/TRACKER.md` | cold-start documentation pass | No explicit RealmSmith API contract across generator/painter layers (error handling, return type, failure mode, deterministic expectation) | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts`, `src/hooks/useTownController.ts`, `src/components/Town/TownCanvas.tsx` | Without a contract, future refactors can change behavior without detectable validation | define and document the caller contract and failure shape before the next implementation change | review next implementation task and add acceptance checks |
| G2 | active | support_needed_now | pending | `docs/projects/realmsmith-service/TRACKER.md` | cold-start documentation pass | No documented retry/backoff strategy for generation or paint path; no API-call resilience policy in this service area | `src/services/RealmSmithTownGenerator.ts`, `src/services/README.md`, project-wide retry pattern scan | failures during generation/paint could become unbounded UX breakage | decide whether RealmSmith uses sync hard-fail or standardized retry/error wrapper | add the chosen policy to NORTH_STAR and the next implementation handoff |
| G3 | active | adjacent_follow_up | pending | `docs/projects/realmsmith-service/TRACKER.md` | code scan and map review | World/content generation assumptions are tightly coupled and not versioned (biome data, map geometry, painter layering) | `src/types/realmsmith.ts`, `src/data/realmsmithBiomes.ts`, `src/components/Town/TownCanvas.tsx`, `src/services/RealmSmithAssetPainter.ts` | non-versioned coupling increases chance of silent breakage in content generation and interactions | add contract notes in implementation handoff before biome/painter changes | create next check and record expected payload shape |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Task cannot complete without this resolved. |
| `support_needed_now` | Not in this immediate implementation slice, but needed to continue safely. |
| `adjacent_follow_up` | Useful and related, but can be deferred. |
| `out_of_scope` | Not part of this project task. |
| `blocked_human_decision` | Requires owner choice or business rule. |
| `blocked_external_state` | Blocked by vendor/environment/person outside repo. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
