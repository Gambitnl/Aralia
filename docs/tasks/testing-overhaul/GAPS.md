# Testing Overhaul Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/tasks/testing-overhaul/TRACKER.md` | backlog retirement pass | The phase backlog had no explicit owner map for core UI, character creator, gameplay, map, and utility testing streams. | Retired `00-MASTER-PLAN.md`; retired phase files `01` through `05`; `TRACKER.md` | Cannot route testing work safely without owners and escalation path. | Added the testing stream matrix to `TRACKER.md`. | `TRACKER.md` has owner lanes, target systems, and proof boundaries. |
| G2 | done | in_scope_now | Codex | `docs/tasks/testing-overhaul/TRACKER.md` | backlog retirement pass | The phase backlog lacked a current test matrix covering unit, integration, and rendered interaction checks. | Retired `00-MASTER-PLAN.md`; retired phase files `01` through `05` | Risk of uneven sequencing and stale completion claims. | Consolidated phase checklists into matrix-backed active rows. | `TRACKER.md` now names slice boundaries and next checks per stream. |
| G3 | done | adjacent_follow_up | Codex | `docs/tasks/testing-overhaul/TRACKER.md` | backlog retirement pass | Duplicate phase structures and numbering overlap existed across docs (`02` and `03` families). | Retired `02-CHARACTER-CREATOR.md`; retired `02-COMPLEX-INTERACTIVE.md`; retired `03-CANVAS-MAP.md`; retired `03-GAMEPLAY-SYSTEMS.md` | Duplicate phase files can create duplicate implementation planning and false completion claims. | Retired phase files and preserved the execution map in this file plus `TRACKER.md`. | No phase backlog markdown files remain in `docs/tasks/testing-overhaul`; project docs are the route. |
| G4 | active | test_coverage | testing-overhaul maintainer | Core UI testing stream | phase backlog import | Core UI surfaces still need current test coverage decisions and focused implementation slices. | Retired `01-CORE-UI.md`; current components named in `TRACKER.md` | Core user actions regress quickly without interaction tests for command buttons, character sheet entry, and modal behavior. | Pick one focused core UI surface and add or refresh tests against current components. | Focused Vitest/RTL proof for the selected surface. |
| G5 | active | test_coverage | testing-overhaul maintainer | Character creator testing stream | phase backlog import | Character creator flow still needs coverage around step navigation, selections, validation, and finalization. | Retired `02-CHARACTER-CREATOR.md`; retired `02-COMPLEX-INTERACTIVE.md`; `src/components/CharacterCreator` | This is a high-risk multi-step workflow with many branching choices and state transitions. | Select one current character-creator slice and add tests that prove state persists across steps. | Focused CharacterCreator test proof. |
| G6 | active | test_coverage | testing-overhaul maintainer | Gameplay testing stream | phase backlog import | Gameplay surfaces still need coverage decisions for combat, inventory, spellbook, and action-context behavior. | Retired `03-GAMEPLAY-SYSTEMS.md`; `src/components/CharacterSheet`; combat/spell command surfaces | Gameplay UI and runtime contracts can drift independently without focused tests. | Pick one gameplay flow and prove current behavior with a focused test. | Focused test proof for the selected combat/inventory/spellbook slice. |
| G7 | active | test_coverage | testing-overhaul maintainer | Map testing stream | phase backlog import | Map and canvas/submap surfaces still need current coverage decisions after renderer and worldforge changes. | Retired `03-CANVAS-MAP.md`; retired `04-MAP-SYSTEMS.md`; Submap, Battle Map, Worldforge map surfaces | Map rendering and interaction are easy to regress without scoped logic and rendered checks. | Pick one map logic or interaction slice and test it against current architecture. | Focused map test proof; rendered proof when the claim is visual. |
| G8 | active | test_coverage | testing-overhaul maintainer | Hooks/utils testing stream | phase backlog import | Hooks and utilities still need a current prioritization pass against existing tests and exported helper contracts. | Retired `05-UTILITIES.md`; `src/hooks`; `src/utils`; `src/utils/visuals/__tests__/visualUtils.test.ts` | Shared helpers amplify regressions across UI and gameplay systems. | Continue after the first proof by inventorying current hook/util tests, then add the next missing high-value regression. | First proof: generated item SVG paths resolve through `resolveItemVisual`; `npx vitest run src/utils/visuals/__tests__/visualUtils.test.ts` passed with 10 tests. |

## Retired Phase Backlog

The old phase checklist files were valid as broad testing intent but stale as execution trackers. Their live work now routes through G4-G8 and the stream matrix in `TRACKER.md`.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The project cannot honestly complete without it. |
| `support_needed_now` | It is not the core product task, but the project cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, or another person. |

## Update Rules

- Keep every gap tied to evidence, owner, and a concrete next proof/check.
- Keep only project-relevant gaps in this file.
- Route out-of-scope or cross-project findings into `docs/projects/GLOBAL_GAPS.md`.
