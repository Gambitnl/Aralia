import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatureHarvestPanel } from '../CreatureHarvestPanel';
import { PlayerCharacter } from '../../../types';
import { attemptCreatureHarvest } from '../../../systems/crafting/creatureHarvestSystem';

const useGameStateMock = vi.fn();

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => useGameStateMock(),
}));

vi.mock('../CreatureHarvestPanel.css', () => ({}));

vi.mock('../../../systems/crafting/creatureHarvestData', () => ({
  getCreatureById: vi.fn(() => ({
    id: 'wolf',
    name: 'Wolf',
    cr: 1,
    locations: ['Forest'],
    parts: [],
  })),
  getHarvestableParts: vi.fn(() => [
    {
      id: 'hide',
      name: 'Hide',
      rarity: 'common',
      harvestTool: 'poisoners_kit',
      harvestDC: 10,
      baseYield: '1',
    },
  ]),
}));

vi.mock('../../../systems/crafting/creatureHarvestSystem', () => ({
  getHarvestableParts: vi.fn(() => [
    {
      id: 'hide',
      name: 'Hide',
      rarity: 'common',
      harvestTool: 'poisoners_kit',
      harvestDC: 10,
      baseYield: '1',
    },
  ]),
  attemptCreatureHarvest: vi.fn(() => ({
    success: true,
    roll: 18,
    dc: 10,
    part: { id: 'hide', name: 'Hide', rarity: 'common', harvestTool: 'poisoners_kit', harvestDC: 10, baseYield: '1' },
    creature: { id: 'wolf', name: 'Wolf', cr: 1, locations: ['Forest'], parts: [] },
    yield: 1,
    yieldMessage: 'harvested',
    toolUsed: "Poisoner's Kit",
  })),
}));

const makeCharacter = (id: string, name: string): PlayerCharacter => ({
  id,
  name,
  level: 5,
  proficiencyBonus: 3,
  abilityScores: {
    Strength: 10,
    Dexterity: 14,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  finalAbilityScores: {
    Strength: 10,
    Dexterity: 14,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  skills: [{ id: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'Dexterity' }],
  toolProficiencies: [],
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: {
    id: 'rogue',
    name: 'Rogue',
    description: '',
    hitDie: 8,
    primaryAbility: ['Dexterity'],
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

describe('CreatureHarvestPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the mocked part list before interaction', () => {
    const lead = makeCharacter('party-lead', 'Party Lead');
    const dispatch = vi.fn();

    useGameStateMock.mockReturnValue({
      state: {
        party: [lead],
        characterSheetModal: { isOpen: false, character: null },
      },
      dispatch,
    });

    render(<CreatureHarvestPanel creatureId="wolf" />);

    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  it('uses the party lead instead of a fabricated crafter when harvesting creature parts', () => {
    const lead = makeCharacter('party-lead', 'Party Lead');
    const selected = makeCharacter('sheet-hero', 'Sheet Hero');
    const dispatch = vi.fn();

    useGameStateMock.mockReturnValue({
      state: {
        party: [lead],
        characterSheetModal: { isOpen: true, character: selected },
      },
      dispatch,
    });

    render(<CreatureHarvestPanel creatureId="wolf" />);

    fireEvent.click(screen.getByRole('button', { name: /^Harvest$/i }));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(attemptCreatureHarvest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'party-lead', name: 'Party Lead' }),
      'wolf',
      'hide'
    );
  });
});
