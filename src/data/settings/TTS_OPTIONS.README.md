# TTS Voice Options Data (`src/data/settings/ttsOptions.ts`)

## Purpose

The `src/data/settings/ttsOptions.ts` file defines the list of available Text-to-Speech (TTS) voice options that can be used in the Aralia RPG. This data provides a selection of voices with different characteristics for synthesizing NPC dialogue or other game narration.

## Structure

The file exports a single constant:

*   **`TTS_VOICE_OPTIONS: TTSVoiceOption[]`**
    *   This is an array of `TTSVoiceOption` objects. Each object represents a distinct voice available through the TTS service (presumably Google Gemini's TTS capabilities).
    *   The `TTSVoiceOption` type is defined in `src/types.ts`.

### `TTSVoiceOption` Object Properties

Each `TTSVoiceOption` object has the following properties (as defined in `src/types.ts`):

*   **`name: string`**: The voice_name identifier used by the TTS API (e.g., "Zephyr", "Kore", "Charon"). This is the actual value passed to the API.
*   **`characteristic: string`**: A descriptive characteristic of the voice (e.g., "Bright", "Firm", "Informative"). This helps developers or designers choose an appropriate voice for a given character or context.

## Example Entry

```typescript
// From src/data/settings/ttsOptions.ts
export const TTS_VOICE_OPTIONS: TTSVoiceOption[] = [
  { name: 'Zephyr', characteristic: 'Bright' },
  { name: 'Puck', characteristic: 'Upbeat' },
  { name: 'Charon', characteristic: 'Informative' },
  // ... more voice options
];
```

## Usage

*   **`src/constants.ts`**: Imports and re-exports `TTS_VOICE_OPTIONS` for global access.
*   **`src/services/ttsService.ts`**: The `synthesizeSpeech` function uses a default voice name (e.g., 'Kore') which is one of the `name` values from this list. The service could be enhanced to accept a `voiceName` parameter, allowing different voices from this list to be used.
*   **NPC Definition (Future/Optional)**: NPC data in `src/data/world/npcs.ts` could optionally include a reference to a `TTSVoiceOption` (or just its `name`) to assign a specific voice to an NPC, though this is not currently implemented in the example `NPCS` data. The `NPC` type in `src/types.ts` already supports an optional `voice?: TTSVoiceOption;` field.
*   **Developer Reference**: Provides a clear list of available voices for developers when choosing TTS outputs.

## Adding or Modifying Voice Options

1.  To add a new voice, append a new `TTSVoiceOption` object to the `TTS_VOICE_OPTIONS` array. Ensure the `name` matches the identifier supported by the TTS API and provide an accurate `characteristic`.
2.  To modify an existing voice's characteristic or correct its name, edit the corresponding object in the array.
3.  Removing a voice option would involve deleting its object from the array. Ensure any parts of the application hardcoding that voice name are updated.