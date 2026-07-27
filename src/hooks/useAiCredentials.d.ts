/**
 * @file src/hooks/useAiCredentials.ts
 * React binding for the runtime AI credential store. Re-renders when the
 * player's Gemini fallback settings change.
 */
import { AiCredentialsState } from '../services/ai/aiCredentials';
/** Subscribe to the current AI credential state. */
export declare function useAiCredentials(): AiCredentialsState;
