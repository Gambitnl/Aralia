# Companions System Gap Registry

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker A | `docs/projects/companions/TRACKER.md` | Documentation sweep | `CompanionReactionSystem` declares rule requirements but does not enforce `minRelationship`/`maxRelationship` checks. | `src/systems/companions/CompanionReactionSystem.ts` | This can produce reactions that should be impossible for current relationship state. | Add requirement filtering before approval/dialogue aggregation; keep explicit tests for blocked/allowed cases. | Run targeted `CompanionReactionSystem` tests with boundary levels and tag overlap. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/companions/TRACKER.md` | Documentation sweep | Relationship scale comment/type mismatch: `Relationship` docs still imply legacy bounds while runtime uses `-500..500` thresholds. | `src/types/companions.ts`, `src/systems/companions/RelationshipManager.ts` | Makes intent and UI expectation brittle (e.g., bar mapping assumptions in `CompanionCard`). | Align docs/comments and any UI normalization helpers to the runtime contract. | Verify `src/components/ui/CompanionCard.tsx` and `RelationshipManager` tests still align with intended thresholds. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/companions/TRACKER.md` | Documentation sweep | `RelationshipManager.checkLoyalty` is placeholder and not used; companion leave/betrayal behavior is undefined. | `src/systems/companions/RelationshipManager.ts` | Missing contract can hide a major systems-level behavior gap in social persistence. | Define intended loyalty semantics or mark explicit deferral for future slices. | Record and cross-reference decision in this doc + future tracker task. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/TRACKER.md` | Documentation sweep | Companion reaction bubble rendering keeps only one dismissed ID and cannot queue parallel reactions. | `src/components/ui/CompanionReaction.tsx` | UX clarity loss during dense message bursts; hard to recover missed reactions. | Choose queue/per-companion behavior and document acceptance criteria. | Add focused test or integration check around consecutive reaction dispatches. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/TRACKER.md` | Documentation sweep | Multiple TODO-labeled placeholder contracts around `Companion` action side effects (`source` field handling, `onPlayerDirected` flow details). | `src/state/reducers/companionReducer.ts`, `src/hooks/useCompanionBanter.ts`, `src/state/appState.ts` | Increases future integration risk when adding new social rules or moderation policies. | Consolidate placeholder list and route each to implementation or deliberate non-goals. | Compare TODOs against next implementation plan and mark each as done/blocked/deferred. |
| G6 | not_started | blocked_human_decision | Worker A | `docs/projects/companions/TRACKER.md` | `src/systems/companions/Companions_Ralph.md` review | Romance state lock-in can keep a companion flagged as `romance` even after approval collapses to hostile territory. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts` | The system can present a companion as romantically committed while the approval state says the opposite; story logic needs an explicit breakup/downgrade contract. | Choose automatic, event-driven, or hysteresis breakup semantics and encode them in `RelationshipManager`. | Run a regression that drops approval from romance to hostile and verifies the chosen exit policy. |
| G7 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/TRACKER.md` | `src/systems/companions/Companions_Ralph.md` review | `RelationshipManager` uses direct `crypto.randomUUID()` calls instead of the shared `generateId()` helper. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts`, `src/utils/core/idGenerator.ts` | Older runtimes or embedding contexts may not provide the same UUID support contract, so ID generation should stay centralized. | Swap the helper and keep the existing compatibility fallback centralized. | Targeted `RelationshipManager` test or typecheck confirming ID generation still works across environments. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The current project cannot complete without this gap fixed. |
| `support_needed_now` | Task cannot progress cleanly without resolving this gap. |
| `adjacent_follow_up` | Useful and related, but can be deferred until core needs are complete. |
| `out_of_scope` | Confirmed not part of this project's current contract. |
| `blocked_human_decision` | Needs product or design signoff before engineering can continue. |
| `blocked_external_state` | Depends on external vendor/tooling or unrelated owner. |

