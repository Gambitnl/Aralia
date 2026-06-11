# Creatures System Living Tracker

Status: active (G4 decision recorded 2026-06-10; docs-only closure)
Last updated: 2026-06-10

Docs refresh and schema-policy passes are complete. CT-2 and G1 are validated
and complete; G5 is resolved with source-backed corpus proof, and G4 is now
review-required on a hybrid/multi-type semantics decision.
Update (2026-06-10): the G4 decision is recorded — keep binary include/exclude
targeting, defer hybrid semantics (DECISION_BLITZ D11). G4 closes as a
deliberate defer; no open implementation gap remains in this registry.

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
| CT-2 | done | Wire creature taxonomy through both spell and manual combat target validators. | Worker A | 2026-06-08 | `CreatureTaxonomy.ts`, `TargetValidationUtils.ts`, `useTargetValidator.ts`, `TargetValidationUtils.test.ts`, and `useTargetValidator.test.ts` now route creature-type include/exclude via the shared helper and preserve legacy alias reads. | None. | Focused assertions in `TargetValidationUtils.test.ts` and `useTargetValidator.test.ts` verify include/exclude plus legacy alias behavior and manual reason messaging. |
| CT-3 | done | Resolve in-progress creature-type schema decisions before any deeper refactors. | Codex | 2026-06-08 | `src/types/spells.ts`, `src/systems/spells/validation/targetingSchemas.ts`, `src/types/combat.ts`, and `src/systems/creatures/CreatureTaxonomy.ts` establish the current compatibility boundary. | N/A. New writes use plural fields; singular aliases are read-only compatibility inputs. | No unresolved schema ambiguity remains in docs before CT-2 starts. |
| CT-4 | done | Define and apply canonical encounter monster-count policy. | Worker A | 2026-06-08 | `MAX_ENCOUNTER_MONSTER_COUNT` is now exported from `src/utils/world/encounterUtils.ts` and used in `src/services/gemini/encounters.ts` and `src/services/geminiServiceFallback.ts`. | None (implemented in this pass). | One source-of-truth policy visible in validation, fallback generation, and prompt text; plus focused regression tests in `src/services/__tests__/geminiServiceFallback.test.ts`. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Worker A | `docs/projects/creatures/GAPS.md` | This pass | `TargetValidationUtils` and manual combat validators were not routed through `CreatureTaxonomy`. | `src/systems/creatures/CreatureTaxonomy.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, and `src/hooks/combat/useTargetValidator.ts`. | Behavioral divergence risk between spell and manual targeting was real before this pass. | N/A. `CreatureTaxonomy` is now the shared helper path in both validators. | `TargetValidationUtils.test.ts` and `useTargetValidator.test.ts` assert include/exclude and legacy alias parity. |
| G2 | done | support_needed_now | Codex | `docs/projects/creatures/GAPS.md` | This pass | Creature-type schema is partially duplicated across models and filters. | `CreatureType` / `CreatureSize` enums in `src/types/creatures.ts`, `TargetConditionFilter` in `src/types/spells.ts`, `targetingSchemas.ts`, `src/types/combat.ts`, and `CreatureTaxonomy.ts` establish the compatibility boundary. | New integrations can silently diverge between spell targeting and monster payload models. | N/A. Policy resolved: plural fields are canonical writes; singular aliases are compatibility reads only. | CT-2 can start without inventing a new schema or deleting legacy aliases. |
| G3 | done | in_scope_now | Worker A | `docs/projects/creatures/GAPS.md` | This pass (2026-06-08) | Encounter policy used two different monster-count caps across paths (`4` vs `6`). | `src/utils/world/encounterUtils.ts` exports `MAX_ENCOUNTER_MONSTER_COUNT`, and both `src/services/geminiServiceFallback.ts` and `src/services/gemini/encounters.ts` now use it. | Mixed path policy produced inconsistent encounter cardinality. | N/A (implemented). | `src/services/__tests__/geminiServiceFallback.test.ts` asserts fallback count cap and prompt contract alignment. |
| G4 | done | out_of_scope | human/product owner | `docs/projects/creatures/GAPS.md` | `Creatures_Ralph.md` review | Hybrid/multi-type semantics are planned but not implemented, and the runtime validator still uses a binary include/exclude contract. Decided 2026-06-10: keep binary, defer hybrid (DECISION_BLITZ D11; docs-only closure). | `CreatureTaxonomy.ts` uses binary inclusion/exclusion; `Creatures_Ralph.md` calls out dominance/partial-effect model as a gap; `docs/projects/DECISION_BLITZ_2026-06-10.md` D11. | Existing logic misses more complex creature identity behavior, but the owner explicitly chose to keep the binary contract this cycle. | None this cycle; future hybrid work starts with a fresh product/schema decision rather than reopening this gap. | Explicit defer note recorded in `NORTH_STAR.md` Required Review Brief Decision (2026-06-10) and `DECISIONS.md` D2. |
| G5 | done | adjacent_follow_up | Codex | `docs/projects/creatures/AUDIT_OR_PROOF.md` | Creatures docs pass (source-backed corpus boundary review) | `scripts/ingestMonsters.ts` generates `src/data/monsters.generated.ts`, and `src/data/monsters.ts` re-exports it without manual sharding. | `scripts/ingestMonsters.ts`, `src/data/monsters.generated.ts`, `src/data/monsters.ts`, `docs/projects/creatures/AUDIT_OR_PROOF.md` | Manual splitting would fight the data pipeline and hide the real ownership boundary. | Keep future shard-policy discussion in the ingestion pipeline; do not manually partition the generated corpus. | `AUDIT_OR_PROOF.md` captures the source-backed boundary and preserves expansion space without changing the corpus. |

## Update Rules

- Keep this tracker updated before each active slice.
- Any active, waiting, or blocked row needs owner, evidence, next check, and next action.
- Route durable unresolved findings here if in project scope, otherwise to `docs/projects/GLOBAL_GAPS.md`.
