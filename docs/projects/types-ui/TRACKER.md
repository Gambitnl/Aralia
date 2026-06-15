# Types Ui Living Tracker

Status: active  
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue
| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T3 | not_started | Document and decide component type registry strategy | Worker B | 2026-05-31 | `src/components/types/index.ts` | Confirm whether a dedicated component registry layer is needed | Decision log update in this project |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Decisions in scope
- Keep implementation scope unchanged until implementation resumes in `src/` code.
- Preserve evidence-first notes: this project is now positioned as a continuity surface, not a cleanup pass.

## Update rules

- Active or new tasks stay in this file.
- Long-lived findings move to `GAPS.md` with clear proof and next checks.
- If the scope expands beyond this project, update this row first before creating cross-project debt.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
