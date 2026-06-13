# Conversation Panel Living Tracker

Status: active  
Last updated: 2026-06-08

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
| T3 | active | Coordinate `activeConversation` vs `activeDialogueSession` exclusivity with code modularization audit (`CMA-G12`) | Project owner | 2026-06-08 | `docs/projects/code-modularization-audit`, `src/hooks/useCompanionBanter.ts`, `src/hooks/useDialogueSystem.ts` | Route policy decision and sequencing for cross-flow exclusivity before broader expansion | capture decision, then keep this project slice bounded | handoff or proof summary from CMA owner |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 / CP-004 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit/CMA-G12` | cross-project design review | Companion banter and interactive conversation timing can overlap during future modularization | `src/hooks/useCompanionBanter.ts`, `src/hooks/useConversation.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/reducers/dialogueReducer.ts` | Adjacent decisions can blur exclusive UX and turn expectations | coordinate policy with CMA before adjacent work | keep one lane policy documented before expansion |

## Update Rules

- Keep this tracker in sync with the active documentation slice and real decisions.
- Active rows should include owner, last updated date, evidence, next action, and next proof.
- Move unresolved items to `GAPS.md` with explicit evidence and follow-up condition.
- Keep out-of-project items in `docs/projects/GLOBAL_GAPS.md`.
