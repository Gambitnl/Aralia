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
export declare function threatToMonsters(threat: SituationThreat): Monster[];
