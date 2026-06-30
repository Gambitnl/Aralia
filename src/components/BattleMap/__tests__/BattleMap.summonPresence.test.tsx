import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BattleMap from '../BattleMap';
import { SummoningCommand } from '../../../commands/effects/SummoningCommand';
import type { CommandContext } from '../../../commands/base/SpellCommand';
import type { BattleMapData, CombatCharacter, CombatLogEntry, CombatState } from '../../../types/combat';
import type { SummoningEffect } from '../../../types/spells';
import { createMockCombatCharacter } from '../../../utils/core';
import summonBeast from '../../../../public/data/spells/level-2/summon-beast.json';

/**
 * This proof stays at the BattleMap boundary because the map layer already
 * consumes character positions generically. The important boundary is that a
 * live summon created from real spell data survives into the map as a normal
 * positioned combatant, so token rendering and visibility consumers can read
 * it without any summon-only side channel.
 */

const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();
const mockCharacterToken = vi.fn(({ character }: { character: CombatCharacter }) => (
  <div data-testid={`character-${character.id}`} />
));
const mockBattleMapOverlay = vi.fn(() => <div data-testid="battle-map-overlay" />);

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args)
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args)
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args)
}));

vi.mock('../CharacterToken', () => ({
  default: (...args: unknown[]) => mockCharacterToken(...args)
}));

vi.mock('../BattleMapOverlay', () => ({
  default: (...args: unknown[]) => mockBattleMapOverlay(...args)
}));

const createTile = (x: number, y: number) => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: 'floor',
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: []
});

describe('BattleMap summon presence proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: 'summon-beast-caster',
      validMoves: new Set(['0-0', '1-0']),
      activePath: [],
      actionMode: 'move',
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn()
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(),
      teleportDestinationSet: new Set()
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map([
        ['0-0', 'bright'],
        ['1-0', 'bright']
      ]),
      visibleTiles: new Set(['0-0', '1-0']),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => 'bright')
    });
  });

  it('renders a live Summon Beast summon as a positioned map participant', () => {
    const caster = createMockCombatCharacter({
      id: 'summon-beast-caster',
      name: 'Summon Beast Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 14,
      stats: {
        strength: 12,
        dexterity: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 14,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      }
    });
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Air',
      gameState: {}
    } as CommandContext;
    const initialState = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: [] as CombatLogEntry[]
    } as CombatState;

    const summonState = new SummoningCommand(summonEffect, context).execute(initialState);
    const summoned = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id &&
      character.summonMetadata?.initiativePolicy === 'shared'
    );

    expect(summoned).toBeDefined();
    expect(summoned?.position).toEqual(expect.any(Object));
    expect(summonState.characters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: caster.id }),
      expect.objectContaining({ id: summoned?.id })
    ]));

    const mapData: BattleMapData = {
      dimensions: { width: 2, height: 1 },
      tiles: new Map([
        ['0-0', createTile(0, 0)],
        ['1-0', createTile(1, 0)]
      ]),
      theme: 'forest',
      seed: 1
    } as BattleMapData;

    render(
      <BattleMap
        mapData={mapData}
        characters={[caster, summoned!]}
        combatState={{
          turnManager: {
            turnState: {
              currentTurn: 1,
              turnOrder: [caster.id, summoned!.id],
              currentCharacterId: caster.id,
              phase: 'action',
              actionsThisTurn: []
            },
            activeLightSources: [],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            spellDeliveryVisuals: [],
            canAffordAction: vi.fn(() => true)
          } as never,
          turnState: {
            currentTurn: 1,
            turnOrder: [caster.id, summoned!.id],
            currentCharacterId: caster.id,
            phase: 'action',
            actionsThisTurn: []
          } as never,
          abilitySystem: {
            targetingMode: false,
            selectedAbility: null,
            aoePreview: null,
            teleportDestinationPreview: null,
            pendingTeleportAssignment: null,
            previewAoE: vi.fn(),
            isValidTarget: vi.fn(),
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn()
          } as never,
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    expect(mockUseBattleMap).toHaveBeenCalledWith(
      mapData,
      expect.arrayContaining([
        expect.objectContaining({ id: caster.id }),
        expect.objectContaining({ id: summoned!.id, isSummon: true })
      ]),
      expect.any(Object),
      expect.any(Object)
    );
    expect(mockUseVisibility).toHaveBeenCalledWith(expect.objectContaining({
      combatState: expect.objectContaining({
        characters: expect.arrayContaining([
          expect.objectContaining({ id: caster.id }),
          expect.objectContaining({ id: summoned!.id, isSummon: true })
        ])
      })
    }));
    expect(screen.getByTestId(`character-${summoned!.id}`)).toBeInTheDocument();
    expect(mockCharacterToken).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({ id: summoned!.id }),
        position: summoned!.position
      }),
      undefined
    );
  });
});
