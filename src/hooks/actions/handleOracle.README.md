# Oracle Action Handler (`handleOracle.ts`)

## Purpose

The `handleOracle` function is a specialized action handler responsible for processing the `ask_oracle` action. It manages the player's query to the mystical Oracle, generates a unique response using a specific Gemini service function, and plays back the audio.

After a significant refactor, this handler is now a powerful tool for narrative integration, as the Oracle's responses can directly influence and progress NPC goals.

## Function Signature

```typescript
async function handleOracle(props: HandleOracleProps): Promise<void>;

interface HandleOracleProps {
  action: Action;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  playPcmAudio: PlayPcmAudioFn;
  generalActionContext: string;
}
```

## Core Functionality

1.  **Input Validation**: Checks for a valid `query` string in the action's payload.
2.  **Time Advancement**: Dispatches an `ADVANCE_TIME` action to simulate the time taken for the consultation.
3.  **Goal-Aware Dialogue Generation**:
    *   Instead of a simple text generation function, this handler now calls **`GeminiService.generateSocialCheckOutcome`**.
    *   It passes the `generalActionContext`, which includes the active goals of all nearby NPCs.
    *   The service is prompted to provide its usual cryptic response but is *also* prompted to check if the information being revealed directly satisfies an NPC's goal.
    *   This allows the Gemini API to intelligently signal a `goalUpdate` if, for example, the player asks "Where is the lost lore?" and the Oracle's answer provides the clue the Old Hermit was looking for.

4.  **Response Handling & Goal Progression**:
    *   The narrative part of the Oracle's response is added to the game log and synthesized for TTS playback.
    *   **Crucially, if the structured JSON response from Gemini contains a `goalUpdate` payload, this handler dispatches all the necessary actions to progress that NPC's story arc:**
        *   `UPDATE_NPC_GOAL_STATUS`
        *   `ADD_NPC_KNOWN_FACT` (e.g., "The player learned the location of the lost lore from the Oracle.")
        *   `UPDATE_NPC_DISPOSITION` (with a significant boost for completing a goal).
    *   This creates a direct and powerful link between lore discovery and character relationships.

## Dependencies
*   `geminiService.ts`: For `generateSocialCheckOutcome`.
*   `ttsService.ts`: For `synthesizeSpeech`.
*   `actionHandlerTypes.ts`: For shared function signature types.
