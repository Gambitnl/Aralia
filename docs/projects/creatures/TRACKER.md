# Creatures System Tracker

Status: active
Last updated: 2026-06-05

Docs refresh pass is complete. CT-3 is the current dependency-bearing slice;
CT-2 waits on the schema decision.

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
| CT-1 | done | Refresh living-project docs for Creatures with evidence-backed state, ownership map, gap set, and resume path. | Worker A | 2026-06-05 | `docs/projects/creatures/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md` now reflect the current queue and schema. | None. | `git diff --check` passes and no non-document paths changed. |
| CT-2 | waiting | Wire creature taxonomy through both spell and manual combat target validators. | Worker A | 2026-06-05 | `CreatureTaxonomy.ts` has the integration TODO; `TargetValidationUtils.ts` and `useTargetValidator.ts` still use direct type checks. | Wait for CT-3 schema policy, then replace duplicated logic with the shared taxonomy helper and add behavioral tests. | Regression coverage exists for both automated and manual combat target paths. |
| CT-3 | active | Resolve in-progress creature-type schema decisions before any deeper refactors. | Worker A | 2026-06-05 | `TargetConditionFilter` fields in `src/types/spells.ts` still support mixed legacy/new names and are consumed across systems. | Define migration/compliance rules for `creatureType`, `creatureTypes`, `size`, `sizes`, `alignment`, and `alignments`. | No unresolved ambiguity remains in schema docs before CT-2 starts. |
| CT-4 | waiting | Define and apply canonical encounter monster-count policy. | Worker A | 2026-05-31 | `MAX_MONSTER_COUNT = 4` in `src/utils/world/encounterUtils.ts` vs `MAX_MONSTERS = 6` in `src/services/geminiServiceFallback.ts`. | Choose one cap and align AI validator and fallback/roll generators. | One source-of-truth policy visible in validation and generation functions with tests. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/creatures/GAPS.md` | This pass | `TargetValidationUtils` and manual combat validators are not routed through `CreatureTaxonomy`. | `src/systems/creatures/CreatureTaxonomy.ts` includes TODO integration; `src/systems/spells/targeting/TargetValidationUtils.ts` + `src/hooks/combat/useTargetValidator.ts` still do inline checks. | Behavioral divergence risk between spell and manual targeting. | Integrate shared helper and add tests for legacy/new filter fields. | One test per path proving equivalent behavior. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/creatures/GAPS.md` | This pass | Creature-type schema is partially duplicated across models and filters. | `CreatureType` / `CreatureSize` enums in `src/types/creatures.ts` and `TargetConditionFilter` in `src/types/spells.ts` carry partially overlapping shape plus legacy aliases. | New integrations can silently diverge between spell targeting and monster payload models. | Freeze a schema policy and route migration for one surface first. | No duplicate/alias-only checks remain in new code paths. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/creatures/GAPS.md` | This pass | Encounter policy uses two caps depending on path. | `MAX_MONSTER_COUNT = 4` in `src/utils/world/encounterUtils.ts` and `MAX_MONSTERS = 6` in `src/services/geminiServiceFallback.ts`; `geminiService` prompt still instructs 1..4 monsters in AI prompt. | Same encounter request can create different cardinality depending on source, making balancing and UX inconsistent. | Choose canonical policy and document rationale in tracker + docs. | A single policy appears in both constants and any prompt contracts. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/creatures/GAPS.md` | `Creatures_Ralph.md` review | Hybrid/multi-type semantics are planned but not implemented. | `CreatureTaxonomy.ts` uses binary inclusion/exclusion; `Creatures_Ralph.md` calls out dominance/partial-effect model as a gap. | Existing logic misses more complex creature identity behavior and can misclassify edge-cases. | Keep design in adjacent scope until base schema/workflow is stable. | Record chosen schema before any hybrid implementation begins. |

## Update Rules

- Keep this tracker updated before each active slice.
- Any active, waiting, or blocked row needs owner, evidence, next check, and next action.
- Route durable unresolved findings here if in project scope, otherwise to `docs/projects/GLOBAL_GAPS.md`.
