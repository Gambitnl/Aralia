// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 03:42:06
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/combat/useVisibility.ts
 * Hook to integrate the VisibilitySystem with the React lifecycle.
 * Calculates light levels and visible tiles for the active character (or all players).
 */

import { useMemo } from 'react';
import { CombatState, LightLevel } from '../../types/combat';
import { VisibilitySystem } from '../../systems/visibility';
import { isPositionInArea } from '../../systems/spells/effects/triggerHandler';

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

function zoneCreatesMagicalDarkness(zone: NonNullable<CombatState['spellZones']>[number]): boolean {
  return zone.spellId === 'darkness' || zone.effects.some(effect => {
    // Darkness data stores its sight rule as a structured utility payload. The
    // spell-zone type deliberately keeps effects broad, so inspect the optional
    // perception field at this boundary instead of forcing every effect into a
    // light-source shape.
    const perceptionState = (effect as { perceptionState?: { kind?: string } }).perceptionState;
    return perceptionState?.kind === 'magical_darkness_block';
  });
}

function applyMagicalDarknessZones(
  baseLightLevels: Map<string, LightLevel>,
  combatState: CombatState
): Map<string, LightLevel> {
  const { mapData, spellZones } = combatState;
  if (!mapData || !spellZones?.length) return baseLightLevels;

  const darknessZones = spellZones.filter(zone => zone.areaOfEffect && zoneCreatesMagicalDarkness(zone));
  if (!darknessZones.length) return baseLightLevels;

  const nextLevels = new Map(baseLightLevels);
  for (const [, tile] of mapData.tiles) {
    const isInMagicalDarkness = darknessZones.some(zone =>
      isPositionInArea(tile.coordinates, zone.position, zone.areaOfEffect!, zone.direction)
    );
    if (isInMagicalDarkness) {
      nextLevels.set(tile.id, 'magical_darkness');
    }
  }

  return nextLevels;
}

export const useVisibility = ({ combatState, activeCharacterId, viewerId }: UseVisibilityProps): UseVisibilityResult => {
  const { mapData, activeLightSources, characters } = combatState;

  // 1. Calculate Light Levels
  // Memoized: Only recalculate if light sources or map changes.
  // Note: activeLightSources should include dynamic lights (torches on moving characters).
  const lightLevels = useMemo(() => {
    if (!mapData) return new Map<string, LightLevel>();

    // Determine ambient light based on theme (or default to darkness for Underdark)
    // TODO #296: Add `ambientLight` to BattleMapData schema properly. For now, infer or default.
    const ambient = mapData.theme === 'cave' || mapData.theme === 'dungeon' ? 'darkness' : 'bright';

    // If ambient is bright, we can skip calculation unless we have magical darkness (future proofing)
    if (ambient === 'bright') {
        const fullMap = new Map<string, LightLevel>();
        mapData.tiles.forEach(t => fullMap.set(t.id, 'bright'));
        return applyMagicalDarknessZones(fullMap, combatState);
    }

    // Pass only expected arguments. VisibilitySystem doesn't accept 'ambient' string yet in my implementation.
    // My implementation signature is: calculateLightLevels(mapData, lightSources)
    // The previous code passed 'ambient'. I need to fix this call.
    return applyMagicalDarknessZones(
      VisibilitySystem.calculateLightLevels(mapData, activeLightSources),
      combatState
    );
  }, [mapData, activeLightSources, combatState]);

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
