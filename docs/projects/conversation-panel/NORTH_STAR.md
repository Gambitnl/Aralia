# Conversation Panel North Star

Status: active  
Last updated: 2026-05-31

## Why This Project Exists

Conversation Panel is the dedicated UI and state lane for direct companion chat (`@mention`, free text, AI response).  
It is separate from topic-based NPC dialogue (`DialogueInterface`) and needs stable boundaries so future work does not collapse the two flows.

## Intended Outcome

Create a project-introduced map of the implemented conversation subsystem and current unknowns so the next agent can continue without rediscovering the same source paths.

## Current State

- Core UI exists: `src/components/ConversationPanel/ConversationPanel.tsx` renders only when `gameState.phase === GamePhase.PLAYING && gameState.activeConversation`.
- Core hook exists: `src/hooks/useConversation.ts` owns start/send/end flow, Ollama calls, and memory summary dispatches.
- Core state updates exist: `src/state/reducers/conversationReducer.ts` handles:
  - `START_CONVERSATION`
  - `ADD_CONVERSATION_MESSAGE`
  - `SET_CONVERSATION_PENDING`
  - `END_CONVERSATION`
- State wiring exists:
  - Action types include the four conversation actions in `src/state/actionTypes.ts`
  - Conversation state shape is in `src/types/conversation.ts`
  - `activeConversation?: ActiveConversation | null` is declared in `src/types/state.ts`
  - Conversation reducer is part of the app reducer pipeline in `src/state/appState.ts`
- Existing focus/occupancy checks already treat conversation as a blocking UI mode in `src/utils/world/sceneUtils.ts`.

## Active Task

