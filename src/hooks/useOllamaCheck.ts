/**
 * @file src/hooks/useOllamaCheck.ts
 * Hook to check Ollama availability on app startup and manage modal state.
 */

import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { OllamaService } from '../services/OllamaService';
import { AppAction } from '../state/actionTypes';

export function useOllamaCheck(dispatch: React.Dispatch<AppAction>) {
  const [ollamaWarningDismissed, setOllamaWarningDismissed] = useLocalStorage<boolean>(
    'ollama-warning-dismissed',
    false
  );

  useEffect(() => {
    const checkOllama = async () => {
      if (ollamaWarningDismissed) return;

      const isAvailable = await OllamaService.isAvailable();
      if (!isAvailable) {
        dispatch({ type: 'SHOW_OLLAMA_DEPENDENCY_MODAL' });
      }
    };

    checkOllama();
  }, [ollamaWarningDismissed, dispatch]);

  return { ollamaWarningDismissed, setOllamaWarningDismissed };
}
