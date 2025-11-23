
# TTS Service (`src/services/ttsService.ts`)

## Purpose

The `ttsService.ts` module is responsible for handling all Text-to-Speech (TTS) functionality within the Aralia RPG application. It provides a clean interface to convert text strings into audible speech data by leveraging the native TTS capabilities of the Google Gemini API.

This service uses the centralized `ai` client instance from `aiClient.ts`, ensuring consistent API interaction and key management.

## Core Functionality

The service exports one primary asynchronous function:

### `synthesizeSpeech(text: string, voiceName?: string): Promise<string>`

*   **Purpose**: Takes a string of text and synthesizes it into speech audio data.
*   **Parameters**:
    *   `text: string`: The text content to be converted into speech.
    *   `voiceName?: string`: Optional. The specific `voiceName` identifier for a Gemini prebuilt voice (e.g., 'Kore', 'Puck', 'Charon'). If not provided, it defaults to a predefined `DEFAULT_VOICE_NAME` ('Kore').
*   **Process**:
    1.  Calls the Gemini API (`ai.models.generateContent`) using the model specified in `GEMINI_MODEL_TTS` from `src/config.ts`.
    2.  Sets the `responseModalities` config to `['AUDIO']` to instruct the API to return audio data.
    3.  Configures the `speechConfig` with the chosen `voiceName`.
    4.  Extracts the base64 encoded audio data string from the `inlineData.data` field of the API response.
*   **Returns**: A `Promise<string>` that resolves to the base64 encoded audio string. This string contains raw PCM audio data (24kHz, 16-bit, mono) which can then be played by an audio handler like the `useAudio` hook.
*   **Error Handling**: Includes a `try/catch` block. If the Gemini API call fails or if the response does not contain the expected audio data, it logs the issue and throws an error, which can be caught by the calling function.

## Usage

The `synthesizeSpeech` function is primarily called by the `useGameActions` hook after receiving a text response from another Gemini service call (e.g., `generateNPCResponse` or `generateOracleResponse`).

```typescript
// Example usage in useGameActions.ts
import { synthesizeSpeech } from '../services/ttsService';
// ...

// After getting an NPC response:
const npcResponseResult = await GeminiService.generateNPCResponse(...);

if (npcResponseResult.text && npc.voice) {
    try {
        const audioContent = await synthesizeSpeech(npcResponseResult.text, npc.voice.name);
        await playPcmAudio(audioContent); // playPcmAudio is from useAudio hook
    } catch (ttsError) {
        // Handle TTS-specific error
    }
}
```

## Dependencies

*   **`@google/genai`**: For the `GenerateContentResponse` type.
*   **`../services/aiClient.ts`**: For the shared, initialized `ai` client instance.
*   **`../config.ts`**: For the `GEMINI_MODEL_TTS` constant.
*   **`../types.ts`**: For the `TTSVoiceOption` type (implicitly via NPC objects that may contain a voice).
