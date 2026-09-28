/**
 * @file src/context/AIConfigContext.tsx
 *
 * Supplies the tunable AI pacing configuration to the combat tree.
 *
 * The AI "thinking" delay used to be a fixed import of AI_THINKING_DELAY_MS, so
 * nothing could vary it at runtime. This context keeps the same defaults but
 * lets a host override the per-difficulty delays and give an individual monster
 * its own pace (a ponderous ogre, a darting imp).
 *
 * The context has a default value, so useAIConfig() works with no provider
 * mounted. Existing callers and tests keep the previous behavior unchanged.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { AI_THINKING_DELAY_MS, type CombatDifficulty } from '../config/combatConfig';

export interface AIConfig {
  /** Thinking delay in milliseconds, one entry per difficulty. */
  thinkingDelayMs: Record<CombatDifficulty, number>;
  /**
   * Delay overrides in milliseconds for one specific creature, keyed by
   * character id or by template id. A character id wins over a template id.
   */
  perMonsterOverrides: Record<string, number>;
}

/** The behavior the hook had before the context existed. */
export const DEFAULT_AI_CONFIG: AIConfig = {
  thinkingDelayMs: { ...AI_THINKING_DELAY_MS },
  perMonsterOverrides: {}
};

const AIConfigContext = createContext<AIConfig>(DEFAULT_AI_CONFIG);

export interface AIConfigProviderProps {
  /** Partial override; every field left out keeps its default. */
  value?: Partial<AIConfig>;
  children?: React.ReactNode;
}

export const AIConfigProvider: React.FC<AIConfigProviderProps> = ({ value, children }) => {
  const merged = useMemo<AIConfig>(() => ({
    thinkingDelayMs: { ...DEFAULT_AI_CONFIG.thinkingDelayMs, ...(value?.thinkingDelayMs ?? {}) },
    perMonsterOverrides: { ...DEFAULT_AI_CONFIG.perMonsterOverrides, ...(value?.perMonsterOverrides ?? {}) }
  }), [value]);

  return <AIConfigContext.Provider value={merged}>{children}</AIConfigContext.Provider>;
};

/** Read the AI pacing configuration. Falls back to the defaults with no provider. */
export const useAIConfig = (): AIConfig => useContext(AIConfigContext);

/**
 * Resolve one creature's thinking delay: a per-character override first, then a
 * per-template override, then the difficulty delay.
 */
export const resolveThinkingDelayMs = (
  config: AIConfig,
  difficulty: CombatDifficulty,
  characterId?: string | null,
  templateId?: string | null
): number => {
  if (characterId && characterId in config.perMonsterOverrides) {
    return config.perMonsterOverrides[characterId];
  }
  if (templateId && templateId in config.perMonsterOverrides) {
    return config.perMonsterOverrides[templateId];
  }
  return config.thinkingDelayMs[difficulty] ?? DEFAULT_AI_CONFIG.thinkingDelayMs[difficulty];
};

export default AIConfigContext;
