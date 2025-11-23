# useAudio Hook (`src/hooks/useAudio.ts`)

## Purpose

The `useAudio` custom React hook encapsulates the logic related to audio playback in the Aralia RPG application. Specifically, it manages:

1.  The `AudioContext` instance required for playing web audio.
2.  The `playPcmAudio` function, which decodes and plays base64 encoded PCM audio data (typically received from a Text-to-Speech service).
3.  Cleanup of the `AudioContext` when the component using the hook unmounts.

## Interface

```typescript
interface UseAudioOutput {
  playPcmAudio: (base64PcmData: string) => Promise<void>;
  cleanupAudioContext: () => void;
}

function useAudio(addMessage: AddMessageFn): UseAudioOutput;
```

*   **`addMessage: AddMessageFn`**: A callback function (typically from `App.tsx`'s `addMessage`) used by `playPcmAudio` to log errors or messages related to audio playback to the game's message log.
    *   `type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;`

## Return Value

The hook returns an object containing:

*   **`playPcmAudio: (base64PcmData: string) => Promise<void>`**:
    *   An asynchronous function that takes a base64 encoded string of PCM audio data.
    *   It initializes or reuses an `AudioContext`.
    *   Decodes the PCM data into an `AudioBuffer`.
    *   Creates an `AudioBufferSourceNode`, connects it to the destination (speakers), and plays the audio.
    *   Handles errors during context creation or audio playback, logging them via the `addMessage` callback.
    *   This function is memoized using `useCallback`.

*   **`cleanupAudioContext: () => void`**:
    *   A function that closes the `AudioContext` if it exists and is not already closed.
    *   This is intended to be called when the component using the hook unmounts (e.g., in a `useEffect` cleanup function) to release audio resources.
    *   This function is memoized using `useCallback`.

## Internal State and Refs

*   **`audioContextRef = useRef<AudioContext | null>(null)`**:
    *   A `useRef` hook to hold the `AudioContext` instance across re-renders without causing re-renders itself when the context is set.

## Constants

The hook defines internal constants for audio processing:
*   `AUDIO_CONTEXT_SAMPLE_RATE` (e.g., 24000 Hz)
*   `PCM_AUDIO_SAMPLE_RATE` (e.g., 24000 Hz)
*   `PCM_AUDIO_BIT_DEPTH` (e.g., 16)
*   `PCM_NORMALIZATION_FACTOR` (e.g., 32768.0)
*   `NUMBER_OF_CHANNELS` (e.g., 1 for mono)

## Usage

```typescript
// In App.tsx or another component that needs audio playback
import { useAudio } from './hooks/useAudio';
// ... other imports ...

const App: React.FC = () => {
  // ... other state and logic ...
  const addMessage = useCallback(/* ... */); // Memoized addMessage function

  const { playPcmAudio, cleanupAudioContext } = useAudio(addMessage);

  useEffect(() => {
    // Cleanup audio context when App unmounts
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  // Example of calling playPcmAudio
  // const handlePlaySomething = async () => {
  //   const base64AudioData = await ttsService.synthesizeSpeech("Hello world");
  //   await playPcmAudio(base64AudioData);
  // };

  // ... rest of the component ...
};
```

## Benefits

*   **Encapsulation**: Isolates audio-related logic from the main component.
*   **Reusability**: Could be used by other components if audio playback needs arise elsewhere (though currently specific to `App.tsx`).
*   **Lifecycle Management**: Provides a `cleanupAudioContext` function for proper resource management.
*   **Clear Dependencies**: Explicitly takes `addMessage` as a dependency.

## Dependencies
*   `react`: For `useRef`, `useCallback`.
*   `../types`: For `GameMessage` (implicitly via `AddMessageFn`).
