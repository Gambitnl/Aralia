# Spells Task Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G201 | done | in_scope_now | Worker D | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | this pass | Package 18 needed live closure proof before this project layer could advance | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; PR [#1143](https://github.com/Gambitnl/Aralia/pull/1143) | Closure proof is visible: Package 18 safe-replacement PR #1143 merged remotely on 2026-06-01, and Package 19 has been selected as the next concrete mechanics-bucket package. | Continue from Package 19 visible dispatch/readiness state. | Tracker row records PR #1143 merge proof and Package 19 active boundary |
| G202 | active | support_needed_now | Worker D | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | this pass | Gap 09 (no automated tracker-to-atlas drift check) is still open | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Tracker and Atlas can diverge, weakening cold-start accuracy | Add a manual alignment check at each package transition before the next package launch | Manual proof note in `TRACKER.md` and `NORTH_STAR.md` |
| G203 | active | adjacent_follow_up | Worker D | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | this pass | Structured->json residue is live and should be re-checked against implementation before declaring end-state | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | Overstating completion can hide remaining runtime-level misses in glossary-facing JSON | Keep package-level checklists aligned with `SPELL_STRUCTURED_VS_JSON_REPORT.md` and `SPELL_PHASE_1_TASK_TRACKER.md` | Next package transition review |
| G204 | out_of_scope | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul` | this pass | Engine-level schema/runtime decisions should remain in spell-system-overhaul ownership surface | `docs/tasks/spell-system-overhaul/NORTH_STAR.md`; `docs/tasks/spell-system-overhaul/TRACKER.md` | Prevent overlapping scope and duplicated fix planning across two task projects | Route future runtime-engine findings to the spell-system-overhaul docs | Not applicable here unless a handoff exception is required |
| G205 | done | adjacent_follow_up | Codex | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | backlog retirement pass | The old corpus execution checklist was a stale historical inventory rather than the live spell-truth work surface. | Retired `docs/tasks/spells/SPELL_CORPUS_EXECUTION_TRACKER.md`; guarded `scripts/generateSpellCorpusTracker.ts`; live surfaces in `SPELL_DATA_VALIDATION_PLAN.md` | Keeping 459 unchecked rows in a stale file made the backlog look larger and less precise than the current split lanes. | Deleted the stale tracker and prevented accidental regeneration without `--write-historical`. | `SPELL_DATA_VALIDATION_PLAN.md` now routes corpus-level coverage through current spell-truth surfaces and Spells child-lane gaps. |

## Classification Reference

- `in_scope_now`: required for the active task to proceed
- `support_needed_now`: not required for correctness but blocks safe continuation
- `adjacent_follow_up`: useful and related but not required in this slice
- `out_of_scope`: explicitly outside this project boundary
- `blocked_human_decision`: waiting on explicit owner/operator choice
- `blocked_external_state`: waiting on external PR/session/CI state

## Import Rules

- Cross-project gaps belong to `docs/projects/GLOBAL_GAPS.md`.
- Keep only durable gaps needed by this task-folder continuity path.
- If any out-of-scope gap becomes required for this task, move it and reclassify here with updated owner.
