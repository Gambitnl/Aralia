# NPCs Data (`src/data/world/npcs.ts`)

## Purpose

The `src/data/world/npcs.ts` file defines all the Non-Player Characters (NPCs) that can be encountered in the Aralia RPG. This data provides the base information for NPCs, which can then be used by the game system and the AI (Gemini) to generate interactions.

## Structure

The file exports a single constant:

*   **`NPCS: Record<string, NPC>`**
    *   This is an object where each key is a unique string identifier for an NPC (e.g., `'old_hermit'`, `'nervous_scout'`). This ID is used internally to reference the NPC.
    *   The value for each key is an `NPC` object, defined in `src/types.ts`.

### `NPC` Object Properties

Each `NPC` object has the following properties (as defined in `src/types.ts`):

*   **`id: string`**: The unique identifier for the NPC.
*   **`name: string`**: The display name of the NPC.
*   **`baseDescription: string`**: A basic textual description of the NPC's appearance or demeanor. This can be used as a starting point for AI-generated descriptions or player information.
*   **`dialoguePromptSeed?: string`**: An optional seed phrase or initial context for the Gemini API to start generating dialogue for this NPC. This helps in giving the NPC a consistent voice or starting point for conversations.
*   **`voice?: TTSVoiceOption`**: An optional field to associate a specific Text-to-Speech voice (from `TTS_VOICE_OPTIONS` in `src/data/settings/ttsOptions.ts`) with the NPC. This is not currently implemented in the example `NPCS` data but the type supports it.

## Example Entry

```typescript
// From src/data/world/npcs.ts
export const NPCS: Record<string, NPC> = {
  'old_hermit': {
    id: 'old_hermit',
    name: 'Old Hermit',
    baseDescription: 'A weathered old man with kind eyes, dressed in simple robes.',
    dialoguePromptSeed: 'The hermit looks up as you approach, a faint smile on his lips.'
  },
  // ... other NPCs
};
```

## Usage

*   **`src/constants.ts`**: Imports and re-exports `NPCS` for global access.
*   **`src/data/world/locations.ts`**: `Location` objects can reference NPC IDs in their `npcIds` array to specify which NPCs are present in that location.
*   **`App.tsx`**:
    *   Uses `NPCS` to get full NPC details when displaying NPCs in the current location (`getCurrentNPCs` function).
    *   The `talk` action in `processAction` uses `NPCS` data (like `name` and `dialoguePromptSeed`) to interact with the `geminiService` for generating NPC responses.

## Adding a New NPC

1.  Define a new entry in the `NPCS` object in `src/data/world/npcs.ts`.
2.  Ensure the `id` is unique.
3.  Provide the `name` and `baseDescription`.
4.  Optionally, add a `dialoguePromptSeed` to guide AI interactions.
5.  Optionally, assign a `voice` if specific TTS voices are desired for this NPC.
6.  To place the NPC in the game world, add its `id` to the `npcIds` array of one or more `Location` objects in `src/data/world/locations.ts`.