| Field | Value |
|---|---|
| Task | Document concrete Conversation Panel scope, state map, integration points, and live gaps for cold start |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` under `docs/projects/conversation-panel/` contain concrete implementation evidence and clear unresolved items |
| Allowed boundaries | Only `docs/projects/conversation-panel/NORTH_STAR.md`, `docs/projects/conversation-panel/TRACKER.md`, `docs/projects/conversation-panel/GAPS.md` |
| Stop condition | Stop after doc updates are complete and evidence-backed gaps are recorded |
| Verification | `Get-Content` and `rg` evidence reads completed against `src/components/ConversationPanel`, `src/hooks/useConversation.ts`, `src/state/appState.ts`, `src/types/state.ts`, `src/utils/world/sceneUtils.ts`, `src/components/Dialogue/DialogueInterface.tsx`, `src/components/layout/GameModals.tsx` |
| Owner | Project worker |
| Next action | Address integration/start-up gap for `START_CONVERSATION` and confirm whether it must be tied to an action handler or NPC interaction path |

## Concrete File Map

- `src/components/ConversationPanel/index.ts`: Barrel export for panel.
- `src/components/ConversationPanel/ConversationPanel.tsx`: Renders messages/input, `@` autocomplete, calls `sendPlayerMessage`/`endConversation`.
- `src/components/ConversationPanel/ConversationPanel.css`: Styling for panel, header, messages, and controls.
- `src/hooks/useConversation.ts`: Dispatch-driven state machine + Ollama calls + optional memory summarization.
- `src/state/reducers/conversationReducer.ts`: Creates and mutates `activeConversation`.
- `src/types/conversation.ts`: `ConversationMessage` and `ActiveConversation`.
- `src/types/state.ts`: Includes optional `activeConversation`.
- `src/state/actionTypes.ts`: Conversation action contracts.
- `src/state/appState.ts`: Conversation reducer added in the default pipeline.
- `src/state/initialState.ts`: No `activeConversation` initialization (only optional field in types).
- `src/App.tsx`: Panel mount gate for PLAYING phase.
- `src/utils/world/sceneUtils.ts`: Focus and NPC occupancy checks include `activeConversation`.
- `src/components/Dialogue/DialogueInterface.tsx` and `src/components/layout/GameModals.tsx`: Parallel dialogue UI using `activeDialogueSession` and `isDialogueInterfaceOpen`.
- `src/hooks/useDialogueSystem.ts`: Topic outcome handling for topic-based dialogue.
- `src/hooks/actions/handleNpcInteraction.ts`: NPC talk flow dispatching `START_DIALOGUE_SESSION`.

## Implemented State and Integration

- `START_CONVERSATION` creates `ActiveConversation` with:
  - `participants` from companion IDs,
  - `messages` seeded with initial message,
  - `startedAt`,
  - `isPlayerTurn`,
  - `pendingResponse`.
- `ADD_CONVERSATION_MESSAGE` appends message and flips turn intent.
- `SET_CONVERSATION_PENDING` drives input disablement in the panel and request gating in hook.
- `END_CONVERSATION` resets `activeConversation` to null; memory summary and approval updates are dispatched in `useConversation.endConversation`.
- `activeConversation` and `activeDialogueSession` are separate channels:
  - panel flow keys off `activeConversation` + `ConversationPanel`,
  - topic dialogue flow keys off `isDialogueInterfaceOpen` + `activeDialogueSession` + `DialogueInterface`.
- Focus gating is currently unioned at usage sites (`isPlayerFocused`, `isNpcOccupied`) rather than a central exclusivity guard.

## What Must Not Be Lost

- Keep the distinct difference between free-form companion conversation and topic-based NPC dialogue.
- Keep `activeConversation` optional in state and allow future expansion to multiple participants.
- Keep UI-level gating behavior: panel is in-play only and `startConversation` is currently hook-local unless an action path is added.
- Keep current summary and sentiment hooks in `useConversation.endConversation` as implemented behavior.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `START_CONVERSATION` is never dispatched outside `useConversation`; no obvious NPC/interaction action path opens the panel conversation flow | adjacent_follow_up | Project worker | `useConversation.ts` defines `startConversation`, only `ConversationPanel.tsx` calls `useConversation`; repo-wide search found only reducer/TypeScript references for `START_CONVERSATION` in `useConversation`, `actionTypes`, and `conversationReducer` | decide trigger path (action handler, debug command, or bridge from existing dialogue flow) and add one call site |
| `activeConversation.isPlayerTurn` is set but not consistently used to gate turns | in_scope_now | Project worker | reducer sets/toggles value, `useConversation` gates on `pendingResponse` and state checks | either remove dead intent or add explicit turn checks in UI/hook dispatch boundaries |
| Optional `activeConversation` is not seeded in `initialState.ts` | support_needed_now | Project worker | type is optional in `types/state.ts`; no initializer in `initialState.ts` | confirm this is intentional for save/load compatibility, and document migration policy |

## Global Gap Imports

Check the global gap tracker before expanding scope:
`docs/projects/GLOBAL_GAPS.md` (`No rows currently`).

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | No global gaps currently map to this project |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| UI mount condition for conversation panel | Panel is only visible during playing when `activeConversation` is set | `src/App.tsx:1085` |
| Conversation reducer action coverage | Core lifecycle actions are implemented | `src/state/reducers/conversationReducer.ts` |
| Action contracts | Dispatch contract for the conversation lane exists | `src/state/actionTypes.ts` |
| Hook behavior | Async chat lifecycle, context build, AI calls, summary dispatches | `src/hooks/useConversation.ts` |
| Focus/occupancy effects | Active conversation suppresses focus behavior and NPC occupancy checks | `src/utils/world/sceneUtils.ts` |
| Parallel dialogue UI flow | Separate topic-based path is also present and active | `src/components/layout/GameModals.tsx`, `src/components/Dialogue/DialogueInterface.tsx`, `src/state/reducers/dialogueReducer.ts`, `src/hooks/useDialogueSystem.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor (`Conversation Panel` row) | active |
| `docs/projects/GLOBAL_GAPS.md` | Repo-level routing for cross-project gaps | active |
| `docs/projects/conversation-panel/TRACKER.md` | Queue + owned gaps + verification checkpoints | active |
| `docs/projects/conversation-panel/GAPS.md` | Durable unresolved findings for this project | active |

## Artifact Boundary

Keep durable intent, decisions, and gap evidence here.  
Do not promote runtime logs, full local run output, or temporary diagnostics.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| How should `START_CONVERSATION` be triggered in gameplay flow? | Defines whether `ConversationPanel` becomes user-visible in normal play or remains utility-only | Project owner | Next implementation slice |
| Should `activeConversation` and `activeDialogueSession` be mutually exclusive? | Prevents contradictory UI focus and double-turn handling | Gameplay systems owner | Next implementation slice |

## Resume Path For A Cold Agent

1. Read `docs/projects/conversation-panel/NORTH_STAR.md`.
2. Read `docs/projects/conversation-panel/TRACKER.md`.
3. Read `docs/projects/conversation-panel/GAPS.md`.
4. Read `docs/projects/PROJECT_TRACKER.md` row for Conversation Panel and `docs/projects/GLOBAL_GAPS.md`.
5. Continue from: Resolve trigger/turning semantics for `START_CONVERSATION` and decide cross-flow exclusivity with `activeDialogueSession`.
