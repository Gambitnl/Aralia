# Character Creator Gaps

Status: review-required
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Uncertainty |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/character-creator/TRACKER.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (registry row) | The registry explicitly leaves wizard finalization behavior as unfinished | Move to project execution tasks when implementation resumes | Project-level validation checklist + acceptance criteria |
| G2 | done | decision_recorded | codex-spark worker | `src/components/CharacterCreator/CreationSidebar.tsx` / `src/components/CharacterCreator/config/sidebarSteps.ts` / `src/components/CharacterCreator/CharacterCreator.tsx` | docs enrichment | Sidebar is visibly navigable to incomplete steps, while content still shows locked placeholders at render-time | **Resolved**: Permissive navigation with locked placeholders is intentional. `StepLockedPlaceholder` was added to fix React anti-pattern of dispatch-during-render (causes unstable cycles). Users can freely explore; invalid steps show clear messaging. | No action required - documented as intentional design. | Decision recorded in NORTH_STAR.md and TRACKER.md 2026-06-08 | Behavior confirmed as intentional, not transitional |
| G3 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/CharacterCreator.README.md` / `docs/architecture/domains/character-creator.md` / `docs/tasks/feature-capabilities/character-creator.md` | discovery pass | Source docs have historical drift about pathing and flow assumptions | Prevents wrong assumptions during future rewrites or maintenance | Perform doc harmonization before relying on architecture claims in planning | Consistency pass across these docs |
| G4 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` | test audit | Lint-intent TODOs for intentionally unused aliases exist in flow test | Maintains technical debt risk if lint/quality gating is tightened later | Decide whether to remove/dealias TODO imports in a code pass | Lint output after cleanup task |
| G5 | not_started | support_needed_now | Worker B | `tests/character-creator-flow.spec.ts` | coverage audit | E2E Playwright flow is screenshot-heavy and lacks robust assertions on final game state | Could mask regressions that pass screenshot capture but fail actual completion conditions | Add assertion-level checks for step and completion state if this spec is reused as functional proof | Add stable assertions tied to creator/game transition |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G8 | Code modularization audit routing | Character/race creation files are large split candidates | `src/utils/character/characterUtils.ts`; `src/data/races/racialTraits.ts`; `src/components/CharacterCreator/Race/RaceDetailPane.tsx` | Splitting trait derivation or race presentation should follow defined boundaries. | Define trait derivation and race presentation proof boundaries before any split | `src/utils/character/__tests__/characterUtils.test.ts` plus character-creator navigation decision before any split |
| G7 | not_started | in_scope_now | codex-spark worker | `docs/projects/character-creator/GAPS.md` | cold-start gap discovery | Test in CreationSidebar.test.tsx uses `CreationStep.FeatSelection` alias but sidebar only shows 'Racial Feat' for human race | The test references a step that isn't visible in initial state and uses outdated alias; should validate actual sidebar step labels | Update test to use correct step enum and clarify feat step visibility rules | Test passes against actual sidebar step labels |
| G8 | not_started | adjacent_follow_up | codex-spark worker | `docs/projects/character-creator/NORTH_STAR.md` | cold-start gap discovery | `StepLockedPlaceholder` messages are hardcoded strings scattered across `CharacterCreator.tsx` renderStep switch cases | Makes it harder to maintain consistent messaging and could miss coverage in translations/localization planning | Centralize lock messaging in sidebarSteps.ts config with typed keys | All lock messages extracted to config and test coverage for each placeholder type |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for this slice to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of retaining them here.