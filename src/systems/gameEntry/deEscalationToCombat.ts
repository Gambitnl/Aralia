/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/deEscalationToCombat.ts
 * Pure transform: a hostile scene's SituationThreat → the Monster[] payload the
 * combat entry point (handleStartBattleMapEncounter) consumes.
 */
import type { Monster } from '../../types/world';
import type { SituationThreat } from './types';

export function threatToMonsters(threat: SituationThreat): Monster[] {
  return threat.enemies
    .filter((e) => typeof e.name === 'string' && e.name.trim().length > 0 && e.quantity > 0)
    .map((e) => ({
      name: e.name.trim(),
      quantity: e.quantity,
      cr: String(e.cr ?? '').trim() || '0',
      description: `${e.name.trim()} · CR ${String(e.cr ?? '').trim() || '0'}`,
    }));
}
