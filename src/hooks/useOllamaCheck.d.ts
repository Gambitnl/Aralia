/**
 * @file src/hooks/useOllamaCheck.ts
 * Hook to check Ollama availability on app startup and manage modal state.
 */
import { AppAction } from '../state/actionTypes';
export declare function useOllamaCheck(dispatch: React.Dispatch<AppAction>): {
    ollamaWarningDismissed: boolean;
    setOllamaWarningDismissed: (value: boolean | ((val: boolean) => boolean)) => void;
};
