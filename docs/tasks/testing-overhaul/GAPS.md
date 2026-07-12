# Testing Overhaul Gaps

Status: active
Last updated: 2026-07-11

This active view contains only unresolved work. Completed gaps are preserved in
[`COMPLETED_GAPS.md`](./COMPLETED_GAPS.md).

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | active | test_coverage | testing-overhaul maintainer | Core UI testing stream | phase backlog import | Core UI surfaces still need current test coverage decisions and focused implementation slices. | Retired `01-CORE-UI.md`; current components named in `TRACKER.md` | Core user actions regress quickly without interaction tests for command buttons, character sheet entry, and modal behavior. | Pick one focused core UI surface and add or refresh tests against current components. | Focused Vitest/RTL proof for the selected surface. |
| G5 | active | test_coverage | testing-overhaul maintainer | Character creator testing stream | phase backlog import | Character creator flow still needs coverage around step navigation, selections, validation, and finalization. | Retired `02-CHARACTER-CREATOR.md`; retired `02-COMPLEX-INTERACTIVE.md`; `src/components/CharacterCreator` | This is a high-risk multi-step workflow with many branching choices and state transitions. | Select one current character-creator slice and add tests that prove state persists across steps. | Focused CharacterCreator test proof. |
| G6 | active | test_coverage | testing-overhaul maintainer | Gameplay testing stream | phase backlog import | Gameplay surfaces still need coverage decisions for combat, inventory, spellbook, and action-context behavior. | Retired `03-GAMEPLAY-SYSTEMS.md`; `src/components/CharacterSheet`; combat/spell command surfaces | Gameplay UI and runtime contracts can drift independently without focused tests. | Pick one gameplay flow and prove current behavior with a focused test. | Focused test proof for the selected combat/inventory/spellbook slice. |
| G7 | active | test_coverage | testing-overhaul maintainer | Map testing stream | phase backlog import | Map and canvas/submap surfaces still need current coverage decisions after renderer and worldforge changes. | Retired `03-CANVAS-MAP.md`; retired `04-MAP-SYSTEMS.md`; Submap, Battle Map, Worldforge map surfaces | Map rendering and interaction are easy to regress without scoped logic and rendered checks. | Pick one map logic or interaction slice and test it against current architecture. | Focused map test proof; rendered proof when the claim is visual. |
| G8 | active | test_coverage | testing-overhaul maintainer | Hooks/utils testing stream | phase backlog import | Hooks and utilities still need a current prioritization pass against existing tests and exported helper contracts. | Retired `05-UTILITIES.md`; `src/hooks`; `src/utils`; `src/utils/visuals/__tests__/visualUtils.test.ts` | Shared helpers amplify regressions across UI and gameplay systems. | Continue after the first proof by inventorying current hook/util tests, then add the next missing high-value regression. | First proof: generated item SVG paths resolve through `resolveItemVisual`; `npx vitest run src/utils/visuals/__tests__/visualUtils.test.ts` passed with 10 tests. |
| G15 | review-required | blocked_human_decision | Human/project owner / Spell Phase maintainer | Spell granted-action schema | staged spell-integrity rerun 2026-07-10 | Decide how 15 legacy/domain-specific `grantedActions` records map to the canonical action-economy contract. | Systematic spell-integrity failure list; `NORTH_STAR.md` Spell Granted-Action Schema brief | Guessing types, labels, and frequencies would invent combat/UI semantics; widening the validator without runtime mapping would make malformed data look supported. | Choose Option A, B, or C, then migrate representative families with runtime/UI proof. | Validator plus command/UI bridge tests agree for commands, questions, magic actions, sustained effects, and object interactions. |
| G16 | review-required | blocked_human_decision | Human/project owner / Spell Phase maintainer | Spell mode-choice schema | spell-integrity normalization 2026-07-10 | Decide whether shared spell choices support bounded multi-select and per-target scope, or whether Commune with Nature and Conjure Celestial keep spell-specific metadata. | Exact reviewed-debt list in systematic spell validation; `NORTH_STAR.md` Spell Mode-Choice Cardinality And Scope brief | The current contract supports one global choice only. Coercing choose-three or choose-one-per-target behavior into it would silently discard canonical mechanics. | Choose Option A, B, or C before changing these two records or their consumers. | Validator, runtime, and UI tests prove selection bounds and per-target allocation for the selected representation. |

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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/testing-overhaul/GAPS.md","sha256WithoutMarker":"02b639640bb25ea5d320994d7f6187e614f4e8635edf4f98260928cd9f3557d8","markedAtUtc":"2026-06-25T22:29:38.631Z"} -->
