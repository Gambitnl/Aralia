/**
 * @file src/hooks/useAiCredentials.ts
 * React binding for the runtime AI credential store. Re-renders when the
 * player's Gemini fallback settings change.
 */

import { useSyncExternalStore } from 'react';
import {
  AiCredentialsState,
  getAiCredentials,
  subscribeAiCredentials,
} from '../services/ai/aiCredentials';

/** Subscribe to the current AI credential state. */
export function useAiCredentials(): AiCredentialsState {
  return useSyncExternalStore(
    subscribeAiCredentials,
    getAiCredentials,
    getAiCredentials,
  );
}
