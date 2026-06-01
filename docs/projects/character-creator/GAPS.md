# Character Creator Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Uncertainty |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/character-creator/TRACKER.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (registry row) | The registry explicitly leaves wizard finalization behavior as unfinished | Move to project execution tasks when implementation resumes | Project-level validation checklist + acceptance criteria |
| G2 | not_started | in_scope_now | Worker B | `src/components/CharacterCreator/CreationSidebar.tsx` / `src/components/CharacterCreator/config/sidebarSteps.ts` / `src/components/CharacterCreator/CharacterCreator.tsx` | docs enrichment | Sidebar is visibly navigable to incomplete steps, while content still shows locked placeholders at render-time | Could produce user confusion unless future behavior decisions are explicit | Capture intended navigation contract and keep docs aligned with tests/UI decisions | Product-level decision + test updates |
| G3 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/CharacterCreator.README.md` / `docs/architecture/domains/character-creator.md` / `docs/tasks/feature-capabilities/character-creator.md` | discovery pass | Source docs have historical drift about pathing and flow assumptions | Prevents wrong assumptions during future rewrites or maintenance | Perform doc harmonization before relying on architecture claims in planning | Consistency pass across these docs |
| G4 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` | test audit | Lint-intent TODOs for intentionally unused aliases exist in flow test | Maintains technical debt risk if lint/quality gating is tightened later | Decide whether to remove/dealias TODO imports in a code pass | Lint output after cleanup task |
| G5 | not_started | support_needed_now | Worker B | `tests/character-creator-flow.spec.ts` | coverage audit | E2E Playwright flow is screenshot-heavy and lacks robust assertions on final game state | Could mask regressions that pass screenshot capture but fail actual completion conditions | Add assertion-level checks for step and completion state if this spec is reused as functional proof | Add stable assertions tied to creator/game transition |

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
