# Character Creator Tracker

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
| T1 | done | Create initial living-project scaffold for character-creator docs | codex-spark worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `docs/projects/character-creator/*` | Initial files now exist | Verified in docs set and scope-only constraint |
| T2 | done | Replace scaffold-only registry surface with implementation-grounded NORTH_STAR + align TRACKER/GAPS | codex-spark worker | 2026-05-31 | `src/components/CharacterCreator/CharacterCreator.tsx`; `src/components/CharacterCreator/state/characterCreatorState.ts`; `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Keep project docs synchronized with observed runtime structure and navigation behavior | Compare docs against live code and reducer tests |
| T3 | active | Decide whether feature docs should shift from permissive sidebar navigation to strict gating behavior (if product decision changes) | Worker B | 2026-06-05 | `src/components/CharacterCreator/CreationSidebar.tsx`, `src/components/CharacterCreator/config/sidebarSteps.ts`, `src/components/CharacterCreator/CharacterCreator.tsx` | Use the active G2 gap and the current code-backed flow as the source of truth | Confirm whether permissive sidebar navigation is intentional before any gating change |
| T4 | not_started | Reconcile source documentation drift (README/feature notes vs implementation) | Worker B | 2026-05-31 | `src/components/CharacterCreator/CharacterCreator.README.md`, `docs/architecture/domains/character-creator.md`, `docs/tasks/feature-capabilities/character-creator.md` | Validate which document is canonical and adjust/update notes | Document evidence-backed source-of-truth and remaining diffs |
| T5 | not_started | Track and prioritize wizard/validation edge-case follow-up in project workflow | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Promote into local gap planning and close on implementation handoff | Confirm with registry evidence and product owner |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | codex-spark worker | `docs/projects/character-creator/GAPS.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (Feature/UI Projects row) | Keeps known unresolved edge behavior visible across handoffs | Move to execution task when feature scope is resumed | Concrete validation checklist before release |
| G2 | active | in_scope_now | codex-spark worker | `docs/projects/character-creator/GAPS.md` | docs enrichment | Sidebar allows navigation before completion despite completion checks | Existing code and tests indicate permissive step navigation with step-lock placeholders in render, which can confuse intent if undocumented | Update docs + add explicit product decision note before any UX refinement work | Confirm whether behavior is intentional in acceptance criteria |
| G3 | active | adjacent_follow_up | codex-spark worker | `src/components/CharacterCreator/CharacterCreator.test.tsx` debt | docs enrichment | test file contains TODO lint-intent markers for unused imports | Signals technical debt and potential lint churn for future maintainers | Address in local code task, not this docs-only pass | CI lint check result or test clean-up PR |

## Update Rules

- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/character-creator/GAPS.md`.
- For cross-project or out-of-project artifacts, prefer routing to `docs/projects/GLOBAL_GAPS.md`.
