# Types Ui Living Tracker

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
## Status vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active task queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Create docs scaffold in `docs/projects/types-ui/` from registry evidence | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Maintain docs-only updates only | North Star, GAPS, Tracker are present and aligned |
| T2 | done | Capture current type export surface and shared UI type context | Worker B | 2026-05-31 | `src/components/types/index.ts`, `src/types/index.ts`, `src/types/ui.ts` | Keep this scope docs accurate without code edits | `docs/projects/types-ui/NORTH_STAR.md` references are complete |
| T3 | not_started | Document and decide component type registry strategy | Worker B | 2026-05-31 | `src/components/types/index.ts` | Confirm whether a dedicated component registry layer is needed | Decision log update in this project |

## Decisions in scope

- Keep implementation scope unchanged until implementation resumes in `src/` code.
- Preserve evidence-first notes: this project is now positioned as a continuity surface, not a cleanup pass.

## Update rules

- Active or new tasks stay in this file.
- Long-lived findings move to `GAPS.md` with clear proof and next checks.
- If the scope expands beyond this project, update this row first before creating cross-project debt.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
