/**
 * @file src/systems/combat/commandGameState.ts
 * Builds the minimal GameState view that combat commands read: the live
 * combatants, the battle map, and the current plane.
 *
 * C11 (agora-9ed9.11): moved verbatim from hooks/actionUtils.ts, which
 * re-exports it, so systems/combat code no longer imports hooks.
 */
import type { BattleMapData, CombatCharacter } from '../../types/combat';
import type { GameState } from '../../types';
import type { Plane } from '../../types/planes';

export const buildCommandGameState = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null,
  currentPlane?: Plane
): GameState => ({
  characters,
  mapData: mapData ?? undefined,
  currentPlane
} as unknown as GameState);
