# Conversation Panel (absorbed project notes)

Absorbed from `docs/projects/conversation-panel/` on 2026-07-16 (planning-surface
absorption wave). Planmap topic: `conversation-panel`.

## What it is

Conversation Panel is the UI and state lane for direct companion chat
(`@mention`, free text, AI response). It is intentionally SEPARATE from
topic-based NPC dialogue (`DialogueInterface`). Companion talk uses
`START_CONVERSATION`; NPC talk stays topic dialogue via
`START_DIALOGUE_SESSION`. Keep the two lanes distinct.

## File map

- `src/components/ConversationPanel/ConversationPanel.tsx` — renders when
  `gameState.phase === GamePhase.PLAYING && gameState.activeConversation`;
  input/send/close lock to pending state and player turn
- `src/hooks/useConversation.ts` — start/send/end flow and memory
  summarization; `sendPlayerMessage` returns early when not player turn
- `src/state/reducers/conversationReducer.ts` — `START_CONVERSATION`,
  `ADD_CONVERSATION_MESSAGE` (flips `isPlayerTurn`),
  `SET_CONVERSATION_PENDING`, `END_CONVERSATION`
- `src/hooks/actions/handleNpcInteraction.ts` — companion branch of `talk`
  dispatches `START_CONVERSATION` (ends any active topic dialogue first);
  NPC branch unchanged
- `src/state/appState.ts` — clears `activeConversation` on `SET_GAME_PHASE`
  (menu/character creation), `MOVE_PLAYER`, and `LOAD_GAME_SUCCESS`
- `src/state/initialState.ts` — `activeConversation: null` initialized
- Separate lane (do not merge): `src/components/Dialogue/DialogueInterface.tsx`,
  `src/hooks/useDialogueSystem.ts`

## Built (evidence dated 2026-06-08)

- Companion talk opens the panel through `START_CONVERSATION`
- Player-turn plus pending-response gating enforced in hook and panel UI
- Stale conversation state cannot survive movement, load, or phase changes

## Open gap (CP-004)

Companion banter (`src/hooks/useCompanionBanter.ts`) and interactive
conversation can overlap without an exclusivity policy. The policy decision is
OWNED by the code-modularization audit, gap `CMA-G12` — do not expand
Conversation Panel scope until that boundary note and sequencing policy exist.
