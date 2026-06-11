# Command Factory Runtime Gap Registry

Status: active  
Last updated: 2026-06-08

Use only durable unresolved findings that belong to this factory project and are likely to affect future edits.

2026-06-08 pass: no new project-specific blockers were discovered; G2 advanced because `AbilityCommandFactory` now calls `TargetValidationUtils.matchesFilter(...)` directly and only the legacy spell-factory wrapper still carries the old path.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Project doc sweep | No explicit command registration registry for factory creation paths | `src/hooks/useAbilitySystem.ts`, `src/commands/index.ts`, `src/commands/factory/*.ts` | Hardcoded use of factory entry points works now, but factory onboarding for new command sources lacks a cataloged registry pattern | Decide whether registry metadata is needed for discoverability when adding new command sources | Re-check entry points after next factory-capability expansion |
| G2 | in_progress | support_needed_now | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source/docs scan and source-backed drift pass | `SpellCommandFactory.matchesFilter(...)` is a deprecated pass-through wrapper, but the ability path now calls `TargetValidationUtils.matchesFilter(...)` directly so only the legacy spell-factory wrapper still carries the old path | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts` | Mixed filter call-sites have been reduced, but the second validation entry point still exists and can drift if the wrapper lingers too long | Keep the legacy wrapper only until the final spell caller is gone, then remove it or leave a documented compatibility note if a true legacy path still needs it | Search for `SpellCommandFactory.matchesFilter` after the next factory edit and confirm only the wrapper implementation remains |
| G3 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Source/docs sweep | Factory scaling helpers duplicate older number resolution logic and are not yet standardized | `src/commands/factory/SpellCommandFactory.ts`, `src/types/spells.ts` | Future scale-rule changes can diverge if duplicated parsing logic remains | Route to shared utility decision if scale format changes again | Verify no logic drift in tests after utility merge |
| G4 | not_started | adjacent_follow_up | Worker C | `docs/projects/command-factory-runtime/TRACKER.md` | Test sweep | Command factory tests cover major paths but do not cover all invalid mode-choice + AI arbitration edge behavior combinations | `src/commands/factory/__tests__/*.test.ts` | Regression risk remains as package spell shapes grow | Expand test matrix in implementation slice for command creation behavior | Add focused factory tests for missing edge combinations |

## Global Gap Imports

No durable cross-project gap found yet.

- Before routing to `docs/projects/GLOBAL_GAPS.md`, keep these local to this project because they only affect factory runtime ownership and behavior.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
