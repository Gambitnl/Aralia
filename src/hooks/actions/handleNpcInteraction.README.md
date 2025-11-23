# NPC Interaction Handler (`handleNpcInteraction.ts`)

## Purpose

The `handleTalk` function is a specialized action handler responsible for processing all player `talk` actions. It manages conversations with Non-Player Characters (NPCs), generates their dialogue using the Gemini API, handles Text-to-Speech (TTS) playback, and updates the NPC's memory.

## Function Signature

```typescript
async function handleTalk(props: HandleTalkProps): Promise<void>;

interface HandleTalkProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  playPcmAudio: PlayPcmAudioFn;
  playerContext: string;
  generalActionContext: string;
}
```

## Core Functionality

1.  **Target Validation**: Ensures the `action.targetId` corresponds to a valid NPC.

2.  **Memory-Enhanced Dialogue Generation**:
    *   Retrieves the target NPC's complete memory from `gameState.npcMemory`. This includes their `disposition`, `knownFacts`, and `goals`.
    *   Constructs a detailed "Memory Context" string. **Crucially, this context now includes the NPC's active goals** (e.g., "Active Goals: ['Wants to find the lost volume of arcane lore.']").
    *   This context is passed to `GeminiService.generateNPCResponse`, allowing the AI to generate dialogue that is not only reactive to past events but also proactive and motivated by the NPC's current objectives.
    *   It also handles follow-up conversations by including the NPC's previous response in the prompt context.

3.  **State Updates**:
    *   Dispatches `SET_LAST_NPC_INTERACTION` to store the conversation context for potential follow-ups.
    *   Dispatches `UPDATE_NPC_DISPOSITION` for minor relationship changes from simple interactions.
    *   Dispatches `ADD_MET_NPC` on the first successful interaction, which adds the NPC to the player's Logbook.

4.  **Message and Audio Output**:
    *   Adds the NPC's dialogue to the game log.
    *   Synthesizes the dialogue to audio via `ttsService` and plays it.

## Dependencies
*   `geminiService.ts`: For `generateNPCResponse`.
*   `ttsService.ts`: For `synthesizeSpeech`.
*   `../constants.ts`: For `NPCS` data.
*   `actionHandlerTypes.ts`: For shared function signature types.
