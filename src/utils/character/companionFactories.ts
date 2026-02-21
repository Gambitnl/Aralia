// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:41:12
 * Dependents: character/index.ts, companionFactories.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/companionFactories.ts
 * Factory functions for creating companions and related data.
 */

import { Companion, CompanionGoal, PersonalityTraits } from '../../types/companions';
import { generateId } from '../core/idGenerator';

export const createDefaultPersonality = (): PersonalityTraits => ({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
  values: [],
  fears: [],
  quirks: [],
});

export const createMockCompanion = (overrides: Partial<Companion> = {}): Companion => {
  return {
    id: overrides.id || generateId(),
    identity: overrides.identity || {
      id: generateId(),
      name: 'Mock Companion',
      race: 'Human',
      class: 'Fighter',
      background: 'Soldier',
      sex: 'Unknown',
      age: 25,
      physicalDescription: 'Placeholder companion',
    },
    personality: overrides.personality || createDefaultPersonality(),
    memories: overrides.memories || [],
    discoveredFacts: overrides.discoveredFacts || [],
    goals: overrides.goals || [],
    relationships: overrides.relationships || {},
    loyalty: overrides.loyalty ?? 50,
    approvalHistory: overrides.approvalHistory || [],
    questline: overrides.questline,
    reactionRules: overrides.reactionRules || [],
  };
};

export const createMockCompanionGoal = (overrides: Partial<CompanionGoal> = {}): CompanionGoal => ({
  id: overrides.id || generateId(),
  description: overrides.description || 'Test Goal',
  isSecret: overrides.isSecret || false,
  status: overrides.status || 'active',
  progress: overrides.progress || 0,
});
