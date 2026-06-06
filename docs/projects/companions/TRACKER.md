# Companions System Living Tracker

Status: active
Last updated: 2026-06-05

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Establish and enrich project docs with evidence-backed scope and gaps. | Worker A | 2026-05-31 | `docs/projects/companions/NORTH_STAR.md` | Keep docs in sync if companions code paths change. | Docs-only pass complete; no behavior change required. |
| T2 | active | Clarify/route in-project gaps for implementation handoff and risk control. | Worker A | 2026-06-05 | `docs/projects/companions/GAPS.md`, `src/systems/companions/Companions_Ralph.md` | Keep the gap map current and route the highest-priority blocker before implementation resumes. | Each gap should have owner + source + next proof; start with the imported romance-lock decision. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker A | `docs/projects/companions/GAPS.md` | Documentation sweep | Enforce `CompanionReactionRule.requirements` in reaction evaluation. | `src/systems/companions/CompanionReactionSystem.ts`, `src/types/companions.ts` | Existing rule metadata is defined but not applied; behavior can trigger unrealistic reactions. | Add requirement filtering + tests for min/max relationship boundaries. | Dispatch with representative reaction rule sets and assert filtered result. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/companions/GAPS.md` | Documentation sweep | Reconcile relationship scale semantics (`-500..500`) across types/UI/docs. | `src/systems/companions/RelationshipManager.ts`, `src/types/companions.ts`, `src/components/ui/CompanionCard.tsx` | Mismatched scale assumptions can distort displayed approval state and rule thresholds. | Decide canonical scale contract and update docs/types/UI math together. | Verify with tests or UI smoke checks showing threshold transitions. |
| G3 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/GAPS.md` | Documentation sweep | Add queue/ratelimit strategy for repeated companion bubble reactions. | `src/components/ui/CompanionReaction.tsx`, banter reaction flow in `src/App.tsx` | Concurrent reactions may overwrite rather than queue, reducing UX clarity. | Choose queue policy or dedupe policy and add regression for burst case. | Simulate back-to-back reaction messages and verify UI behavior. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/companions/GAPS.md` | Documentation sweep | Resolve loyalty placeholder and stale TODO import/type contracts. | `src/systems/companions/RelationshipManager.ts` | Placeholder loyalty behavior can hide design intent and create silent fallback risk. | Route to design owner or scope as deliberate deferred behavior. | Record explicit contract decision in this doc and code comments. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/GAPS.md` | Documentation sweep | Validate banter/conversation state coupling under edge cases (pause, focus, loading). | `src/hooks/useCompanionBanter.ts`, `src/hooks/useConversation.ts`, `src/components/ui/CollapsibleBanterPanel.tsx` | Several branch behaviors depend on broad state checks and may regress under UI transitions. | Add edge-case proof in runbook or local assertions before major feature work. | Re-run targeted hook/component checks after any state-shape changes. |
| G6 | not_started | blocked_human_decision | Worker A | `docs/projects/companions/GAPS.md` | `src/systems/companions/Companions_Ralph.md` review | Romance state lock-in can keep a companion flagged as `romance` even after approval collapses to hostile territory. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts` | Story logic needs an explicit breakup/downgrade contract before more relationship content can be safely added. | Choose automatic, event-driven, or hysteresis breakup semantics and encode them in `RelationshipManager`. | Run a regression that drops approval from romance to hostile and verifies the chosen exit policy. |
| G7 | not_started | adjacent_follow_up | Worker A | `docs/projects/companions/GAPS.md` | `src/systems/companions/Companions_Ralph.md` review | `RelationshipManager` uses direct `crypto.randomUUID()` calls instead of the shared `generateId()` helper. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts`, `src/utils/core/idGenerator.ts` | Runtime compatibility is less safe than the rest of the project's ID path and may fail in older/embedded environments. | Swap the helper and keep the existing compatibility fallback centralized. | Targeted `RelationshipManager` test or typecheck confirming ID generation still works across environments. |

