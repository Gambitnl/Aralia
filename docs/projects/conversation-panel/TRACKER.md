# Conversation Panel Tracker

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
| T1 | done | Document concrete Conversation Panel state map, integrations, and gaps in `docs/projects/conversation-panel/` | Worker | 2026-05-31 | `src/components/ConversationPanel`, `src/hooks/useConversation.ts`, `src/state/appState.ts`, `src/utils/world/sceneUtils.ts` | Start/continue implementation slice for startability semantics | `NORTH_STAR.md` + `GAPS.md` updated |
| T2 | not_started | Resolve trigger and exclusivity behavior between `activeConversation` and `activeDialogueSession` | Project owner | 2026-06-05 | `src/hooks/useConversation.ts`, `src/hooks/useDialogueSystem.ts`, `src/components/layout/GameModals.tsx`, `src/state/reducers` | Decide whether `START_CONVERSATION` is initiated from action handlers and whether both conversation lanes can be active at once | run focused slice task + targeted checks |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | adjacent_follow_up | Worker | `docs/projects/conversation-panel/GAPS.md` | Documentation harvest | `START_CONVERSATION` has no external dispatch callsite outside `useConversation` | `rg -n START_CONVERSATION src` + hook/component scan | Determines whether `ConversationPanel` is playable in normal flow | add/confirm action trigger path | Add code-path proof + test |
| G2 | active | in_scope_now | Project owner | `docs/projects/conversation-panel/GAPS.md` | Documentation harvest | Turn semantics (`isPlayerTurn`) and blocking logic are inconsistent (`pendingResponse` is used by hook) | `src/state/reducers/conversationReducer.ts`, `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx` | Avoids dead state and undefined behavior during multi-speaker input | align on gating rule and add check or remove field | targeted unit/integration test |
| G3 | active | support_needed_now | Project owner | `docs/projects/conversation-panel/GAPS.md` | Documentation harvest | `activeConversation` is optional in state types and not initialized in `initialState.ts` | `src/types/state.ts`, `src/state/initialState.ts` | Affects save/load and runtime assumptions around focus checks | document and lock policy before further reducer/state changes | persistence and startup smoke check |

## Update Rules

- Keep this tracker in sync with the active documentation slice and real decisions.
- Active rows should include owner, last updated date, evidence, next action, and next proof.
- Move unresolved items to `GAPS.md` with explicit evidence and follow-up condition.
- Keep out-of-project items in `docs/projects/GLOBAL_GAPS.md`.
