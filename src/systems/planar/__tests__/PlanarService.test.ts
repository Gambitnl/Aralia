
import { describe, it, expect } from 'vitest';
import { PlanarService } from '../PlanarService';
import { createMockGameState } from '../../../utils/factories';
import type { GameState } from '../../../types';

/**
 * This file proves planar mechanics follow the plane attached to the current
 * authored or procedural location.
 *
 * The old location-name convention was temporary and has been retired. These
 * fixtures now register explicit locations so tests exercise the authoritative
 * Location.planeId contract used by live world generation.
 */

// Register the smallest valid procedural location needed by each planar case.
// This preserves the production lookup path without adding fake name parsing.
const placeOnPlane = (gameState: GameState, locationId: string, planeId: string): void => {
  gameState.currentLocationId = locationId;
  gameState.dynamicLocations = {
    ...(gameState.dynamicLocations ?? {}),
    [locationId]: {
      id: locationId,
      name: locationId,
      baseDescription: 'A focused planar service test location.',
      exits: {},
      biomeId: 'test',
      planeId,
    },
  };
};

describe('PlanarService', () => {
  it('should return Material Plane by default', () => {
    const gameState = createMockGameState();
    gameState.currentLocationId = 'village_center';

    const plane = PlanarService.getCurrentPlane(gameState);
    expect(plane.id).toBe('material');
    expect(plane.timeFlow).toBe('normal');
  });

  it('detects the Feywild from authoritative location data', () => {
    const gameState = createMockGameState();
    placeOnPlane(gameState, 'feywild_forest_clearing', 'feywild');

    const plane = PlanarService.getCurrentPlane(gameState);
    expect(plane.id).toBe('feywild');
    expect(plane.timeFlow).toBe('erratic');
    expect(plane.emotionalValence).toBe('chaotic');
  });

  it('should return correct magic modifiers for Feywild', () => {
    const gameState = createMockGameState();
    placeOnPlane(gameState, 'feywild_court', 'feywild');

    const modifier = PlanarService.getMagicModifier(gameState, 'Illusion');
    expect(modifier).toBeDefined();
    expect(modifier?.effect).toBe('empowered');
  });

  it('should return correct atmosphere description', () => {
    const gameState = createMockGameState();
    placeOnPlane(gameState, 'shadowfell_keep', 'shadowfell');

    const atmosphere = PlanarService.getAtmosphere(gameState);
    expect(atmosphere).toContain('Colors are muted');
  });

  it('should handle Shadowfell specific mechanics access', () => {
      const gameState = createMockGameState();
      placeOnPlane(gameState, 'shadowfell_graveyard', 'shadowfell');

      const effects = PlanarService.getCurrentPlanarEffects(gameState);
      expect(effects?.affectsMortality?.deathSavingThrows).toBe('disadvantage');
  });
});
