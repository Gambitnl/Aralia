/**
 * @file src/hooks/combat/useVisibility.ts
 * Hook to integrate the VisibilitySystem with the React lifecycle.
 * Calculates light levels and visible tiles for the active character (or all players).
 */

import { useMemo } from 'react';
import { CombatState, CombatCharacter, LightLevel, BattleMapData } from '../../types/combat';
import { VisibilitySystem, VisibilityTier } from '../../systems/visibility';

interface UseVisibilityProps {
  combatState: CombatState;
  activeCharacterId?: string | null; // The character whose vision we are rendering (usually the player's turn or selected character)
  viewerId?: string; // Alternatively, a specific viewer ID (e.g. local player)
}

interface UseVisibilityResult {
  lightLevels: Map<string, LightLevel>;
  visibleTiles: Set<string>;
  canSeeTile: (tileId: string) => boolean;
  getLightLevel: (tileId: string) => LightLevel;
}

export const useVisibility = ({ combatState, activeCharacterId, viewerId }: UseVisibilityProps): UseVisibilityResult => {
  const { mapData, activeLightSources, characters } = combatState;

  // 1. Calculate Light Levels
  // Memoized: Only recalculate if light sources or map changes.
  // Note: activeLightSources should include dynamic lights (torches on moving characters).
  const lightLevels = useMemo(() => {
    if (!mapData) return new Map<string, LightLevel>();

    // Determine ambient light based on theme (or default to darkness for Underdark)
    // TODO: Add `ambientLight` to BattleMapData schema properly. For now, infer or default.
    const ambient = mapData.theme === 'cave' || mapData.theme === 'dungeon' ? 'darkness' : 'bright';

    // If ambient is bright, we can skip calculation unless we have magical darkness (future proofing)
    if (ambient === 'bright') {
        const fullMap = new Map<string, LightLevel>();
        mapData.tiles.forEach(t => fullMap.set(t.id, 'bright'));
        return fullMap;
    }

    // Pass only expected arguments. VisibilitySystem doesn't accept 'ambient' string yet in my implementation.
    // My implementation signature is: calculateLightLevels(mapData, lightSources)
    // The previous code passed 'ambient'. I need to fix this call.
    return VisibilitySystem.calculateLightLevels(mapData, activeLightSources);
  }, [mapData, activeLightSources]);

  // 2. Calculate Visible Tiles for the Viewer
  const visibleTiles = useMemo(() => {
    if (!mapData) return new Set<string>();

    // Determine who is looking
    const observerId = viewerId || activeCharacterId;
    if (!observerId) {
       // If no observer, maybe show everything? Or nothing (Fog of War)?
       // For dev/spectator, show everything. For game, show nothing?
       // Let's assume 'God Mode' if no observer is specified, or empty set.
       // Safe bet: Empty set (blind).
       return new Set<string>();
    }

    const observer = characters.find(c => c.id === observerId);
    if (!observer) return new Set<string>();

    // UPDATE: getVisibleTiles -> calculateVisibility
    // AND: Return type changed from Set to Map<string, VisibilityTier>.
    // Consumers expect Set<string> (of visible IDs).
    const visibilityMap = VisibilitySystem.calculateVisibility(observer, mapData, lightLevels);

    // Filter the map to return a Set of keys where value is NOT 'hidden'
    const visibleSet = new Set<string>();
    visibilityMap.forEach((tier, tileId) => {
      if (tier !== 'hidden') {
        visibleSet.add(tileId);
      }
    });

    return visibleSet;
  }, [mapData, lightLevels, characters, activeCharacterId, viewerId]);

  // Helpers
  const canSeeTile = (tileId: string) => visibleTiles.has(tileId);
  const getLightLevel = (tileId: string) => lightLevels.get(tileId) || 'darkness';

  return {
    lightLevels,
    visibleTiles,
    canSeeTile,
    getLightLevel
  };
};
