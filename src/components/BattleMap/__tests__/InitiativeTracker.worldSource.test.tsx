/**
 * This file guards compact identity for WorldForge-derived combatants.
 *
 * The first rendered force exposed two visual lies: every defender inherited
 * the generic orc emblem and every turn card shortened to the same state name.
 * These assertions keep military role labels, opening-scene social functions,
 * and a neutral regiment emblem in place until dedicated portrait art exists.
 *
 * Covers: initiativeShortLabel and getCreatureTokenVisual
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { getCreatureTokenVisual } from '../../../utils/visuals/combatIconVisuals';
import { InitiativeTracker, initiativeShortLabel } from '../InitiativeTracker';

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

// ============================================================================
// Opening Threat Social Identity
// ============================================================================

describe('WorldForge opening threat combat identity', () => {
  const wolf = createMockCombatCharacter({
    id: 'opening-wolf-1',
    name: 'Wolf 1',
    team: 'enemy',
    worldSource: {
      kind: 'worldforge-opening-threat',
      sceneReceiptId: 'worldforge-opening-scene:test',
      sourceOpeningReceiptId: 'opening:42:cell:829',
      entityId: 'opening:wolf:1',
      monsterName: 'Wolf',
      monsterOrdinal: 1,
      socialRole: 'scent-flanker',
      worldGroundMeters: { x: 106, z: 197 },
    },
  });

  it('uses scene function instead of repeating only the species name', () => {
    expect(initiativeShortLabel(wolf)).toBe('Scent 1');
  });

  it('exposes explicit navigation when compact turn order can clip actors', () => {
    render(
      <InitiativeTracker
        characters={[wolf]}
        turnState={{
          currentTurn: 1,
          turnOrder: [wolf.id],
          currentCharacterId: wolf.id,
          phase: 'planning',
          actionsThisTurn: [],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Show earlier combatants' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show later combatants' })).toBeInTheDocument();
  });
});
