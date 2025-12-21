
import { describe, it, expect } from 'vitest';
import { PlanarService } from '../PlanarService';
import { PLANES } from '../../../data/planes';
import { GameState } from '../../../types/index';
import { createMockGameState } from '../../../utils/factories';

describe('PlanarService', () => {
  it('should return Material Plane by default', () => {
    const gameState = createMockGameState();
    gameState.currentLocationId = 'village_center';

    const plane = PlanarService.getCurrentPlane(gameState);
    expect(plane.id).toBe('material');
    expect(plane.timeFlow).toBe('normal');
  });

  it('should detect Feywild based on location ID convention (temporary logic)', () => {
    const gameState = createMockGameState();
    gameState.currentLocationId = 'feywild_forest_clearing';

    const plane = PlanarService.getCurrentPlane(gameState);
    expect(plane.id).toBe('feywild');
    expect(plane.timeFlow).toBe('erratic');
    expect(plane.emotionalValence).toBe('chaotic');
  });

  it('should return correct magic modifiers for Feywild', () => {
    const gameState = createMockGameState();
    gameState.currentLocationId = 'feywild_court';

    const modifier = PlanarService.getMagicModifier(gameState, 'Illusion');
    expect(modifier).toBeDefined();
    expect(modifier?.effect).toBe('empowered');
  });

  it('should return correct atmosphere description', () => {
    const gameState = createMockGameState();
    gameState.currentLocationId = 'shadowfell_keep';

    const atmosphere = PlanarService.getAtmosphere(gameState);
    expect(atmosphere).toContain('Colors are muted');
  });

  it('should handle Shadowfell specific mechanics access', () => {
      const gameState = createMockGameState();
      gameState.currentLocationId = 'shadowfell_graveyard';

      const effects = PlanarService.getCurrentPlanarEffects(gameState);
      expect(effects?.affectsMortality?.deathSavingThrows).toBe('disadvantage');
  });
});
