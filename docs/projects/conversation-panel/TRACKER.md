# Conversation Panel Tracker

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
| T1 | done | Document concrete Conversation Panel state map, integrations, and gaps in `docs/projects/conversation-panel/` | Worker | 2026-05-31 | `docs/projects/conversation-panel/NORTH_STAR.md`, `src/components/ConversationPanel`, `src/hooks/useConversation.ts`, `src/state/appState.ts` | Start/continue implementation slice for startability semantics | `NORTH_STAR.md` + `GAPS.md` updated |
| T2 | done | Resolve trigger and exclusivity behavior between `activeConversation` and `activeDialogueSession` | Project owner | 2026-06-08 | `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/state/appState.ts`, `src/state/initialState.ts` | `START_CONVERSATION` now dispatches from `talk` actions with companion targets and `isPlayerTurn` gates interaction | keep exclusivity decision in `docs/projects/code-modularization-audit/CMA-G12` | confirm CP-001/CP-002 closure evidence in `NORTH_STAR.md` + `GAPS.md` |
| T3 | active | Coordinate `activeConversation` vs `activeDialogueSession` exclusivity with code modularization audit (`CMA-G12`) | Project owner | 2026-06-08 | `docs/projects/code-modularization-audit`, `src/hooks/useCompanionBanter.ts`, `src/hooks/useDialogueSystem.ts` | Route policy decision and sequencing for cross-flow exclusivity before broader expansion | capture decision, then keep this project slice bounded | handoff or proof summary from CMA owner |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 / CP-001 | done | adjacent_follow_up | Project owner | `docs/projects/conversation-panel/GAPS.md` | Source/behavioral implementation | `START_CONVERSATION` had no gameplay dispatch path outside `useConversation` | `rg -n START_CONVERSATION src`, `src/hooks/actions/handleNpcInteraction.ts` | Without a path, `talk` actions never opened the panel flow | resolved by adding `START_CONVERSATION` dispatch in `handleTalk` for companion targets | evidence in `NORTH_STAR.md` + runtime-ready manual flow |
| G2 / CP-002 | done | in_scope_now | Project owner | `docs/projects/conversation-panel/TRACKER.md` | Implementation | `isPlayerTurn` was set in reducer but not used to block input and sends | `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx` | Prevented predictable turns and could allow requests out of turn | resolved by `isInteractionLocked = pendingResponse || !isPlayerTurn` on send/close/input gating | add focused scenario check for turn flip |
| G3 / CP-003 | done | support_needed_now | Project owner | `docs/projects/conversation-panel/GAPS.md` | Source implementation | `activeConversation` shape lacked initialization and movement/reset reset | `src/state/initialState.ts`, `src/state/appState.ts` | Stale conversation state could persist across load/load/scene transitions | closed by initialization and activeConversation nulling on phase transition/move/load | startup/load smoke check |
| G4 / CP-004 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit/CMA-G12` | cross-project design review | Companion banter and interactive conversation timing can overlap during future modularization | `src/hooks/useCompanionBanter.ts`, `src/hooks/useConversation.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/reducers/dialogueReducer.ts` | Adjacent decisions can blur exclusive UX and turn expectations | coordinate policy with CMA before adjacent work | keep one lane policy documented before expansion |

## Update Rules

- Keep this tracker in sync with the active documentation slice and real decisions.
- Active rows should include owner, last updated date, evidence, next action, and next proof.
- Move unresolved items to `GAPS.md` with explicit evidence and follow-up condition.
- Keep out-of-project items in `docs/projects/GLOBAL_GAPS.md`.
