# Creatures System Gap Registry

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/creatures/TRACKER.md` | docs refresh pass | Creature taxonomy logic is fragmented across spell and manual combat validators. | `src/systems/creatures/CreatureTaxonomy.ts` centralizes creature checks and ends with TODO to integrate; `src/systems/spells/targeting/TargetValidationUtils.ts` and `src/hooks/combat/useTargetValidator.ts` each implement bespoke `creatureType/creatureTypes` logic. | Inconsistent behavior and migration risk between AI-targeting and manual combat targeting paths. | Add shared helper use in both validators; update tests around existing `CreatureTaxonomy` coverage and manual targeting reason paths. | Two focused regression groups: spell validator and manual validator both honoring exclude+include semantics. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/creatures/TRACKER.md` | docs refresh pass + schema review | `TargetConditionFilter` model supports overlapping legacy/new fields; integration points consume different aliases. | `src/types/spells.ts` documents both `creatureType` and `creatureTypes`, `sizes`/`size`, `alignment`/`alignments`, while consumer logic uses mixed forms. | Without a schema policy, future edits can bypass filter compatibility or widen logic unintentionally. | Decide canonical read/write rules and migration boundary before taxonomy integration changes. | New edits pass with explicit policy references and no new divergent checks. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/creatures/TRACKER.md` | docs refresh pass + encounter tests | Encounter generator and AI fallback use different monster-count caps. | `src/utils/world/encounterUtils.ts` caps rebuild paths at `MAX_MONSTER_COUNT = 4`; `src/services/geminiServiceFallback.ts` caps random fallback at `MAX_MONSTERS = 6`; `geminiService` prompt still instructs 1..4 monsters in AI prompt. | Same encounter request can create different cardinality depending on source, making balancing and UX inconsistent. | Choose one canonical encounter cap and apply it in both flow and prompt constraints. | One cap value documented with a small assertion-like comment or test per path. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/creatures/TRACKER.md` | `src/systems/creatures/Creatures_Ralph.md` review | Hybrid/multi-type semantics are planned but not implemented. | `CreatureTaxonomy.ts` uses binary inclusion/exclusion; `Creatures_Ralph.md` calls out dominance/partial-effect model as a gap. | Existing logic misses more complex creature identity behavior and can misclassify edge-cases. | Keep design in adjacent scope until base schema/workflow is stable. | Record chosen schema before any hybrid implementation begins. |

## Classification Reference

- `in_scope_now` - required for the current task slice.
- `support_needed_now` - not in current slice but must be completed before the slice can progress safely.
- `adjacent_follow_up` - useful future work that should be preserved but not promoted into this slice.
- `out_of_scope` - explicitly rejected for this project/task.
- `blocked_human_decision` - needs explicit owner decision.
- `blocked_external_state` - external dependency/coordination needed.

## Import / Routing Rule

- If a future task identifies cross-project ownership, move it to `docs/projects/GLOBAL_GAPS.md` with routing rationale.
- Gaps already in this registry stay here until ownership is intentionally reassigned.
