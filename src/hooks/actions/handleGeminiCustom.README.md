# Gemini Custom Action Handler (`handleGeminiCustom.ts`)

## Purpose

The `handleGeminiCustom` function is a specialized action handler responsible for processing `gemini_custom_action` actions. These are the unique, contextual actions suggested by the Gemini AI. This handler contains the critical logic for resolving social skill checks and applying their consequences, including updating NPC goals and creating discoverable "Event Residue" from the player's actions.

## Function Signature

```typescript
async function handleGeminiCustom(props: HandleGeminiCustomProps): Promise<void>;

interface HandleGeminiCustomProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  generalActionContext: string;
  getCurrentLocation: GetCurrentLocationFn; // New dependency
}
```

## Core Functionality

The handler's logic branches based on the action's payload:

### 1. Social Skill Checks (`payload.check` is present)

This is the primary logic for resolving actions like Persuasion, Deception, or Intimidation.

1.  **DC Calculation**:
    *   It calculates a dynamic Difficulty Class (DC) for the check.
    *   It starts with a base DC and then applies modifiers based on the target NPC's memory by calling `assessPlausibility` from `socialUtils.ts`. This utility factors in the NPC's `disposition` and `suspicion` level, making the check easier or harder.

2.  **Player Roll**:
    *   It calculates the player's total roll by simulating a d20 roll and adding the relevant ability modifier and proficiency bonus (if the character is proficient in the skill).

3.  **Outcome Generation**:
    *   It calls `GeminiService.generateSocialCheckOutcome`, passing the skill name, NPC name, success/failure status, and the `generalActionContext` (which includes the NPC's active goals).
    *   This service function returns a structured JSON object containing the narrative outcome, a disposition change value, and an optional `goalUpdate` payload.

4.  **Applying Consequences**:
    *   The narrative text is added to the game log.
    *   `UPDATE_NPC_DISPOSITION` is dispatched with the value from the Gemini response.
    *   `ADD_NPC_KNOWN_FACT` is dispatched to record the outcome of the check in the NPC's memory.
    *   **Goal Updates**: If the Gemini response includes a `goalUpdate` payload, this handler dispatches `UPDATE_NPC_GOAL_STATUS`, adds the new fact, and applies a significant disposition boost, directly linking the social check to the NPC's motivation.
    *   **Suspicion Update**: On a failed Deception or Intimidation check, it dispatches `UPDATE_NPC_SUSPICION` to increase the NPC's wariness.

### 2. General Custom Actions (`payload.geminiPrompt` is present)

For non-skill-check actions, it calls the standard `GeminiService.generateActionOutcome` to get a narrative result and adds it to the log.

### 3. Event Residue Creation (NEW)

After any custom action is processed (both skill checks and general actions), the handler performs this final check:

*   It inspects the `action.payload` for an `eventResidue` object, which the AI is prompted to add for destructive or evidence-leaving actions.
*   If `eventResidue` exists, it:
    1.  Determines a logical `discovererNpcId` for the evidence (e.g., the static NPC who resides at the current location).
    2.  Dispatches an `ADD_LOCATION_RESIDUE` action with the `locationId`, the `text` of the evidence, the `discoveryDc`, and the `discovererNpcId`.
    3.  Adds a message to the game log to give the player a hint that they may have left evidence behind.

Finally, it always dispatches `SET_GEMINI_ACTIONS` with `null` to clear the custom action buttons from the UI.

## Dependencies
*   `geminiService.ts`: For `generateActionOutcome` and `generateSocialCheckOutcome`.
*   `socialUtils.ts`: For `assessPlausibility`.
*   `../constants.ts`: For `NPCS` and `SKILLS_DATA`.
*   `characterUtils.ts`: For `getAbilityModifierValue`.
*   `actionHandlerTypes.ts`: For shared types, including the new `GetCurrentLocationFn`.