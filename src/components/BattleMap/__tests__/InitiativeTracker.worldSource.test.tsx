/**
 * This file guards compact identity for WorldForge-derived defenders.
 *
 * The first rendered force exposed two visual lies: every defender inherited
 * the generic orc emblem and every turn card shortened to the same state name.
 * These assertions keep military role labels and a neutral regiment emblem in
 * place until dedicated guard portrait art exists.
 *
 * Covers: initiativeShortLabel and getCreatureTokenVisual
 */
import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { getCreatureTokenVisual } from '../../../utils/visuals/combatIconVisuals';
import { initiativeShortLabel } from '../InitiativeTracker';

// ============================================================================
// Source Defender Identity
// ============================================================================

describe('WorldForge defender combat identity', () => {
  const archer = createMockCombatCharacter({
    id: 'worldforge-defender:14:0:archers:2',
    name: 'Turino Archer 2',
    team: 'enemy',
    worldSource: {
      kind: 'worldforge-defender',
      burgId: 14,
      stateId: 14,
      regimentIndex: 0,
      unitType: 'archers',
      representativeIndex: 2,
    },
  });

  it('shows role and representative number in the compact turn strip', () => {
    expect(initiativeShortLabel(archer)).toBe('Archer 2');
  });

  it('uses a regiment visual instead of the generic enemy-orc fallback', () => {
    const visual = getCreatureTokenVisual(archer);

    expect(visual.src).toBeTruthy();
    expect(visual.label).toContain('archer from a WorldForge regiment');
    expect(visual.label).not.toContain('orc');
  });
});
