# Dialogue Tracker

Status: active  
Last updated: 2026-05-31

## Status Vocabulary
- `not_started`
- `active`
- `blocked`
- `done`
- `superseded`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|
| D1 | done | Replace scaffold docs with concrete Dialogue implementation snapshot in NORTH_STAR.md | aralia-dialogue | `src/components/Dialogue/DialogueInterface.tsx`, `src/hooks/useDialogueSystem.ts`, `src/services/dialogueService.ts` | Keep files in `docs/projects/dialogue/` only | `docs/projects/dialogue/NORTH_STAR.md` reflects topic flow and integration |
| D2 | active | Track unresolved dialogue gaps and keep this project-level gap list aligned | aralia-dialogue | `docs/projects/dialogue/GAPS.md` | Add and prioritize follow-up gaps tied to evidence | Keep gap status and next proof in GAPS.md |
| D3 | active | Validate current session persistence and memory update path | aralia-dialogue | `src/state/reducers/npcReducer.ts`, `src/state/reducers/dialogueReducer.ts` | Confirm `START/UPDATE/END_DIALOGUE_SESSION` and `DISCUSS_TOPIC` behavior are documented | Re-check reducer/action mapping from action handler to modal closure |

## Change Log

| Date | File | Change | Why | Next check |
|---|---|---|---|---|
| 2026-05-31 | `docs/projects/dialogue/NORTH_STAR.md` | Replaced scaffold with concrete runtime facts | Documentation now reflects implemented system state | Keep synced with future feature changes |
| 2026-05-31 | `docs/projects/dialogue/GAPS.md` | Added implementation-backed gap log and status labels | Preserve unresolved items for cold handoff | Review blocked/human-decision items before next scope expansion |
| 2026-05-31 | `docs/projects/dialogue/TRACKER.md` | Added active tasks for continuity and checks | Make next steps explicit for cold starts | Retire completed tasks in place |

## Update Rules
- Update active tasks when behavior or tests change.
- Keep this tracker aligned with any new durable project risk or follow-up in GAPS.md.
- Use only project-local docs for core decisions; avoid expanding scope to unrelated systems in this tracker.
