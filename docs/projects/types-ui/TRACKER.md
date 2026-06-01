# types UI Tracker

Status: active  
Last updated: 2026-05-31

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
