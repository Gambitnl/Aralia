/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/companionFactories.ts
 * Factory functions for creating companions and related data.
 */

import { Companion, CompanionGoal, PersonalityTraits } from '../types/companions';

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
    id: overrides.id || crypto.randomUUID(),
    identity: overrides.identity || {
      id: crypto.randomUUID(),
      name: 'Mock Companion',
      race: 'Human',
      class: 'Fighter',
      background: 'Soldier',
    },
    personality: overrides.personality || createDefaultPersonality(),
    goals: overrides.goals || [],
    relationships: overrides.relationships || {},
    loyalty: overrides.loyalty ?? 50,
    approvalHistory: overrides.approvalHistory || [],
    questline: overrides.questline,
  };
};

export const createMockCompanionGoal = (overrides: Partial<CompanionGoal> = {}): CompanionGoal => ({
  id: overrides.id || crypto.randomUUID(),
  description: overrides.description || 'Test Goal',
  isSecret: overrides.isSecret || false,
  status: overrides.status || 'active',
  progress: overrides.progress || 0,
});
