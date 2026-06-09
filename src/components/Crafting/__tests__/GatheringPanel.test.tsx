import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatheringPanel } from '../GatheringPanel';
import { PlayerCharacter } from '../../../types';
import { attemptIdentification } from '../../../systems/crafting/gatheringSystem';

const useGameStateMock = vi.fn();

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => useGameStateMock(),
}));

vi.mock('../GatheringPanel.css', () => ({}));

vi.mock('../../../systems/crafting/gatheringSystem', () => ({
  attemptIdentification: vi.fn(() => ({
    success: true,
    roll: 18,
    identifiedResources: [],
    message: 'identified',
  })),
  attemptHarvest: vi.fn(() => ({
    success: true,
    roll: 18,
    yield: 1,
    yieldMessage: 'harvested',
    resource: { id: 'herb', name: 'Herb', rarity: 'common', identifyDC: 10, harvestDC: 10, baseYield: '1', locations: ['Forest'] },
  })),
}));

const makeCharacter = (id: string, name: string): PlayerCharacter => ({
  id,
  name,
  level: 5,
  proficiencyBonus: 3,
  abilityScores: {
    Strength: 10,
    Dexterity: 12,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  finalAbilityScores: {
    Strength: 10,
    Dexterity: 12,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  skills: [{ id: 'nature', name: 'Nature', ability: 'Intelligence' }],
  toolProficiencies: ['Herbalism Kit'],
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: {
    id: 'wizard',
    name: 'Wizard',
    description: '',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: [],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: [],
  },
  statusEffects: [],
  hp: 10,
  maxHp: 10,
  armorClass: 10,
  speed: 30,
  darkvisionRange: 0,
  transportMode: 'foot',
  equippedItems: {},
});

describe('GatheringPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the selected character from the character sheet when resolving gathering checks', () => {
    const lead = makeCharacter('party-lead', 'Party Lead');
    const selected = makeCharacter('sheet-hero', 'Sheet Hero');
    const dispatch = vi.fn();

    useGameStateMock.mockReturnValue({
      state: {
        currentLocationId: 'forest_glade',
        party: [lead],
        characterSheetModal: { isOpen: true, character: selected },
      },
      dispatch,
    });

    render(<GatheringPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Search for Flora/i }));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(attemptIdentification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sheet-hero', name: 'Sheet Hero' }),
      'Forest',
      1
    );
  });
});
